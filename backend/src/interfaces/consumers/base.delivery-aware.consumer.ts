import {ConfigService} from '@nestjs/config';
import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {DeliveryConfirmationService} from '@infrastructure/messaging/services/delivery-confirmation.service';
import {BaseResilientConsumer, ResilientConsumerOptions} from './base.resilient.consumer';
import * as crypto from 'crypto';

/**
 * BaseDeliveryAwareConsumer - Base class for RabbitMQ consumers that wait for delivery confirmation
 *
 * Architecture for millions of users:
 * - Messages are consumed from RabbitMQ queue
 * - Messages are sent via WebSocket to users
 * - Worker waits for delivery confirmation from frontend
 * - Only saves to database after confirmation
 * - If confirmation times out or fails, message is returned to queue or sent to DLQ
 *
 * Flow:
 * 1. Worker consumes message from RabbitMQ (no auto-ack)
 * 2. Worker generates unique messageId and stores in Redis with TTL
 * 3. Worker emits WebSocket notification to user
 * 4. Worker waits for confirmation (with timeout)
 * 5. If confirmed: Save to database, ack message, remove from Redis
 * 6. If timeout/failure: Nack message (return to queue or DLQ), remove from Redis
 *
 * Timeout Handling:
 * - Default timeout: 60 seconds (configurable via DELIVERY_CONFIRMATION_TTL)
 * - Redis TTL automatically expires pending deliveries
 * - Periodic cleanup of expired deliveries
 *
 * For high-scale:
 * - Multiple workers can process messages in parallel
 * - Redis Cluster for high availability
 * - Monitor confirmation rates and timeout rates
 * - Adjust timeout based on network latency
 *
 * Classe base para consumidores RabbitMQ que aguardam confirmação de entrega
 *
 * Arquitetura para milhões de usuários:
 * - Mensagens são consumidas da fila RabbitMQ
 * - Mensagens são enviadas via WebSocket para usuários
 * - Worker aguarda confirmação de entrega do frontend
 * - Salva no banco de dados apenas após confirmação
 * - Se confirmação expirar ou falhar, mensagem volta para fila ou vai para DLQ
 *
 * Fluxo:
 * 1. Worker consome mensagem do RabbitMQ (sem auto-ack)
 * 2. Worker gera messageId único e armazena no Redis com TTL
 * 3. Worker emite notificação WebSocket para usuário
 * 4. Worker aguarda confirmação (com timeout)
 * 5. Se confirmado: Salva no banco, ack mensagem, remove do Redis
 * 6. Se timeout/falha: Nack mensagem (volta para fila ou DLQ), remove do Redis
 *
 * Tratamento de Timeout:
 * - Timeout padrão: 60 segundos (configurável via DELIVERY_CONFIRMATION_TTL)
 * - TTL do Redis expira automaticamente entregas pendentes
 * - Limpeza periódica de entregas expiradas
 *
 * Para alta escala:
 * - Múltiplos workers podem processar mensagens em paralelo
 * - Redis Cluster para alta disponibilidade
 * - Monitore taxas de confirmação e timeout
 * - Ajuste timeout baseado em latência de rede
 */
export abstract class BaseDeliveryAwareConsumer<T = any> extends BaseResilientConsumer<T> {
    protected readonly deliveryConfirmation: DeliveryConfirmationService;
    protected readonly confirmationTimeout: number;

    constructor(
        rabbit: RabbitMQService,
        opts: ResilientConsumerOptions,
        deliveryConfirmation: DeliveryConfirmationService,
        configService?: ConfigService
    ) {
        super(rabbit, opts, configService);
        this.deliveryConfirmation = deliveryConfirmation;
        this.confirmationTimeout = parseInt(process.env.DELIVERY_CONFIRMATION_TTL || '60', 10) * 1000;
    }

    /**
     * EN -
     * Abstract method that must be implemented by subclasses to process messages with delivery confirmation.
     * Override this method instead of `process()` to implement delivery-aware message processing.
     * 
     * This method handles the complete delivery confirmation flow:
     * 1. Generating message ID (if not provided)
     * 2. Storing pending delivery in Redis with TTL
     * 3. Emitting WebSocket notification to users
     * 4. Waiting for delivery confirmation from frontend
     * 5. Saving to database if confirmed
     * 6. Handling timeout/failure scenarios
     * 
     * PT -
     * Método abstrato que deve ser implementado pelas subclasses para processar mensagens com confirmação de entrega.
     * Sobrescreva este método ao invés de `process()` para implementar processamento de mensagens com consciência de entrega.
     * 
     * Este método trata o fluxo completo de confirmação de entrega:
     * 1. Geração de ID da mensagem (se não fornecido)
     * 2. Armazenamento de entrega pendente no Redis com TTL
     * 3. Emissão de notificação WebSocket para usuários
     * 4. Aguardar confirmação de entrega do frontend
     * 5. Salvar no banco de dados se confirmado
     * 6. Tratar cenários de timeout/falha
     * 
     * @param payload - Message payload from RabbitMQ
     * @param messageId - Unique message ID for tracking delivery confirmation
     * @returns Promise with confirmation status, save status, and optional error message
     */
    protected abstract processWithDelivery(
        payload: T,
        messageId: string
    ): Promise<{ confirmed: boolean; saved?: boolean; error?: string }>;

    /**
     * EN -
     * Overrides base process method to handle delivery confirmation flow.
     * Orchestrates message processing with delivery confirmation: generates message ID, calls processWithDelivery,
     * handles confirmation results, and manages cleanup of pending deliveries.
     * 
     * PT -
     * Sobrescreve método process base para tratar fluxo de confirmação de entrega.
     * Orquestra processamento de mensagens com confirmação de entrega: gera ID da mensagem, chama processWithDelivery,
     * trata resultados de confirmação e gerencia limpeza de entregas pendentes.
     * 
     * @param payload - Message payload from RabbitMQ
     */
    protected async process(payload: T): Promise<void> {
        const messageId = this.generateMessageId(payload);
        this.logger.rabbitmq(`Processing message with delivery confirmation: messageId=${messageId}`);

        try {
            const result = await this.processWithDelivery(payload, messageId);

            if (result.confirmed) {
                this.logger.rabbitmq(`Message confirmed and processed: messageId=${messageId}, saved=${result.saved || false}`);
                await this.deliveryConfirmation.removePendingDelivery(messageId);
            } else {
                const errorMsg = result.error || 'Delivery confirmation timeout or failed';
                this.logger.rabbitmq(`Message delivery failed: messageId=${messageId}, error=${errorMsg}`);
                throw new Error(errorMsg);
            }
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            this.logger.error(`Error processing message with delivery confirmation: messageId=${messageId}, error=${errorMsg}`);
            
            await this.deliveryConfirmation.removePendingDelivery(messageId);
            throw error;
        }
    }

    /**
     * EN -
     * Waits for delivery confirmation by polling Redis with specified timeout and interval.
     * Continuously checks if message is no longer pending and confirms delivery.
     * Returns true if confirmation received within timeout, false if timeout occurs.
     * 
     * PT -
     * Aguarda confirmação de entrega consultando Redis com timeout e intervalo especificados.
     * Verifica continuamente se mensagem não está mais pendente e confirma entrega.
     * Retorna true se confirmação recebida dentro do timeout, false se timeout ocorrer.
     * 
     * @param messageId - Unique message ID to check confirmation for
     * @param timeoutMs - Maximum time to wait for confirmation in milliseconds
     * @param pollIntervalMs - Interval between polling checks in milliseconds
     * @returns Promise resolving to true if confirmed, false if timeout
     */
    protected async waitForConfirmation(
        messageId: string,
        timeoutMs: number = this.confirmationTimeout,
        pollIntervalMs: number = 1000
    ): Promise<boolean> {
        const startTime = Date.now();
        this.logger.rabbitmq(`Waiting for delivery confirmation: messageId=${messageId}, timeout=${timeoutMs}ms`);

        while (Date.now() - startTime < timeoutMs) {
            const isPending = await this.deliveryConfirmation.isPending(messageId);
            if (!isPending) {
                const confirmed = await this.deliveryConfirmation.confirmDelivery(messageId);
                if (confirmed) {
                    this.logger.rabbitmq(`Delivery confirmed: messageId=${messageId}`);
                    return true;
                }
            }

            await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
        }

        this.logger.rabbitmq(`Delivery confirmation timeout: messageId=${messageId}, elapsed=${Date.now() - startTime}ms`);
        return false;
    }

    /**
     * EN -
     * Generates a unique message ID for delivery tracking using timestamp and random bytes.
     * Creates a unique identifier combining current timestamp and random hexadecimal string.
     * Can be overridden by subclasses to implement custom ID generation strategies.
     * 
     * PT -
     * Gera um ID único de mensagem para rastreamento de entrega usando timestamp e bytes aleatórios.
     * Cria um identificador único combinando timestamp atual e string hexadecimal aleatória.
     * Pode ser sobrescrito por subclasses para implementar estratégias de geração de ID customizadas.
     * 
     * @param payload - Message payload to generate ID for
     * @returns Unique message ID string in format: msg_{timestamp}_{randomHex}
     */
    protected generateMessageId(payload: T): string {
        const payloadStr = JSON.stringify(payload);
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `msg_${timestamp}_${random}`;
    }

    /**
     * EN -
     * Checks if a message is still pending delivery confirmation in Redis.
     * Delegates to delivery confirmation service to check pending status.
     * 
     * PT -
     * Verifica se uma mensagem ainda está pendente de confirmação de entrega no Redis.
     * Delega para serviço de confirmação de entrega para verificar status pendente.
     * 
     * @param messageId - Unique message ID to check
     * @returns Promise resolving to true if pending, false otherwise
     */
    protected async isPending(messageId: string): Promise<boolean> {
        return this.deliveryConfirmation.isPending(messageId);
    }

    /**
     * EN -
     * Retrieves pending delivery data from Redis for inspection and debugging.
     * Returns payload, metadata, and creation timestamp if delivery is still pending.
     * Returns null if delivery is not pending or has expired.
     * 
     * PT -
     * Recupera dados de entrega pendente do Redis para inspeção e depuração.
     * Retorna payload, metadata e timestamp de criação se entrega ainda estiver pendente.
     * Retorna null se entrega não estiver pendente ou tiver expirado.
     * 
     * @param messageId - Unique message ID to retrieve data for
     * @returns Promise resolving to delivery data object or null if not found
     */
    protected async getPendingDelivery(messageId: string): Promise<{ payload: any; metadata: any; createdAt: number } | null> {
        return this.deliveryConfirmation.getPendingDelivery(messageId);
    }
}


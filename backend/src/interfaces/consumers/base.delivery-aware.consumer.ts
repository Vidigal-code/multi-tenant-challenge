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
     * Process message with delivery confirmation
     *
     * EN: Override this method instead of `process()`. This method handles:
     * 1. Generating message ID
     * 2. Storing pending delivery in Redis
     * 3. Emitting WebSocket notification
     * 4. Waiting for confirmation
     * 5. Saving to database if confirmed
     * 6. Handling timeout/failure
     *
     * PT: Sobrescreva este método ao invés de `process()`. Este método trata:
     * 1. Geração de ID da mensagem
     * 2. Armazenamento de entrega pendente no Redis
     * 3. Emissão de notificação WebSocket
     * 4. Aguardar confirmação
     * 5. Salvar no banco se confirmado
     * 6. Tratar timeout/falha
     *
     * @param payload - Message payload from RabbitMQ
     * @param payload - Payload da mensagem do RabbitMQ
     * @param messageId - Unique message ID (generated if not provided)
     * @param messageId - ID único da mensagem (gerado se não fornecido)
     * @returns Promise<void>
     */
    protected abstract processWithDelivery(
        payload: T,
        messageId: string
    ): Promise<{ confirmed: boolean; saved?: boolean; error?: string }>;

    /**
     * Override base process method to handle delivery confirmation
     *
     * EN: This method is called by BaseResilientConsumer. It orchestrates the delivery confirmation flow.
     *
     * PT: Este método é chamado por BaseResilientConsumer. Ele orquestra o fluxo de confirmação de entrega.
     *
     * @param payload - Message payload from RabbitMQ
     * @param payload - Payload da mensagem do RabbitMQ
     * @returns Promise<void>
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
     * Wait for delivery confirmation with timeout
     *
     * EN: Polls Redis for delivery confirmation. Returns true if confirmed within timeout, false otherwise.
     *
     * PT: Consulta Redis por confirmação de entrega. Retorna true se confirmado dentro do timeout, false caso contrário.
     *
     * @param messageId - Unique message ID
     * @param messageId - ID único da mensagem
     * @param timeoutMs - Timeout in milliseconds (default: confirmationTimeout)
     * @param timeoutMs - Timeout em milissegundos (padrão: confirmationTimeout)
     * @param pollIntervalMs - Polling interval in milliseconds (default: 1000ms = 1 second)
     * @param pollIntervalMs - Intervalo de polling em milissegundos (padrão: 1000ms = 1 segundo)
     * @returns Promise<boolean> - True if confirmed, false if timeout
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
     * Generate unique message ID for delivery tracking
     *
     * EN: Generates a unique identifier for the message. Can be overridden to use custom ID generation.
     *
     * PT: Gera um identificador único para a mensagem. Pode ser sobrescrito para usar geração de ID customizada.
     *
     * @param payload - Message payload
     * @param payload - Payload da mensagem
     * @returns string - Unique message ID
     */
    protected generateMessageId(_payload: T): string {
        const timestamp = Date.now();
        const random = crypto.randomBytes(8).toString('hex');
        return `msg_${timestamp}_${random}`;
    }

    /**
     * Check if message is still pending confirmation
     *
     * EN: Checks if a message is still waiting for confirmation.
     *
     * PT: Verifica se uma mensagem ainda está aguardando confirmação.
     *
     * @param messageId - Unique message ID
     * @param messageId - ID único da mensagem
     * @returns Promise<boolean>
     */
    protected async isPending(messageId: string): Promise<boolean> {
        return this.deliveryConfirmation.isPending(messageId);
    }

    /**
     * Get pending delivery data
     *
     * EN: Retrieves pending delivery data for inspection.
     *
     * PT: Recupera dados de entrega pendente para inspeção.
     *
     * @param messageId - Unique message ID
     * @param messageId - ID único da mensagem
     * @returns Promise<any | null>
     */
    protected async getPendingDelivery(messageId: string): Promise<{ payload: any; metadata: any; createdAt: number } | null> {
        return this.deliveryConfirmation.getPendingDelivery(messageId);
    }
}


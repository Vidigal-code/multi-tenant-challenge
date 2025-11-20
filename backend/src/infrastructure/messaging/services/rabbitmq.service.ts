import * as dotenv from "dotenv";
dotenv.config();

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as amqp from "amqplib";
import { LoggerService } from "@infrastructure/logging/logger.service";

export const INVITE_QUEUE = "invites";

/**
 * RabbitMQService - Message queue service for asynchronous event processing
 *
 * Architecture for millions of users:
 * - Dedicated queues for each event type (invites, members, notifications, etc.)
 * - Dead Letter Queues (DLQ) for failed messages
 * - Prefetch configuration for parallel processing
 * - Retry mechanism with exponential backoff
 * - Message persistence for reliability
 *
 * Queue Configuration:
 * - Durable queues survive broker restarts
 * - Persistent messages are written to disk
 * - Prefetch controls how many unacknowledged messages a consumer can receive
 * - Multiple workers can consume from the same queue for parallel processing
 *
 * For high-scale deployments:
 * - Use RabbitMQ Cluster for high availability
 * - Configure queue sharding for very high throughput
 * - Monitor queue depths and consumer lag
 * - Use priority queues for critical events
 * - Implement queue TTL for message expiration
 *
 * Serviço de fila de mensagens para processamento assíncrono de eventos
 *
 * Arquitetura para milhões de usuários:
 * - Filas dedicadas para cada tipo de evento (convites, membros, notificações, etc.)
 * - Filas de mensagens mortas (DLQ) para mensagens com falha
 * - Configuração de prefetch para processamento paralelo
 * - Mecanismo de retry com backoff exponencial
 * - Persistência de mensagens para confiabilidade
 *
 * Configuração de Filas:
 * - Filas duráveis sobrevivem a reinicializações do broker
 * - Mensagens persistentes são escritas em disco
 * - Prefetch controla quantas mensagens não reconhecidas um consumidor pode receber
 * - Múltiplos workers podem consumir da mesma fila para processamento paralelo
 *
 * Para deployments de alta escala:
 * - Use RabbitMQ Cluster para alta disponibilidade
 * - Configure fragmentação de filas para throughput muito alto
 * - Monitore profundidade de filas e lag de consumidores
 * - Use filas de prioridade para eventos críticos
 * - Implemente TTL de fila para expiração de mensagens
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    /**
     * Logger service instance for logging RabbitMQ operations.
     * Serviço de logger para registrar operações do RabbitMQ.
     */
    private readonly logger: LoggerService;

    /**
     * RabbitMQ connection instance.
     * Instância de conexão do RabbitMQ.
     */
    private connection: any | null = null;

    /**
     * RabbitMQ channel instance for operations like asserting queues and sending messages.
     * Instância de canal do RabbitMQ para operações como declarar filas e enviar mensagens.
     */
    private channel: any | null = null;

    /**
     * Constructor - Initializes the service with ConfigService and LoggerService.
     * Construtor - Inicializa o serviço com ConfigService e LoggerService.
     *
     * @param configService - Service to access configuration values.
     * @param configService - Serviço para acessar valores de configuração.
     */
    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(RabbitMQService.name, configService);
    }

    /**
     * Lifecycle hook called when the module is initialized. Establishes connection to RabbitMQ.
     * Gancho de ciclo de vida chamado quando o módulo é inicializado. Estabelece conexão com o RabbitMQ.
     *
     * @returns Promise<void>
     */
    async onModuleInit(): Promise<void> {
        const url = this.configService.get<string>("app.rabbitmqUrl") || process.env.RABBITMQ_URL;
        if (!url) {
            this.logger.rabbitmq("URL not configured. Skipping connection.");
            return;
        }
        await this.connectWithRetry(url);
    }

    /**
     * Lifecycle hook called when the module is destroyed. Closes the channel and connection.
     * Gancho de ciclo de vida chamado quando o módulo é destruído. Fecha o canal e a conexão.
     *
     * @returns Promise<void>
     */
    async onModuleDestroy(): Promise<void> {
        if (this.channel) {
            this.logger.rabbitmq("Closing RabbitMQ channel...");
            await this.channel.close();
        }
        if (this.connection) {
            this.logger.rabbitmq("Closing RabbitMQ connection...");
            await this.connection.close();
        }
    }

    /**
     * Asserts a durable queue that survives broker restarts.
     * Durable queues are essential for production reliability.
     *
     * Declara uma fila durável que sobrevive a reinicializações do broker.
     * Filas duráveis são essenciais para confiabilidade em produção.
     *
     * @param queue - Name of the queue to assert.
     * @param queue - Nome da fila a declarar.
     * @returns Promise<void>
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async assertQueue(queue: string): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        this.logger.rabbitmq(`Asserting queue: ${queue}`);
        await this.channel.assertQueue(queue, { durable: true });
        this.logger.rabbitmq(`Queue asserted successfully: ${queue}`);
    }

    /**
     * Sends a message to the specified queue with persistence.
     * Persistent messages are written to disk, ensuring delivery even if broker restarts.
     * This is critical for high-scale systems where message loss is unacceptable.
     *
     * Envia uma mensagem para a fila especificada com persistência.
     * Mensagens persistentes são escritas em disco, garantindo entrega mesmo se o broker reiniciar.
     * Isso é crítico para sistemas de alta escala onde perda de mensagens é inaceitável.
     *
     * @param queue - Name of the queue to send the message to.
     * @param queue - Nome da fila para enviar a mensagem.
     * @param content - Buffer containing the message content.
     * @param content - Buffer contendo o conteúdo da mensagem.
     * @param options - Additional options for sending the message.
     * @param options - Opções adicionais para enviar a mensagem.
     * @returns Promise<void>
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async sendToQueue(queue: string, content: Buffer, options?: any): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        const messageSize = content.length;
        const messagePreview = content.toString().substring(0, 100);
        this.logger.rabbitmq(`Sending message to queue: ${queue}, size: ${messageSize} bytes`);
        this.logger.rabbitmq(`Preview: ${messagePreview}...`);
        await this.channel.sendToQueue(queue, content, { persistent: true, ...(options || {}) });
        this.logger.rabbitmq(`Message sent successfully to: ${queue}`);
    }

    /**
     * Returns the RabbitMQ channel instance.
     * Retorna a instância do canal RabbitMQ.
     *
     * @returns Promise<any> - The channel instance.
     * @returns Promise<any> - A instância do canal.
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async getChannel(): Promise<any> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        return this.channel;
    }

    /**
     * Asserts a queue with custom options, including durability by default.
     * Declara uma fila com opções personalizadas, incluindo durabilidade por padrão.
     *
     * @param queue - Name of the queue to assert.
     * @param queue - Nome da fila a declarar.
     * @param options - Options for queue assertion.
     * @param options - Opções para declaração da fila.
     * @returns Promise<void>
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async assertQueueWithOptions(queue: string, options: any): Promise<void> {
        if (!this.connection) throw new Error("RABBITMQ_CONNECTION_NOT_INITIALIZED");
        
        if (!this.channel) {
            this.logger.rabbitmq(`Channel not initialized, creating new channel...`);
            this.channel = await this.connection.createChannel();
        }
        
        try {
            await this.channel.assertQueue(queue, { durable: true, ...(options || {}) });
            this.logger.rabbitmq(`Queue asserted successfully: ${queue}`);
        } catch (error: any) {
            if (error?.code === 406 || error?.message?.includes('PRECONDITION_FAILED')) {
                this.logger.rabbitmq(`Queue ${queue} exists with different options (PRECONDITION_FAILED).`);
                this.logger.rabbitmq(`The queue has different DLQ configuration. Messages in the queue will be preserved.`);
                this.logger.rabbitmq(`To fix: Stop all workers, run 'npm run clean:queues', then restart with 'npm run start:all'`);
                this.logger.rabbitmq(`Or delete the queue manually from RabbitMQ Management UI: http://localhost:15672`);
                throw new Error(`Queue ${queue} exists with different options. Stop all workers, run 
                'npm run clean:queues', and restart. Error: ${error?.message || String(error)}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Deletes a queue. Use with caution as this will remove all messages in the queue.
     * Deleta uma fila. Use com cuidado pois isso removerá todas as mensagens na fila.
     *
     * @param queue - Name of the queue to delete.
     * @param queue - Nome da fila a deletar.
     * @param options
     * @returns Promise<void>
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async deleteQueue(queue: string, options?: { ifUnused?: boolean; ifEmpty?: boolean }): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        try {
            await this.channel.deleteQueue(queue, {});
            this.logger.rabbitmq(`Queue deleted successfully: ${queue}`);
        } catch (error: any) {
            if (error?.code === 404) {
                this.logger.rabbitmq(`Queue does not exist: ${queue}`);
            } else if (error?.code === 406 || error?.message?.includes('PRECONDITION_FAILED')) {
                try {
                    await this.channel.deleteQueue(queue, options || { ifUnused: true, ifEmpty: true });
                    this.logger.rabbitmq(`Queue deleted successfully with restrictions: ${queue}`);
                } catch (retryError: any) {
                    this.logger.rabbitmq(`Warning: Could not delete queue ${queue}: ${retryError?.message || 
                    String(retryError)}. Continuing anyway.`);
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * Asserts an event queue with Dead Letter Queue (DLQ) configuration.
     *
     * DLQ Pattern:
     * - Failed messages after max retries are sent to DLQ
     * - Allows manual inspection and reprocessing
     * - Prevents message loss and enables debugging
     *
     * For high-scale:
     * - Monitor DLQ sizes to detect processing issues
     * - Implement DLQ consumers for alerting
     * - Consider DLQ TTL to prevent unbounded growth
     *
     * Declara uma fila de eventos com configuração de Dead Letter Queue (DLQ).
     *
     * Padrão DLQ:
     * - Mensagens com falha após máximo de tentativas são enviadas para DLQ
     * - Permite inspeção manual e reprocessamento
     * - Previne perda de mensagens e permite depuração
     *
     * Para alta escala:
     * - Monitore tamanhos de DLQ para detectar problemas de processamento
     * - Implemente consumidores DLQ para alertas
     * - Considere TTL de DLQ para prevenir crescimento ilimitado
     *
     * @param queue - Name of the main event queue.
     * @param queue - Nome da fila principal de eventos.
     * @param dlq - Name of the Dead Letter Queue.
     * @param dlq - Nome da Dead Letter Queue.
     * @returns Promise<void>
     */
    async assertEventQueue(queue: string, dlq: string): Promise<void> {
        this.logger.rabbitmq(`Declarando fila de eventos com DLQ: ${queue} -> ${dlq}`);
        this.logger.rabbitmq(`Asserting event queue with DLQ: ${queue} -> ${dlq}`);
        await this.assertQueueWithOptions(queue, {
            deadLetterExchange: '',
            deadLetterRoutingKey: dlq,
        });
        await this.assertQueue(dlq);
        this.logger.rabbitmq(`Event queue and DLQ asserted: ${queue}, ${dlq}`);
    }

    /**
     * Sets the prefetch count for consumer channels.
     *
     * Prefetch controls how many unacknowledged messages a consumer can receive.
     * This balances throughput and fairness:
     * - Low prefetch (1-10): Better load distribution, lower throughput
     * - High prefetch (50-100): Higher throughput, potential load imbalance
     *
     * For millions of events:
     * - Start with prefetch=50 (configurable via RABBITMQ_PREFETCH)
     * - Adjust based on message processing time
     * - Monitor consumer lag and adjust accordingly
     *
     * Define a contagem de prefetch para canais de consumidores.
     *
     * Prefetch controla quantas mensagens não reconhecidas um consumidor pode receber.
     * Isso equilibra throughput e justiça:
     * - Prefetch baixo (1-10): Melhor distribuição de carga, menor throughput
     * - Prefetch alto (50-100): Maior throughput, potencial desequilíbrio de carga
     *
     * Para milhões de eventos:
     * - Comece com prefetch=50 (configurável via RABBITMQ_PREFETCH)
     * - Ajuste baseado no tempo de processamento de mensagens
     * - Monitore lag de consumidores e ajuste conforme necessário
     *
     * @param prefetch - Number of messages to prefetch.
     * @param prefetch - Número de mensagens para prefetch.
     * @returns Promise<void>
     * @throws Error if channel is not initialized.
     * @throws Error se o canal não estiver inicializado.
     */
    async setPrefetch(prefetch: number): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        this.logger.rabbitmq(`Configurando prefetch: ${prefetch}`);
        this.logger.rabbitmq(`Setting prefetch: ${prefetch}`);
        await this.channel.prefetch(prefetch);
    }

    /**
     * Private method to connect to RabbitMQ with retry logic.
     * Método privado para conectar ao RabbitMQ com lógica de retry.
     *
     * @param url - RabbitMQ connection URL.
     * @param url - URL de conexão do RabbitMQ.
     * @param maxAttempts - Maximum number of connection attempts (default: 10).
     * @param maxAttempts - Número máximo de tentativas de conexão (padrão: 10).
     * @param delayMs - Delay in milliseconds between attempts (default: 3000).
     * @param delayMs - Atraso em milissegundos entre tentativas (padrão: 3000).
     * @returns Promise<void>
     * @throws Last error encountered if all attempts fail.
     * @throws Último erro encontrado se todas as tentativas falharem.
     */
    private async connectWithRetry(url: string, maxAttempts = 10, delayMs = 3000) {
        let lastErr: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger.rabbitmq(`Connecting to RabbitMQ (attempt ${attempt}/${maxAttempts})...`);
                this.connection = await amqp.connect(url);
                this.channel = await this.connection.createChannel();
                this.logger.rabbitmq("RabbitMQ connected successfully");
                this.logger.rabbitmq(`URL: ${url.replace(/:[^:@]+@/, ':****@')}`);
                return;
            } catch (err: any) {
                lastErr = err;
                const message = err?.message || String(err);
                this.logger.rabbitmq(`RabbitMQ connection failed: ${message} (attempt ${attempt}/${maxAttempts})`);
                if (attempt < maxAttempts) {
                    this.logger.rabbitmq(`Waiting ${delayMs}ms before retry...`);
                    await new Promise((res) => setTimeout(res, delayMs));
                }
            }
        }
        this.logger.rabbitmq("Exhausted all retries connecting to RabbitMQ");
        throw lastErr;
    }
}
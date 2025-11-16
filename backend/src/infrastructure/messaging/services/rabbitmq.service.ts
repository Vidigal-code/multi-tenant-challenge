import * as dotenv from "dotenv";
dotenv.config();

import {Injectable, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import * as amqp from "amqplib";
import {LoggerService} from "@infrastructure/logging/logger.service";

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
    private readonly logger: LoggerService;
    private connection: any | null = null;
    private channel: any | null = null;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(RabbitMQService.name, configService);
    }

    async onModuleInit(): Promise<void> {
        const url = this.configService.get<string>("app.rabbitmqUrl") || process.env.RABBITMQ_URL;
        if (!url) {
            this.logger.rabbitmq("URL not configured. Skipping connection.");
            return;
        }
        await this.connectWithRetry(url);
    }

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
     * Assert a durable queue that survives broker restarts
     * Durable queues are essential for production reliability
     */
    async assertQueue(queue: string): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        this.logger.rabbitmq(`Asserting queue: ${queue}`);
        await this.channel.assertQueue(queue, {durable: true});
        this.logger.rabbitmq(`Queue asserted successfully: ${queue}`);
    }

    /**
     * Send message to queue with persistence
     * Persistent messages are written to disk, ensuring delivery even if broker restarts
     * This is critical for high-scale systems where message loss is unacceptable
     */
    async sendToQueue(queue: string, content: Buffer, options?: any): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        const messageSize = content.length;
        const messagePreview = content.toString().substring(0, 100);
        this.logger.rabbitmq(`Sending message to queue: ${queue}, size: ${messageSize} bytes`);
        this.logger.rabbitmq(`Preview: ${messagePreview}...`);
        await this.channel.sendToQueue(queue, content, {persistent: true, ...(options || {})});
        this.logger.rabbitmq(`Message sent successfully to: ${queue}`);
    }

    async getChannel(): Promise<any> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        return this.channel;
    }

    async assertQueueWithOptions(queue: string, options: any): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        await this.channel.assertQueue(queue, {durable: true, ...(options || {})});
    }


    /**
     * Assert event queue with Dead Letter Queue (DLQ) configuration
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
     * Set prefetch count for consumer channels
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
     */
    async setPrefetch(prefetch: number): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        this.logger.rabbitmq(`Configurando prefetch: ${prefetch}`);
        this.logger.rabbitmq(`Setting prefetch: ${prefetch}`);
        await this.channel.prefetch(prefetch);
    }

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

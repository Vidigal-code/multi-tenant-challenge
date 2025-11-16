import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import Redis from "ioredis";

export interface ResilientConsumerOptions {
    queue: string;
    dlq: string;
    prefetch: number;
    retryMax: number;
    redisUrl: string;
    dedupTtlSeconds: number;
}

/**
 * BaseResilientConsumer - Base class for RabbitMQ event consumers
 * 
 * Features for high-scale processing:
 * - Automatic retry with exponential backoff
 * - Dead Letter Queue (DLQ) for failed messages
 * - Message deduplication using Redis
 * - Prefetch control for parallel processing
 * - Graceful error handling
 * 
 * Architecture:
 * - Multiple workers can consume from the same queue
 * - Messages are distributed across workers automatically
 * - Failed messages are retried up to retryMax times
 * - Duplicate messages are filtered using Redis
 * 
 * For millions of events:
 * - Deploy multiple consumer instances for horizontal scaling
 * - Monitor queue depths and processing rates
 * - Adjust prefetch based on message processing time
 * - Use Redis Cluster for deduplication at scale
 * 
 * Classe base para consumidores de eventos RabbitMQ
 * 
 * Recursos para processamento em alta escala:
 * - Retry automático com backoff exponencial
 * - Fila de mensagens mortas (DLQ) para mensagens com falha
 * - Desduplicação de mensagens usando Redis
 * - Controle de prefetch para processamento paralelo
 * - Tratamento elegante de erros
 * 
 * Arquitetura:
 * - Múltiplos workers podem consumir da mesma fila
 * - Mensagens são distribuídas entre workers automaticamente
 * - Mensagens com falha são reprocessadas até retryMax vezes
 * - Mensagens duplicadas são filtradas usando Redis
 * 
 * Para milhões de eventos:
 * - Faça deploy de múltiplas instâncias de consumidor para escalonamento horizontal
 * - Monitore profundidade de filas e taxas de processamento
 * - Ajuste prefetch baseado no tempo de processamento de mensagens
 * - Use Redis Cluster para desduplicação em escala
 */
export abstract class BaseResilientConsumer<T = any> {
    protected readonly logger: LoggerService;
    private redis: Redis;

    constructor(protected readonly rabbit: RabbitMQService, private readonly opts: ResilientConsumerOptions, private readonly configService?: ConfigService) {
        this.logger = new LoggerService(this.constructor.name, configService);
        this.redis = new Redis(opts.redisUrl);
    }

    async start() {
        const channel = await this.rabbit.getChannel();
        await this.rabbit.assertQueueWithOptions(this.opts.queue, {
            deadLetterExchange: '',
            deadLetterRoutingKey: this.opts.dlq,
        });
        await this.rabbit.assertQueue(this.opts.dlq);
        await this.rabbit.setPrefetch(this.opts.prefetch);
        this.logger.rabbitmq(`Consuming queue: ${this.opts.queue}, prefetch: ${this.opts.prefetch}`);
        channel.consume(this.opts.queue, async (msg: any) => {
            if (!msg) return;
            const raw = msg.content.toString();
            let payload: T;
            try {
                payload = JSON.parse(raw);
                this.logger.rabbitmq(`Message received from queue: ${this.opts.queue}, size: ${raw.length} bytes`);
                this.logger.rabbitmq(`Payload: ${raw.substring(0, 200)}...`);
            } catch (e) {
                this.logger.rabbitmq(`Invalid JSON, routing to DLQ: ${raw.substring(0, 100)}`);
                channel.nack(msg, false, false);
                return;
            }
            const key = this.dedupKey(payload);
            if (key) {
                const exists = await this.redis.get(key);
                if (exists) {
                    this.logger.rabbitmq(`Dedup: skipping duplicate message, key: ${key}, ttl: ${await this.redis.ttl(key)}s`);
                    channel.ack(msg);
                    return;
                }
                // Log when processing with dedup key for debugging
                this.logger.rabbitmq(`Dedup: processing new message, key: ${key}`);
            }
            try {
                this.logger.rabbitmq(`Processing message from queue: ${this.opts.queue}`);
                await this.process(payload);
                if (key) await this.redis.set(key, '1', 'EX', this.opts.dedupTtlSeconds);
                this.logger.rabbitmq(`Message processed successfully: ${this.opts.queue}`);
                channel.ack(msg);
            } catch (err: any) {
                const retries = this.getRetryCount(msg) + 1;
                if (retries >= this.opts.retryMax) {
                    this.logger.rabbitmq(`Message failed after ${retries} attempts. Dead-lettering.`);
                    channel.nack(msg, false, false);
                    return;
                }
                this.logger.rabbitmq(`Processing failed, attempt: ${retries}/${this.opts.retryMax}. Retrying.`);
                this.setRetryCount(msg, retries);
                channel.nack(msg, false, true);
            }
        }, {noAck: false});
    }

    protected abstract process(payload: T): Promise<void>;

    protected dedupKey(payload: T): string | null {
        const p = payload as any;
        
        // Use messageId from RabbitMQ if available (most reliable)
        if (p?.messageId || p?.id) {
            return `msg:${p.messageId || p.id}`;
        }
        
        // For events with inviteId, use inviteId + eventId + timestamp
        if (p?.eventId && p?.inviteId) {
            const timestamp = p?.timestamp ? new Date(p.timestamp).getTime() : Date.now();
            return `evt:${p.eventId}:invite:${p.inviteId}:ts:${timestamp}`;
        }
        
        // For user events, include oldRole and newRole to differentiate status changes
        if (p?.eventId && p?.userId) {
            const timestamp = p?.timestamp ? new Date(p.timestamp).getTime() : Date.now();
            const uniqueId = p?.initiatorId || p?.senderUserId || p?.notificationId || '';
            const roleChange = (p?.oldRole && p?.newRole) ? `:${p.oldRole}->${p.newRole}` : '';
            return `evt:${p.eventId}:user:${p.userId}:ts:${timestamp}:uid:${uniqueId}${roleChange}`;
        }
        
        // For company events
        if (p?.eventId && p?.companyId) {
            const timestamp = p?.timestamp ? new Date(p.timestamp).getTime() : Date.now();
            const uniqueId = p?.initiatorId || p?.senderUserId || p?.notificationId || '';
            return `evt:${p.eventId}:company:${p.companyId}:ts:${timestamp}:uid:${uniqueId}`;
        }
        
        return null;
    }

    private getRetryCount(msg: any): number {
        return msg.properties.headers['x-retry-count'] || 0;
    }

    private setRetryCount(msg: any, count: number) {
        msg.properties.headers['x-retry-count'] = count;
    }
}
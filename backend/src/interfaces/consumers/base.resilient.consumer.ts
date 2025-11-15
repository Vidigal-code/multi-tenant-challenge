import {Logger} from "@nestjs/common";
import {RabbitMQService} from "@infrastructure/messaging/rabbitmq.service";
import Redis from "ioredis";

interface ResilientConsumerOptions {
    queue: string;
    dlq: string;
    prefetch: number;
    retryMax: number;
    redisUrl: string;
    dedupTtlSeconds: number;
}

export abstract class BaseResilientConsumer<T = any> {
    protected readonly logger = new Logger(this.constructor.name);
    private redis: Redis;

    constructor(protected readonly rabbit: RabbitMQService, private readonly opts: ResilientConsumerOptions) {
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
        this.logger.log(`Consuming queue=${this.opts.queue} prefetch=${this.opts.prefetch}`);
        channel.consume(this.opts.queue, async (msg: any) => {
            if (!msg) return;
            const raw = msg.content.toString();
            let payload: T;
            try {
                payload = JSON.parse(raw);
            } catch (e) {
                this.logger.warn(`Invalid JSON, routing to DLQ: ${raw}`);
                channel.nack(msg, false, false); // dead-letter
                return;
            }
            const key = this.dedupKey(payload);
            if (key) {
                const exists = await this.redis.get(key);
                if (exists) {
                    this.logger.debug(`Dedup skip key=${key}`);
                    channel.ack(msg);
                    return;
                }
            }
            try {
                await this.process(payload);
                if (key) await this.redis.set(key, '1', 'EX', this.opts.dedupTtlSeconds);
                channel.ack(msg);
            } catch (err) {
                const retries = this.getRetryCount(msg) + 1;
                if (retries >= this.opts.retryMax) {
                    this.logger.error(`Message failed after ${retries} attempts. Dead-lettering.`);
                    channel.nack(msg, false, false); // DLQ
                    return;
                }
                this.logger.warn(`Processing failed attempt=${retries}. Retrying.`);
                this.setRetryCount(msg, retries);
                channel.nack(msg, false, true); // requeue
            }
        }, {noAck: false});
    }

    protected abstract process(payload: T): Promise<void>;

    protected dedupKey(payload: T): string | null {
        if ((payload as any)?.eventId && (payload as any)?.inviteId) {
            return `evt:${(payload as any).eventId}:invite:${(payload as any).inviteId}`;
        }
        if ((payload as any)?.eventId && (payload as any)?.userId) {
            return `evt:${(payload as any).eventId}:user:${(payload as any).userId}`;
        }
        if ((payload as any)?.eventId && (payload as any)?.companyId) {
            return `evt:${(payload as any).eventId}:company:${(payload as any).companyId}`;
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
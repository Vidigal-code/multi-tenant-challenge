import {Injectable, Logger, OnModuleDestroy, OnModuleInit,} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import * as amqp from "amqplib";

export const INVITE_QUEUE = "invites";

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(RabbitMQService.name);
    private connection: any | null = null;
    private channel: any | null = null;

    constructor(private readonly configService: ConfigService) {
    }

    async onModuleInit(): Promise<void> {
        const url = this.configService.get<string>("app.rabbitmqUrl") || process.env.RABBITMQ_URL;
        if (!url) {
            this.logger.warn("RabbitMQ URL not configured. Skipping connection.");
            return;
        }
        await this.connectWithRetry(url);
    }

    async onModuleDestroy(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
    }

    async assertQueue(queue: string): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        await this.channel.assertQueue(queue, {durable: true});
    }

    async sendToQueue(queue: string, content: Buffer, options?: any): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        await this.channel.sendToQueue(queue, content, {persistent: true, ...(options || {})});
    }

    async getChannel(): Promise<any> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        return this.channel;
    }

    async assertQueueWithOptions(queue: string, options: any): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        await this.channel.assertQueue(queue, {durable: true, ...(options || {})});
    }


    async assertEventQueue(queue: string, dlq: string): Promise<void> {
        await this.assertQueueWithOptions(queue, {
            deadLetterExchange: '',
            deadLetterRoutingKey: dlq,
        });
        await this.assertQueue(dlq);
    }

    async setPrefetch(prefetch: number): Promise<void> {
        if (!this.channel) throw new Error("RABBITMQ_CHANNEL_NOT_INITIALIZED");
        await this.channel.prefetch(prefetch);
    }

    private async connectWithRetry(url: string, maxAttempts = 10, delayMs = 3000) {
        let lastErr: any;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.logger.log(`Connecting to RabbitMQ (attempt ${attempt}/${maxAttempts})...`);
                this.connection = await amqp.connect(url);
                this.channel = await this.connection.createChannel();
                this.logger.log("RabbitMQ connected");
                return;
            } catch (err: any) {
                lastErr = err;
                const message = err?.message || String(err);
                this.logger.warn(`RabbitMQ connection failed: ${message}`);
                if (attempt < maxAttempts) {
                    await new Promise((res) => setTimeout(res, delayMs));
                }
            }
        }
        this.logger.error("Exhausted retries connecting to RabbitMQ");
        throw lastErr;
    }
}

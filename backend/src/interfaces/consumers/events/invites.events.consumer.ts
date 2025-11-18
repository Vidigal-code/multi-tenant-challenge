import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

const INVITES_EVENTS_QUEUE = "events.invites";
const NOTIFICATIONS_REALTIME_QUEUE = "notifications.realtimes";
const DLQ_REALTIME_NOTIFICATIONS = "dlq.notifications.realtimes";
const DLQ_INVITES = "dlq.events.invites";

class InvitesEventsConsumer extends BaseResilientConsumer<any> {
    constructor(rabbit: RabbitMQService, config: ConfigService) {
        super(rabbit, {
            queue: INVITES_EVENTS_QUEUE,
            dlq: DLQ_INVITES,
            prefetch: parseInt((config.get("app.rabbitmq.prefetch") as any) ?? "50", 10),
            retryMax: parseInt((config.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://redis:6379',
            dedupTtlSeconds: 60,
        }, config);
    }

    protected async process(payload: any): Promise<void> {
        await this.rabbit.assertQueueWithOptions(NOTIFICATIONS_REALTIME_QUEUE, {
            deadLetterExchange: '',
            deadLetterRoutingKey: DLQ_REALTIME_NOTIFICATIONS,
        });
        await this.rabbit.assertQueue(DLQ_REALTIME_NOTIFICATIONS);
        await this.rabbit.sendToQueue(
            NOTIFICATIONS_REALTIME_QUEUE,
            Buffer.from(JSON.stringify(payload)),
        );
    }
}

async function bootstrap() {
    const config = new ConfigService();
    const logger = new LoggerService("InvitesEventsConsumer", config);
    logger.default("Starting invites events consumer...");
    const rabbit = new (require("@infrastructure/messaging/services/rabbitmq.service").RabbitMQService)(config);
    await rabbit.onModuleInit();
    const consumer = new InvitesEventsConsumer(rabbit, config);
    await consumer.start();
    logger.default("Invites events consumer started.");
}

if (require.main === module) {
    bootstrap();
}

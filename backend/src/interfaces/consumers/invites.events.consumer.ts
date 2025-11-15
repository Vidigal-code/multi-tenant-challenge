import {Logger} from "@nestjs/common";
import {RabbitMQService} from "@infrastructure/messaging/rabbitmq.service";
import {BaseResilientConsumer} from "./base.resilient.consumer";
import {ConfigService} from "@nestjs/config";

const INVITES_EVENTS_QUEUE = "events.invites";
const NOTIFICATIONS_REALTIME_QUEUE = "notifications.realtime";
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
        });
    }

    protected async process(payload: any): Promise<void> {
        await this.rabbit.assertQueue(NOTIFICATIONS_REALTIME_QUEUE);
        await this.rabbit.sendToQueue(
            NOTIFICATIONS_REALTIME_QUEUE,
            Buffer.from(JSON.stringify(payload)),
        );
    }
}

async function bootstrap() {
    const logger = new Logger("InvitesEventsConsumer");
    const config = new ConfigService();
    const rabbit = new (require("@infrastructure/messaging/rabbitmq.service").RabbitMQService)(config);
    await rabbit.onModuleInit();
    const consumer = new InvitesEventsConsumer(rabbit, config);
    await consumer.start();
    logger.log("Invites events consumer started.");
}

if (require.main === module) {
    bootstrap();
}

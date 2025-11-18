import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {BaseResilientConsumer} from '../base.resilient.consumer';
import {ConfigService} from '@nestjs/config';
import {LoggerService} from '@infrastructure/logging/logger.service';

const MEMBERS_EVENTS_QUEUE = 'events.members';
const NOTIFICATIONS_REALTIME_QUEUE = 'notifications.realtimes';
const DLQ_REALTIME_NOTIFICATIONS = 'dlq.notifications.realtimes';
const DLQ_MEMBERS = 'dlq.events.members';

class MembersEventsConsumer extends BaseResilientConsumer<any> {
    constructor(rabbit: RabbitMQService, config: ConfigService) {
        super(rabbit, {
            queue: MEMBERS_EVENTS_QUEUE,
            dlq: DLQ_MEMBERS,
            prefetch: parseInt((config.get('app.rabbitmq.prefetch') as any) ?? '50', 10),
            retryMax: parseInt((config.get('app.rabbitmq.retryMax') as any) ?? '5', 10),
            redisUrl: (config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://redis:6379',
            dedupTtlSeconds: 60,
        }, config);
    }

    protected async process(payload: any): Promise<void> {
        this.logger.rabbitmq(`Processing member event: ${payload?.eventId || 'unknown'}`);
        await this.rabbit.assertQueueWithOptions(NOTIFICATIONS_REALTIME_QUEUE, {
            deadLetterExchange: '',
            deadLetterRoutingKey: DLQ_REALTIME_NOTIFICATIONS,
        });
        await this.rabbit.assertQueue(DLQ_REALTIME_NOTIFICATIONS);
        await this.rabbit.sendToQueue(
            NOTIFICATIONS_REALTIME_QUEUE,
            Buffer.from(JSON.stringify(payload)),
        );
        this.logger.rabbitmq(`Forwarded member event to ${NOTIFICATIONS_REALTIME_QUEUE}: ${payload?.eventId || 'unknown'}`);
    }
}

async function bootstrap() {
    const config = new ConfigService();
    const logger = new LoggerService('MembersEventsConsumer', config);
    logger.default('Starting members events consumer...');
    const rabbit = new RabbitMQService(config);
    await rabbit.onModuleInit();
    const consumer = new MembersEventsConsumer(rabbit, config);
    await consumer.start();
    logger.default('Members events consumer started.');
}

if (require.main === module) {
    bootstrap();
}

import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {BaseResilientConsumer} from '../base.resilient.consumer';
import {ConfigService} from '@nestjs/config';
import {LoggerService} from '@infrastructure/logging/logger.service';

const GENERIC_EVENTS_QUEUE = 'events';
const NOTIFICATIONS_REALTIME_QUEUE = 'notifications.realtimes';
const DLQ_REALTIME_NOTIFICATIONS = 'dlq.notifications.realtimes';
const DLQ_GENERIC = 'dlq.events';

class GenericEventsConsumer extends BaseResilientConsumer<any> {
    constructor(rabbit: RabbitMQService, config: ConfigService) {
        super(rabbit, {
            queue: GENERIC_EVENTS_QUEUE,
            dlq: DLQ_GENERIC,
            prefetch: parseInt((config.get('app.rabbitmq.prefetch') as any) ?? '50', 10),
            retryMax: parseInt((config.get('app.rabbitmq.retryMax') as any) ?? '5', 10),
            redisUrl: (config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://redis:6379',
            dedupTtlSeconds: 60,
        }, config);
    }

    protected async process(payload: any): Promise<void> {
        const eventName = payload?.eventName || payload?.name || '';
        
        const eventIdMapping: Record<string, string> = {
            'friend.request.sent': 'FRIEND_REQUEST_SENT',
            'friend.request.accepted': 'FRIEND_REQUEST_ACCEPTED',
            'friend.request.rejected': 'FRIEND_REQUEST_REJECTED',
            'friend.removed': 'FRIEND_REMOVED',
            'notifications.sent': 'NOTIFICATION_SENT',
            'notifications.created': 'NOTIFICATION_CREATED',
            'notifications.replied': 'NOTIFICATION_REPLIED',
        };

        if (eventIdMapping[eventName] || eventName.includes('friend') || eventName.includes('notification')) {
            const eventId = eventIdMapping[eventName] || eventName.toUpperCase().replace(/\./g, '_');
            
            const enrichedPayload = {
                ...payload,
                eventId,
            };
            
            await this.rabbit.assertQueueWithOptions(NOTIFICATIONS_REALTIME_QUEUE, {
                deadLetterExchange: '',
                deadLetterRoutingKey: DLQ_REALTIME_NOTIFICATIONS,
            });
            await this.rabbit.assertQueue(DLQ_REALTIME_NOTIFICATIONS);
            await this.rabbit.sendToQueue(
                NOTIFICATIONS_REALTIME_QUEUE,
                Buffer.from(JSON.stringify(enrichedPayload)),
            );
            this.logger.rabbitmq(`Forwarded ${eventName} to ${NOTIFICATIONS_REALTIME_QUEUE} with eventId: ${eventId}`);
        }
    }
}

async function bootstrap() {
    const config = new ConfigService();
    const logger = new LoggerService('GenericEventsConsumer', config);
    logger.default('Starting generic events consumer...');
    const rabbit = new (require('@infrastructure/messaging/services/rabbitmq.service').RabbitMQService)(config);
    await rabbit.onModuleInit();
    const consumer = new GenericEventsConsumer(rabbit, config);
    await consumer.start();
    logger.default('Generic events consumer started.');
}

if (require.main === module) {
    bootstrap();
}


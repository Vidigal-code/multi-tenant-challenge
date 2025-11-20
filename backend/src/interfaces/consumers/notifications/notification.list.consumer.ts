import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {
    NotificationListingJobPayload,
    NotificationListItem
} from "@application/dto/notifications/notification-listing.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {NotificationPrismaRepository} from "@infrastructure/prisma/notifications/notification.prisma.repository";
import {NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {NotificationListCacheService} from "@infrastructure/cache/notification-list-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {Notification} from "@domain/entities/notifications/notification.entity";
import {
    DLQ_NOTIFICATIONS_LIST_QUEUE,
    NOTIFICATIONS_LIST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";

class NotificationListConsumer extends BaseResilientConsumer<NotificationListingJobPayload> {
    private readonly notifications: NotificationRepository;

    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: NotificationListCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: NOTIFICATIONS_LIST_QUEUE,
            dlq: DLQ_NOTIFICATIONS_LIST_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
        this.notifications = new NotificationPrismaRepository(prisma);
    }

    protected async process(payload: NotificationListingJobPayload): Promise<void> {
        let cursor = 0;
        let processed = 0;

        try {
            if (!(await this.safeUpdateMeta(payload.jobId, {status: "processing", processed: 0, error: undefined}))) {
                return;
            }

            while (true) {
                const meta = await this.cache.getMeta(payload.jobId);
                if (!meta) {
                    this.logger.default(`Notification list job ${payload.jobId} no longer exists. Stopping processing.`);
                    return;
                }

                const chunk = await this.notifications.listByUserCursor(
                    payload.userId,
                    cursor,
                    payload.chunkSize
                );

                if (!chunk.length) {
                    break;
                }

                const items = this.mapNotifications(chunk);
                await this.cache.append(payload.jobId, items);
                processed += chunk.length;
                
                if (!(await this.safeUpdateMeta(payload.jobId, {processed}))) {
                    return;
                }

                const lastItem = chunk[chunk.length - 1];
                // Using ID as cursor (number)
                cursor = Number(lastItem.id);
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                processed,
                total: processed,
                finishedAt: Date.now(),
            });
        } catch (error: any) {
            const message = error?.message || "NOTIFICATION_LIST_JOB_FAILED";
            this.logger.error(`Notification list job failed: ${payload.jobId} - ${message}`);
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private mapNotifications(notifications: Notification[]): NotificationListItem[] {
        return notifications.map(n => ({
            id: String(n.id),
            companyId: n.companyId || '',
            senderUserId: n.senderUserId,
            recipientUserId: n.recipientUserId || '',
            title: n.title,
            body: n.body,
            createdAt: n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
            read: n.read,
            meta: n.meta,
            sender: n.meta?.sender ? {
                id: n.meta.sender.id,
                name: n.meta.sender.name,
                email: n.meta.sender.email,
            } : undefined
        }));
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.updateMeta(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("NOTIFICATION_LIST_JOB_NOT_FOUND")) {
                this.logger.default(`Notification list job ${jobId} discarded before completion.`);
                return false;
            }
            throw error;
        }
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("NotificationListConsumerBootstrap", configService);
    logger.default("Starting notification list consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new NotificationListCacheService(configService);
    const consumer = new NotificationListConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("Notification list consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down notification list consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


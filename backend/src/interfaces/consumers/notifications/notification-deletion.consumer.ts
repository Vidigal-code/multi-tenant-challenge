import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {NotificationDeletionJobPayload} from "@application/dto/notifications/notification-deletion.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {NotificationDeletionCacheService} from "@infrastructure/cache/notification-deletion-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {
    DLQ_NOTIFICATIONS_DELETE_QUEUE,
    NOTIFICATIONS_DELETE_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";

@Injectable()
export class NotificationDeletionConsumer extends BaseResilientConsumer<NotificationDeletionJobPayload> {
    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: NotificationDeletionCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: NOTIFICATIONS_DELETE_QUEUE,
            dlq: DLQ_NOTIFICATIONS_DELETE_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    protected async process(payload: NotificationDeletionJobPayload): Promise<void> {
        this.logger.default(`Processing notification deletion job: ${payload.jobId} for user ${payload.userId}`);
        
        try {
            if (!(await this.safeUpdateMeta(payload.jobId, {status: "processing", deletedCount: 0, error: undefined}))) {
                return;
            }

            let deletedCount = 0;

            if (payload.deleteAll) {
                const result = await (this.prisma as any).notification.deleteMany({
                    where: {
                        recipientUserId: payload.userId
                    }
                });
                deletedCount = result.count;
            } else if (payload.ids && payload.ids.length > 0) {
                const ids = payload.ids.map(id => Number(id)).filter(id => !isNaN(id));
                
                if (ids.length > 0) {
                    const result = await (this.prisma as any).notification.deleteMany({
                        where: {
                            id: { in: ids },
                            recipientUserId: payload.userId
                        }
                    });
                    deletedCount = result.count;
                }
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                deletedCount,
                finishedAt: Date.now(),
            });
            
            this.logger.default(`Notification deletion job ${payload.jobId} completed. Deleted: ${deletedCount}`);
        } catch (error: any) {
            const message = error?.message || "NOTIFICATION_DELETE_JOB_FAILED";
            this.logger.error(`Notification deletion job failed: ${payload.jobId} - ${message}`);
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.updateMeta(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("NOTIFICATION_DELETE_JOB_NOT_FOUND")) {
                this.logger.default(`Notification deletion job ${jobId} discarded/not found.`);
                return false;
            }
            this.logger.error(`Failed to update meta for job ${jobId}: ${error.message}`);
            return true; 
        }
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("NotificationDeletionConsumerBootstrap", configService);
    logger.default("Starting notification deletion consumer...");
    
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    
    const cache = new NotificationDeletionCacheService(configService);
    
    const consumer = new NotificationDeletionConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    
    logger.default("Notification deletion consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down notification deletion consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


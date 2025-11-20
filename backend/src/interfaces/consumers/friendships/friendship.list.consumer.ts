import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {
    FriendshipListingJobPayload,
    FriendshipListItem
} from "@application/dto/friendships/friendship-listing.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {FriendshipPrismaRepository} from "@infrastructure/prisma/friendships/friendship.prisma.repository";
import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";
import {FriendshipListCacheService} from "@infrastructure/cache/friendship-list-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {
    DLQ_FRIENDSHIPS_LIST_QUEUE,
    FRIENDSHIPS_LIST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";

class FriendshipListConsumer extends BaseResilientConsumer<FriendshipListingJobPayload> {
    private readonly friendships: FriendshipRepository;

    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: FriendshipListCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: FRIENDSHIPS_LIST_QUEUE,
            dlq: DLQ_FRIENDSHIPS_LIST_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
        this.friendships = new FriendshipPrismaRepository(prisma);
    }

    protected async process(payload: FriendshipListingJobPayload): Promise<void> {
        let cursor: string | undefined = undefined;
        let processed = 0;

        try {
            if (!(await this.safeUpdateMeta(payload.jobId, {status: "processing", processed: 0, error: undefined}))) {
                return;
            }

            while (true) {
                const meta = await this.cache.getMeta(payload.jobId);
                if (!meta) {
                    this.logger.default(`Friendship list job ${payload.jobId} no longer exists. Stopping processing.`);
                    return;
                }

                const chunk: any[] = await (this.friendships as any).listByUserCursor({
                    userId: payload.userId,
                    status: payload.status as FriendshipStatus,
                    cursor,
                    limit: payload.chunkSize
                });

                if (!chunk.length) {
                    break;
                }

                const items = this.mapFriendships(chunk, payload.userId);
                await this.cache.append(payload.jobId, items);
                processed += chunk.length;
                
                if (!(await this.safeUpdateMeta(payload.jobId, {processed}))) {
                    return;
                }

                const lastItem = chunk[chunk.length - 1];
                cursor = lastItem.id;
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                processed,
                total: processed,
                finishedAt: Date.now(),
            });
        } catch (error: any) {
            const message = error?.message || "FRIENDSHIP_LIST_JOB_FAILED";
            this.logger.error(`Friendship list job failed: ${payload.jobId} - ${message}`);
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private mapFriendships(friendships: any[], currentUserId: string): FriendshipListItem[] {
        return friendships.map(f => {
            const friend = f.requesterId === currentUserId ? f.addressee : f.requester;
            return {
                id: f.id,
                requesterId: f.requesterId,
                addresseeId: f.addresseeId,
                status: f.status,
                createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : f.createdAt,
                updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : f.updatedAt,
                friend: friend ? {
                    id: friend.id,
                    name: friend.name,
                    email: friend.email,
                } : undefined
            };
        });
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.updateMeta(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("FRIENDSHIP_LIST_JOB_NOT_FOUND")) {
                this.logger.default(`Friendship list job ${jobId} discarded before completion.`);
                return false;
            }
            throw error;
        }
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("FriendshipListConsumerBootstrap", configService);
    logger.default("Starting friendship list consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new FriendshipListCacheService(configService);
    const consumer = new FriendshipListConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("Friendship list consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down friendship list consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


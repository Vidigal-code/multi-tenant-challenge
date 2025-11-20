import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {
    UserSearchJobPayload,
    UserSearchItem
} from "@application/dto/users/user-search.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {UserPrismaRepository} from "@infrastructure/prisma/users/user.prisma.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {UserSearchCacheService} from "@infrastructure/cache/user-search-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {User} from "@domain/entities/users/user.entity";
import {
    DLQ_USER_SEARCH_QUEUE,
    USER_SEARCH_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";

class UserSearchConsumer extends BaseResilientConsumer<UserSearchJobPayload> {
    private readonly users: UserRepository;

    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: UserSearchCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: USER_SEARCH_QUEUE,
            dlq: DLQ_USER_SEARCH_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
        this.users = new UserPrismaRepository(prisma);
    }

    protected async process(payload: UserSearchJobPayload): Promise<void> {
        let cursor: string | undefined = undefined;
        let processed = 0;

        try {
            if (!(await this.safeUpdateMeta(payload.jobId, {status: "processing", processed: 0, error: undefined}))) {
                return;
            }

            while (true) {
                const [meta] = await Promise.all([this.cache.getMeta(payload.jobId)]);
                if (!meta) {
                    this.logger.default(`User search job ${payload.jobId} no longer exists. Stopping processing.`);
                    return;
                }

                const chunk: User[] = await (this.users as any).searchByNameOrEmailCursor(
                    payload.query,
                    payload.userId,
                    cursor,
                    payload.chunkSize
                );

                if (!chunk.length) {
                    break;
                }

                const items = this.mapUsers(chunk);
                await this.cache.append(payload.jobId, items);
                processed += chunk.length;
                
                if (!(await this.safeUpdateMeta(payload.jobId, {processed}))) {
                    return;
                }

                const lastItem: User = chunk[chunk.length - 1];
                cursor = lastItem.id;
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                processed,
                total: processed,
                finishedAt: Date.now(),
            });
        } catch (error: any) {
            const message = error?.message || "USER_SEARCH_JOB_FAILED";
            this.logger.error(`User search job failed: ${payload.jobId} - ${message}`);
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private mapUsers(users: User[]): UserSearchItem[] {
        return users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email.toString(),
        }));
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.updateMeta(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("USER_SEARCH_JOB_NOT_FOUND")) {
                this.logger.default(`User search job ${jobId} discarded before completion.`);
                return false;
            }
            throw error;
        }
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("UserSearchConsumerBootstrap", configService);
    logger.default("Starting user search consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new UserSearchCacheService(configService);
    const consumer = new UserSearchConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("User search consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down user search consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


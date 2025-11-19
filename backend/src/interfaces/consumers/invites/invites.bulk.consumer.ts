import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {InvitePrismaRepository} from "@infrastructure/prisma/invites/invite.prisma.repository";
import {InviteRepository, InviteListCursor} from "@domain/repositories/invites/invite.repository";
import {InviteBulkCacheService} from "@infrastructure/cache/invite-bulk-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {InviteBulkJobPayload} from "@application/services/invite-bulk-jobs.service";
import {DLQ_INVITES_BULK_QUEUE, INVITES_BULK_QUEUE} from "@infrastructure/messaging/constants/queue.constants";
import {InviteStatus} from "@domain/enums/invite-status.enum";

class InviteBulkConsumer extends BaseResilientConsumer<InviteBulkJobPayload> {
    private readonly invites: InviteRepository;

    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: InviteBulkCacheService,
        configService: ConfigService,
    ) {
        super(
            rabbit,
            {
                queue: INVITES_BULK_QUEUE,
                dlq: DLQ_INVITES_BULK_QUEUE,
                prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
                retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
                redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
                dedupTtlSeconds: 60,
            },
            configService,
        );
        this.invites = new InvitePrismaRepository(prisma);
    }

    protected async process(payload: InviteBulkJobPayload): Promise<void> {
        let processed = 0;
        let failed = 0;
        try {
            await this.cache.update(payload.jobId, {status: "processing", processed: 0, failedCount: 0, error: undefined});
            if (payload.scope === "selected") {
                const normalized = await this.filterSelected(payload);
                failed = (payload.inviteIds?.length ?? 0) - normalized.length;
                processed += await this.processChunk(normalized, payload);
            } else {
                processed += await this.processAll(payload);
            }
            await this.cache.update(payload.jobId, {
                status: "completed",
                processed,
                total: processed + failed,
                failedCount: failed,
                finishedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            const message = error?.message || "INVITE_BULK_JOB_FAILED";
            this.logger.error(`Invite bulk job failed: ${payload.jobId} - ${message}`);
            await this.cache.update(payload.jobId, {
                status: "failed",
                error: message,
                processed,
                failedCount: failed,
                finishedAt: new Date().toISOString(),
            });
            throw error;
        }
    }

    private async processChunk(inviteIds: string[], payload: InviteBulkJobPayload): Promise<number> {
        const chunks = this.chunk(inviteIds, payload.chunkSize);
        let processed = 0;
        for (const chunk of chunks) {
            if (!chunk.length) continue;
            if (payload.action === "delete") {
                await this.invites.deleteMany(chunk);
            } else {
                await this.invites.updateStatusBulk(chunk, InviteStatus.REJECTED);
            }
            processed += chunk.length;
            await this.cache.update(payload.jobId, {processed});
        }
        return processed;
    }

    private async processAll(payload: InviteBulkJobPayload): Promise<number> {
        let cursor: InviteListCursor | undefined;
        let processed = 0;
        while (true) {
            const page = payload.target === "created"
                ? await this.invites.listByInviterCursor({
                    inviterId: payload.userId,
                    cursor,
                    limit: payload.chunkSize,
                })
                : await this.invites.listByEmailCursor({
                    email: payload.userEmail!,
                    cursor,
                    limit: payload.chunkSize,
                });
            if (!page.data.length) {
                break;
            }
            const ids = page.data.map((invite) => invite.id);
            if (payload.action === "delete") {
                await this.invites.deleteMany(ids);
            } else {
                await this.invites.updateStatusBulk(ids, InviteStatus.REJECTED);
            }
            processed += ids.length;
            await this.cache.update(payload.jobId, {processed, total: processed});
            if (!page.nextCursor) {
                break;
            }
            cursor = page.nextCursor;
        }
        return processed;
    }

    private async filterSelected(payload: InviteBulkJobPayload): Promise<string[]> {
        const ids = payload.inviteIds ?? [];
        if (!ids.length) return [];
        const invites: Array<{ id: string }> = await this.prisma.invite.findMany({
            where: {
                id: {in: ids},
                ...(payload.action === "delete"
                    ? {inviterId: payload.userId}
                    : {email: payload.userEmail}),
            },
            select: {id: true},
        });
        return invites.map((invite) => invite.id);
    }

    private chunk<T>(items: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("InviteBulkConsumerBootstrap", configService);
    logger.default("Starting invite bulk consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new InviteBulkCacheService(configService);
    const consumer = new InviteBulkConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("Invite bulk consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down invite bulk consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


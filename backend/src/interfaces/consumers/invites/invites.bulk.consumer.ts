import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {InviteBulkJobPayload} from "@application/dto/invites/invite-bulk.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {InviteBulkCacheService} from "@infrastructure/cache/invite-bulk-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {InviteStatus} from "@domain/enums/invite-status.enum";

const INVITES_BULK_QUEUE = "invites.bulk.requests";
const DLQ_INVITES_BULK_QUEUE = "dlq.invites.bulk.requests";

interface InviteCursor {
    id: string;
}

class InviteBulkConsumer extends BaseResilientConsumer<InviteBulkJobPayload> {
    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: InviteBulkCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: INVITES_BULK_QUEUE,
            dlq: DLQ_INVITES_BULK_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    protected async process(payload: InviteBulkJobPayload): Promise<void> {
        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        await this.safeUpdateMeta(payload.jobId, {status: "processing", processed, succeeded, failed, error: undefined});
        try {
            if (payload.scope === "selected" && payload.inviteIds) {
                const chunks = this.splitIntoChunks(payload.inviteIds, payload.chunkSize);
                for (const ids of chunks) {
                    const invites = await this.prisma.invite.findMany({
                        where: {id: {in: ids}},
                    });
                    const result = await this.handleInvites(invites, payload);
                    processed += result.total;
                    succeeded += result.succeeded;
                    failed += result.failed;
                    const shouldContinue = await this.safeUpdateMeta(payload.jobId, {processed, succeeded, failed});
                    if (!shouldContinue) return;
                }
            } else if (payload.scope === "all") {
                let cursor: InviteCursor | undefined;
                while (true) {
                    const page = await this.fetchInvitesPage(payload, cursor);
                    if (!page.segment.length) break;
                    const result = await this.handleInvites(page.segment, payload);
                    processed += result.total;
                    succeeded += result.succeeded;
                    failed += result.failed;
                    const shouldContinue = await this.safeUpdateMeta(payload.jobId, {processed, succeeded, failed});
                    if (!shouldContinue) return;
                    if (!page.nextCursor) break;
                    cursor = page.nextCursor;
                }
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                processed,
                succeeded,
                failed,
                finishedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                processed,
                succeeded,
                failed,
                error: error?.message || "INVITE_BULK_JOB_FAILED",
                finishedAt: new Date().toISOString(),
            });
            throw error;
        }
    }

    private splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
        const result: T[][] = [];
        for (let i = 0; i < items.length; i += chunkSize) {
            result.push(items.slice(i, i + chunkSize));
        }
        return result;
    }

    private async fetchInvitesPage(
        payload: InviteBulkJobPayload,
        cursor?: InviteCursor,
    ): Promise<{segment: any[]; nextCursor?: InviteCursor}> {
        const where = payload.action === "delete"
            ? {inviterId: payload.userId}
            : {
                email: payload.userEmail,
            };
        const rows = await this.prisma.invite.findMany({
            where,
            orderBy: [{createdAt: "desc"}, {id: "desc"}],
            take: payload.chunkSize + 1,
            ...(cursor ? {cursor: {id: cursor.id}, skip: 1} : {}),
        });
        if (!rows.length) {
            return {segment: []};
        }
        const hasMore = rows.length > payload.chunkSize;
        const segment = hasMore ? rows.slice(0, payload.chunkSize) : rows;
        const nextCursor = hasMore ? {id: segment[segment.length - 1].id} : undefined;
        return {segment, nextCursor};
    }

    private async handleInvites(records: any[], payload: InviteBulkJobPayload): Promise<{total: number;
        succeeded: number; failed: number}> {
        let succeeded = 0;
        let failed = 0;
        for (const invite of records) {
            const ok = await this.applyAction(invite, payload);
            if (ok) {
                succeeded++;
            } else {
                failed++;
            }
        }
        return {total: records.length, succeeded, failed};
    }

    private async applyAction(invite: any, payload: InviteBulkJobPayload): Promise<boolean> {
        if (payload.action === "delete") {
            if (invite.inviterId !== payload.userId) return false;
            try {
                await this.prisma.invite.delete({where: {id: invite.id}});
                return true;
            } catch {
                return false;
            }
        } else {
            const inviteEmail = invite.email?.toLowerCase?.() ?? invite.email;
            if (!payload.userEmail || inviteEmail !== payload.userEmail.toLowerCase()) return false;
            if (invite.status !== InviteStatus.PENDING) return false;
            try {
                await this.prisma.invite.update({
                    where: {id: invite.id},
                    data: {status: InviteStatus.REJECTED},
                });
                return true;
            } catch {
                return false;
            }
        }
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.update(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("INVITE_BULK_JOB_NOT_FOUND")) {
                this.logger.default(`Invite bulk job ${jobId} discarded before completion.`);
                return false;
            }
            throw error;
        }
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


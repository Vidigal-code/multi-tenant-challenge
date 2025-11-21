import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {InviteListJobPayload, InviteListItem} from "@application/dto/invites/invite-listing.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {InvitePrismaRepository} from "@infrastructure/prisma/invites/invite.prisma.repository";
import {InviteRepository, InviteListCursor} from "@domain/repositories/invites/invite.repository";
import {InviteListCacheService} from "@infrastructure/cache/invite-list-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {Invite} from "@domain/entities/invites/invite.entity";

const INVITES_LIST_QUEUE = "invites.list.requests";
const INVITES_LIST_DLQ = "dlq.invites.list.requests";

class InviteListConsumer extends BaseResilientConsumer<InviteListJobPayload> {
    private readonly invites: InviteRepository;
    private readonly frontendBase: string;

    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: InviteListCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: INVITES_LIST_QUEUE,
            dlq: INVITES_LIST_DLQ,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
        this.invites = new InvitePrismaRepository(prisma);
        this.frontendBase =
            (configService.get("app.frontendBaseUrl") as string) ||
            process.env.FRONTEND_BASE_URL ||
            "http://localhost:3000";
    }

    protected async process(payload: InviteListJobPayload): Promise<void> {
        if (payload.type === "received" && !payload.userEmail) {
            throw new Error("INVITE_LIST_INVALID_PAYLOAD");
        }
        let cursor: InviteListCursor | undefined;
        let processed = 0;
        try {
            if (!(await this.safeUpdateMeta(payload.jobId, {status: "processing", processed: 0, error: undefined}))) {
                return;
            }
            while (true) {
                const meta = await this.cache.getMeta(payload.jobId);
                if (!meta) {
                    this.logger.default(`Invite list job ${payload.jobId} no longer exists. Stopping processing.`);
                    return;
                }

                const page = payload.type === "received"
                    ? await this.invites.listByEmailCursor({
                        email: payload.userEmail!,
                        cursor,
                        limit: payload.chunkSize,
                    })
                    : await this.invites.listByInviterCursor({
                        inviterId: payload.userId,
                        cursor,
                        limit: payload.chunkSize,
                    });

                if (!page.data.length) {
                    break;
                }

                const enriched = await this.enrichInvites(page.data, payload);
                await this.cache.append(payload.jobId, enriched);
                processed += page.data.length;
                if (!(await this.safeUpdateMeta(payload.jobId, {processed}))) {
                    return;
                }
                if (!page.nextCursor) {
                    break;
                }
                cursor = page.nextCursor;
            }

            await this.safeUpdateMeta(payload.jobId, {
                status: "completed",
                processed,
                total: processed,
                finishedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            const message = error?.message || "INVITE_LIST_JOB_FAILED";
            this.logger.error(`Invite list job failed: ${payload.jobId} - ${message}`);
            await this.safeUpdateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: new Date().toISOString(),
            });
            throw error;
        }
    }

    private async enrichInvites(invites: Invite[], payload: InviteListJobPayload): Promise<InviteListItem[]> {
        const emailStrings = invites.map((invite) => invite.email.toString());
        const companyIds = Array.from(new Set(invites.map((invite) => invite.companyId)));
        const inviterIds = Array.from(new Set(invites.map((invite) => invite.inviterId).filter(Boolean)));
        const recipientEmails =
            payload.type === "created"
                ? Array.from(new Set(emailStrings.map((email) => email.toLowerCase())))
                : [];

        const [companies, inviters, recipients] = await Promise.all([
            companyIds.length
                ? this.prisma.company.findMany({
                    where: {id: {in: companyIds}},
                    select: {id: true, name: true, description: true, logoUrl: true},
                })
                : [],
            inviterIds.length
                ? this.prisma.user.findMany({
                    where: {id: {in: inviterIds}},
                    select: {id: true, name: true, email: true},
                })
                : [],
            recipientEmails.length
                ? this.prisma.user.findMany({
                    where: {email: {in: recipientEmails}},
                    select: {id: true, name: true, email: true},
                })
                : [],
        ]);

        const companyMap = new Map(companies.map((c) => [c.id, c]));
        const inviterMap = new Map(inviters.map((user) => [user.id, user]));
        const recipientMap = new Map(recipients.map((user) => [user.email.toLowerCase(), user]));

        return invites.map((invite) => {
            const email = invite.email.toString();
            const company = companyMap.get(invite.companyId);
            const inviter = invite.inviterId ? inviterMap.get(invite.inviterId) : undefined;
            const recipient =
                payload.type === "created"
                    ? recipientMap.get(email.toLowerCase())
                    : undefined;
            return {
                id: invite.id,
                companyId: invite.companyId,
                email,
                role: invite.role,
                status: invite.status,
                token: invite.token,
                inviterId: invite.inviterId ?? null,
                inviterName: inviter?.name ?? null,
                inviterEmail: inviter?.email ?? null,
                recipientName: recipient?.name ?? null,
                recipientEmail: payload.type === "created" ? email : null,
                inviteUrl: payload.type === "created" ? `${this.frontendBase}/invite/${invite.token}` : null,
                createdAt: invite.createdAt.toISOString(),
                expiresAt: invite.expiresAt.toISOString(),
                name: company?.name ?? null,
                description: company?.description ?? null,
                logoUrl: company?.logoUrl ?? null,
            };
        });
    }

    private async safeUpdateMeta(jobId: string, patch: Record<string, any>): Promise<boolean> {
        try {
            await this.cache.updateMeta(jobId, patch);
            return true;
        } catch (error: any) {
            if (String(error?.message || "").includes("INVITE_LIST_JOB_NOT_FOUND")) {
                this.logger.default(`Invite list job ${jobId} discarded before completion.`);
                return false;
            }
            throw error;
        }
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("InviteListConsumerBootstrap", configService);
    logger.default("Starting invite list consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new InviteListCacheService(configService);
    const consumer = new InviteListConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("Invite list consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down invite list consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


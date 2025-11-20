import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {
    CompanyListingItem,
    CompanyListingJobPayload,
} from "@application/dto/companys/company-listing.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {CompanyListCacheService} from "@infrastructure/cache/company-list-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {Role} from "@domain/enums/role.enum";

const COMPANIES_LIST_QUEUE = "companies.list.requests";
const DLQ_COMPANIES_LIST_QUEUE = "dlq.companies.list.requests";

interface MembershipCursor {
    id: string;
}

class CompanyListConsumer extends BaseResilientConsumer<CompanyListingJobPayload> {
    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: CompanyListCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: COMPANIES_LIST_QUEUE,
            dlq: DLQ_COMPANIES_LIST_QUEUE,
            prefetch: parseInt((configService.get("app.rabbitmq.prefetch") as any) ?? "5", 10),
            retryMax: parseInt((configService.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    protected async process(payload: CompanyListingJobPayload): Promise<void> {
        let cursor: MembershipCursor | undefined;
        let processed = 0;
        try {
            await this.cache.updateMeta(payload.jobId, {status: "processing", processed: 0, error: undefined});
        } catch {
            // if meta not found, nothing to do
        }

        while (true) {
            const page = await this.fetchMemberships(payload.userId, payload.chunkSize, cursor);
            if (!page.segment.length) {
                break;
            }
            const items = await this.buildItems(page.segment, payload);
            if (items.length) {
                await this.cache.append(payload.jobId, items);
                processed += items.length;
                try {
                    await this.cache.updateMeta(payload.jobId, {processed});
                } catch (error: any) {
                    if (String(error?.message || "").includes("COMPANY_LIST_JOB_NOT_FOUND")) {
                        this.logger.default(`Company list job ${payload.jobId} discarded before completion.`);
                        return;
                    }
                    throw error;
                }
            }
            if (!page.nextCursor) {
                break;
            }
            cursor = page.nextCursor;
        }

        try {
            await this.cache.updateMeta(payload.jobId, {
                status: "completed",
                processed,
                total: processed,
                finishedAt: new Date().toISOString(),
            });
        } catch (error: any) {
            if (!String(error?.message || "").includes("COMPANY_LIST_JOB_NOT_FOUND")) {
                throw error;
            }
        }
    }

    private async fetchMemberships(
        userId: string,
        chunkSize: number,
        cursor?: MembershipCursor,
    ): Promise<{segment: Array<{ id: string; companyId: string; role: Role; createdAt: Date }>; nextCursor?: MembershipCursor}> {
        const rows = await this.prisma.membership.findMany({
            where: {userId},
            orderBy: [{createdAt: "desc"}, {id: "desc"}],
            take: chunkSize + 1,
            ...(cursor ? {cursor: {id: cursor.id}, skip: 1} : {}),
        });
        if (!rows.length) {
            return {segment: []};
        }
        const hasMore = rows.length > chunkSize;
        const segment = hasMore ? rows.slice(0, chunkSize) : rows;
        const nextCursor = hasMore ? {id: segment[segment.length - 1].id} : undefined;
        return {
            segment: segment.map((row) => ({
                id: row.id,
                companyId: row.companyId,
                role: row.role as Role,
                createdAt: row.createdAt,
            })),
            nextCursor,
        };
    }

    private async buildItems(
        memberships: Array<{ id: string; companyId: string; role: Role; createdAt: Date }>,
        payload: CompanyListingJobPayload,
    ): Promise<CompanyListingItem[]> {
        const companyIds = Array.from(new Set(memberships.map((m) => m.companyId)));
        if (!companyIds.length) {
            return [];
        }
        const [companies, ownerMemberships, memberCounts] = await Promise.all([
            this.prisma.company.findMany({
                where: {id: {in: companyIds}},
            }),
            this.prisma.membership.findMany({
                where: {
                    companyId: {in: companyIds},
                    role: Role.OWNER,
                },
                orderBy: [{companyId: "asc"}, {createdAt: "asc"}],
            }),
            this.prisma.membership.groupBy({
                by: ["companyId"],
                where: {companyId: {in: companyIds}},
                _count: {companyId: true},
            }),
        ]);

        const companyMap = new Map(companies.map((company) => [company.id, company]));
        const memberCountMap = new Map(memberCounts.map((group) => [group.companyId, group._count.companyId]));

        const primaryOwnerMembershipMap = new Map<string, { userId: string; createdAt: Date }>();
        for (const owner of ownerMemberships) {
            if (!primaryOwnerMembershipMap.has(owner.companyId)) {
                primaryOwnerMembershipMap.set(owner.companyId, {userId: owner.userId, createdAt: owner.createdAt});
            }
        }
        const ownerUserIds = Array.from(new Set(Array.from(primaryOwnerMembershipMap.values()).map((entry) => entry.userId)));
        const ownerUsers = ownerUserIds.length
            ? await this.prisma.user.findMany({
                where: {id: {in: ownerUserIds}},
                select: {id: true, name: true, email: true},
            })
            : [];
        const ownerUserMap = new Map(ownerUsers.map((user) => [user.id, user]));

        const items: CompanyListingItem[] = [];
        for (const membership of memberships) {
            const primaryOwner = primaryOwnerMembershipMap.get(membership.companyId);
            if (!primaryOwner) continue;
            const isPrimaryOwner = primaryOwner.userId === payload.userId;
            if (payload.type === "primary-owner" && !isPrimaryOwner) continue;
            if (payload.type === "member" && isPrimaryOwner) continue;

            const company = companyMap.get(membership.companyId);
            if (!company) continue;
            const ownerUser = ownerUserMap.get(primaryOwner.userId);
            items.push({
                id: company.id,
                name: company.name,
                logoUrl: company.logoUrl,
                description: company.description,
                isPublic: company.isPublic,
                createdAt: company.createdAt instanceof Date ? company.createdAt.toISOString() : new Date(company.createdAt).toISOString(),
                memberCount: memberCountMap.get(company.id) ?? 0,
                primaryOwnerName: ownerUser?.name ?? "N/A",
                primaryOwnerEmail: ownerUser?.email?.toString() ?? "N/A",
                userRole: payload.type === "member" ? membership.role : undefined,
            });
        }
        return items;
    }
}

async function bootstrap() {
    const configService = new ConfigService();
    const logger = new LoggerService("CompanyListConsumerBootstrap", configService);
    logger.default("Starting company list consumer...");
    const rabbit = new RabbitMQService(configService);
    await rabbit.onModuleInit();
    const prisma = new PrismaService(configService);
    await prisma.onModuleInit();
    const cache = new CompanyListCacheService(configService);
    const consumer = new CompanyListConsumer(rabbit, prisma, cache, configService);
    await consumer.start();
    logger.default("Company list consumer started.");

    const shutdown = async () => {
        logger.default("Shutting down company list consumer...");
        await prisma.onModuleDestroy();
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}

if (require.main === module) {
    bootstrap();
}


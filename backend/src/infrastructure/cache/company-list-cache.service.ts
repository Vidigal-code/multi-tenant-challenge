import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {CompanyListingItem, CompanyListingJobMeta} from "@application/dto/companys/company-listing.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class CompanyListCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(CompanyListCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.companyListing.redisTtlSeconds") as number) ??
            parseInt(process.env.COMPANY_LIST_REDIS_TTL ?? "3600", 10);
        this.ttlSeconds = Math.max(60, ttl);
    }

    /**
     *
     * EN:
     * Initializes metadata for company listing jobs, cleaning previous entries and setting TTL.
     *
     * PT:
     * Inicializa os metadados dos jobs de listagem de empresas, removendo registros anteriores e aplicando TTL.
     *
     * @params meta
     * @returns Promise<void>
     */
    async initializeJob(meta: CompanyListingJobMeta): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(this.metaKey(meta.jobId));
        pipeline.del(this.dataKey(meta.jobId));
        pipeline.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        pipeline.expire(this.dataKey(meta.jobId), this.ttlSeconds);
        await pipeline.exec();
        this.logger.default(`Company list job initialized: ${meta.jobId}`);
    }

    async getMeta(jobId: string): Promise<CompanyListingJobMeta | null> {
        const raw = await this.redis.get(this.metaKey(jobId));
        return raw ? (JSON.parse(raw) as CompanyListingJobMeta) : null;
    }

    async updateMeta(jobId: string, patch: Partial<CompanyListingJobMeta>): Promise<CompanyListingJobMeta> {
        const current = await this.getMeta(jobId);
        if (!current) {
            throw new Error(`COMPANY_LIST_JOB_NOT_FOUND:${jobId}`);
        }
        const merged = {...current, ...patch};
        await this.redis.set(this.metaKey(jobId), JSON.stringify(merged), "EX", this.ttlSeconds);
        return merged;
    }

    async append(jobId: string, items: CompanyListingItem[]): Promise<void> {
        if (!items.length) {
            await this.redis.expire(this.dataKey(jobId), this.ttlSeconds);
            return;
        }
        const payloads = items.map((item) => JSON.stringify(item));
        const pipeline = this.redis.pipeline();
        pipeline.rpush(this.dataKey(jobId), ...payloads);
        pipeline.expire(this.dataKey(jobId), this.ttlSeconds);
        await pipeline.exec();
    }

    async getItems(jobId: string, cursor: number, limit: number): Promise<{
        items: CompanyListingItem[];
        nextCursor: number | null;
        total: number;
    }> {
        const normalizedCursor = Math.max(0, cursor);
        const normalizedLimit = Math.max(1, limit);
        const maxIndex = normalizedCursor + normalizedLimit - 1;
        const key = this.dataKey(jobId);
        const [rawItems, total] = await Promise.all([
            this.redis.lrange(key, normalizedCursor, maxIndex),
            this.redis.llen(key),
        ]);
        const parsed = rawItems.map((value) => JSON.parse(value) as CompanyListingItem);
        const nextCursor = normalizedCursor + parsed.length;
        await this.redis.expire(this.dataKey(jobId), this.ttlSeconds);
        return {
            items: parsed,
            nextCursor: normalizedCursor + parsed.length >= total ? null : nextCursor,
            total,
        };
    }

    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId), this.dataKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `companies:list:${jobId}:meta`;
    }

    private dataKey(jobId: string): string {
        return `companies:list:${jobId}:data`;
    }
}

export const companyListCacheProvider = {
    provide: CompanyListCacheService,
    useClass: CompanyListCacheService,
};


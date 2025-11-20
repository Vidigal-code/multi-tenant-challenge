import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {UserSearchItem, UserSearchJobMeta} from "@application/dto/users/user-search.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class UserSearchCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(UserSearchCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.userSearch.redisTtlSeconds") as number) ??
            parseInt(process.env.USER_SEARCH_REDIS_TTL ?? "300", 10);
        this.ttlSeconds = Math.max(60, ttl);
    }

    async initializeJob(meta: UserSearchJobMeta): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(this.metaKey(meta.jobId));
        pipeline.del(this.dataKey(meta.jobId));
        pipeline.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        pipeline.expire(this.dataKey(meta.jobId), this.ttlSeconds);
        await pipeline.exec();
        this.logger.default(`User search job initialized: ${meta.jobId}`);
    }

    async getMeta(jobId: string): Promise<UserSearchJobMeta | null> {
        const data = await this.redis.get(this.metaKey(jobId));
        return data ? (JSON.parse(data) as UserSearchJobMeta) : null;
    }

    async updateMeta(jobId: string, patch: Partial<UserSearchJobMeta>): Promise<UserSearchJobMeta> {
        const current = (await this.getMeta(jobId)) ?? null;
        if (!current) {
            throw new Error(`USER_SEARCH_JOB_NOT_FOUND:${jobId}`);
        }
        const next: UserSearchJobMeta = {
            ...current,
            ...patch,
        };
        await this.redis.set(this.metaKey(jobId), JSON.stringify(next), "EX", this.ttlSeconds);
        return next;
    }

    async append(jobId: string, items: UserSearchItem[]): Promise<void> {
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
        items: UserSearchItem[];
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
        const parsed = rawItems.map((value) => JSON.parse(value) as UserSearchItem);
        const nextCursor = normalizedCursor + parsed.length;
        await this.redis.expire(this.dataKey(jobId), this.ttlSeconds);
        return {items: parsed, nextCursor, total};
    }

    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId), this.dataKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `users:search:${jobId}:meta`;
    }

    private dataKey(jobId: string): string {
        return `users:search:${jobId}:data`;
    }
}

export const userSearchCacheProvider = {
    provide: UserSearchCacheService,
    useClass: UserSearchCacheService,
};


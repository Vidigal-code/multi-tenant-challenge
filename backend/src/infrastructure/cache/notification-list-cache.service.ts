import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {NotificationListItem, NotificationListJobMeta} from "@application/dto/notifications/notification-listing.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class NotificationListCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(NotificationListCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.notificationListing.redisTtlSeconds") as number) ??
            parseInt(process.env.NOTIFICATIONS_LIST_REDIS_TTL ?? "3600", 10);
        this.ttlSeconds = Math.max(60, ttl);
    }

    async initializeJob(meta: NotificationListJobMeta): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(this.metaKey(meta.jobId));
        pipeline.del(this.dataKey(meta.jobId));
        pipeline.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        pipeline.expire(this.dataKey(meta.jobId), this.ttlSeconds);
        await pipeline.exec();
        this.logger.default(`Notification list job initialized: ${meta.jobId}`);
    }

    async getMeta(jobId: string): Promise<NotificationListJobMeta | null> {
        const data = await this.redis.get(this.metaKey(jobId));
        return data ? (JSON.parse(data) as NotificationListJobMeta) : null;
    }

    async updateMeta(jobId: string, patch: Partial<NotificationListJobMeta>): Promise<NotificationListJobMeta> {
        const current = (await this.getMeta(jobId)) ?? null;
        if (!current) {
            throw new Error(`NOTIFICATION_LIST_JOB_NOT_FOUND:${jobId}`);
        }
        const next: NotificationListJobMeta = {
            ...current,
            ...patch,
        };
        await this.redis.set(this.metaKey(jobId), JSON.stringify(next), "EX", this.ttlSeconds);
        return next;
    }

    async append(jobId: string, items: NotificationListItem[]): Promise<void> {
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
        items: NotificationListItem[];
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
        const parsed = rawItems.map((value) => JSON.parse(value) as NotificationListItem);
        const nextCursor = normalizedCursor + parsed.length;
        await this.redis.expire(this.dataKey(jobId), this.ttlSeconds);
        return {items: parsed, nextCursor, total};
    }

    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId), this.dataKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `notifications:list:${jobId}:meta`;
    }

    private dataKey(jobId: string): string {
        return `notifications:list:${jobId}:data`;
    }
}

export const notificationListCacheProvider = {
    provide: NotificationListCacheService,
    useClass: NotificationListCacheService,
};


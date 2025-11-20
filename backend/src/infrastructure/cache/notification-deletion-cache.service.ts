import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {NotificationDeleteJobMeta} from "@application/dto/notifications/notification-deletion.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class NotificationDeletionCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(NotificationDeletionCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.notificationDeletion.redisTtlSeconds") as number) ??
            parseInt(process.env.NOTIFICATIONS_DELETE_REDIS_TTL ?? "3600", 10);
        this.ttlSeconds = Math.max(60, ttl);
    }

    async initializeJob(meta: NotificationDeleteJobMeta): Promise<void> {
        await this.redis.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        this.logger.default(`Notification deletion job initialized: ${meta.jobId}`);
    }

    async getMeta(jobId: string): Promise<NotificationDeleteJobMeta | null> {
        const data = await this.redis.get(this.metaKey(jobId));
        return data ? (JSON.parse(data) as NotificationDeleteJobMeta) : null;
    }

    async updateMeta(jobId: string, patch: Partial<NotificationDeleteJobMeta>): Promise<NotificationDeleteJobMeta> {
        const current = (await this.getMeta(jobId)) ?? null;
        if (!current) {
            throw new Error(`NOTIFICATION_DELETE_JOB_NOT_FOUND:${jobId}`);
        }
        const next: NotificationDeleteJobMeta = {
            ...current,
            ...patch,
        };
        await this.redis.set(this.metaKey(jobId), JSON.stringify(next), "EX", this.ttlSeconds);
        return next;
    }

    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `notifications:delete:${jobId}:meta`;
    }
}

export const notificationDeletionCacheProvider = {
    provide: NotificationDeletionCacheService,
    useClass: NotificationDeletionCacheService,
};


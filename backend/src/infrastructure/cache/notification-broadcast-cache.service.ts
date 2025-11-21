import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {NotificationBroadcastJobMeta} from "@application/dto/notifications/notification-broadcast.dto";

@Injectable()
export class NotificationBroadcastCacheService {
    private readonly redis: Redis;
    private readonly ttlSeconds = 86400;

    constructor(configService: ConfigService) {
        const redisUrl = configService.get<string>("app.redisUrl") || process.env.REDIS_URL || "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
    }

    private key(jobId: string) {
        return `notification_broadcast:${jobId}`;
    }

    async initializeJob(meta: NotificationBroadcastJobMeta): Promise<void> {
        await this.redis.setex(this.key(meta.jobId), this.ttlSeconds, JSON.stringify(meta));
    }

    async getMeta(jobId: string): Promise<NotificationBroadcastJobMeta | null> {
        const raw = await this.redis.get(this.key(jobId));
        return raw ? JSON.parse(raw) : null;
    }

    async updateMeta(jobId: string, patch: Partial<NotificationBroadcastJobMeta>): Promise<void> {
        const key = this.key(jobId);
        const raw = await this.redis.get(key);
        if (!raw) return;
        const current = JSON.parse(raw) as NotificationBroadcastJobMeta;
        const updated = {...current, ...patch};
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(updated));
    }
}

export const notificationBroadcastCacheProvider = {
    provide: NotificationBroadcastCacheService,
    useFactory: (configService: ConfigService) => new NotificationBroadcastCacheService(configService),
    inject: [ConfigService],
};


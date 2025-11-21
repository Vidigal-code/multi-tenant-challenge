import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {NotificationFriendBroadcastJobMeta} from "@application/dto/notifications/notification-friend-broadcast.dto";

@Injectable()
export class NotificationFriendBroadcastCacheService {
    private readonly redis: Redis;
    private readonly ttlSeconds = 86400;

    constructor(configService: ConfigService) {
        const redisUrl = configService.get<string>("app.redisUrl") || process.env.REDIS_URL || "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
    }

    private key(jobId: string) {
        return `notification_friend_broadcast:${jobId}`;
    }

    async initializeJob(meta: NotificationFriendBroadcastJobMeta) {
        await this.redis.setex(this.key(meta.jobId), this.ttlSeconds, JSON.stringify(meta));
    }

    async getMeta(jobId: string): Promise<NotificationFriendBroadcastJobMeta | null> {
        const raw = await this.redis.get(this.key(jobId));
        return raw ? JSON.parse(raw) : null;
    }

    async updateMeta(jobId: string, patch: Partial<NotificationFriendBroadcastJobMeta>) {
        const key = this.key(jobId);
        const raw = await this.redis.get(key);
        if (!raw) return;
        const current = JSON.parse(raw) as NotificationFriendBroadcastJobMeta;
        const updated = {...current, ...patch};
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(updated));
    }
}

export const notificationFriendBroadcastCacheProvider = {
    provide: NotificationFriendBroadcastCacheService,
    useFactory: (configService: ConfigService) => new NotificationFriendBroadcastCacheService(configService),
    inject: [ConfigService],
};


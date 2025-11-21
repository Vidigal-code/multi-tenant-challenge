import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {UserDeleteJobMeta} from "@application/dto/users/user-deletion.dto";

@Injectable()
export class UserDeletionCacheService {
    private readonly redis: Redis;
    private readonly ttlSeconds = 86400; // 24 hours

    constructor(configService: ConfigService) {
        const redisUrl = configService.get<string>("app.redisUrl") || process.env.REDIS_URL || "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
    }

    async initializeJob(meta: UserDeleteJobMeta): Promise<void> {
        await this.redis.setex(`user_del_job:${meta.jobId}`, this.ttlSeconds, JSON.stringify(meta));
    }

    async getMeta(jobId: string): Promise<UserDeleteJobMeta | null> {
        const raw = await this.redis.get(`user_del_job:${jobId}`);
        return raw ? JSON.parse(raw) : null;
    }

    async updateMeta(jobId: string, patch: Partial<UserDeleteJobMeta>): Promise<void> {
        const key = `user_del_job:${jobId}`;
        const raw = await this.redis.get(key);
        if (!raw) return;

        const current = JSON.parse(raw) as UserDeleteJobMeta;
        const updated = {...current, ...patch};
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(updated));
    }
}

export const userDeletionCacheProvider = {
    provide: UserDeletionCacheService,
    useFactory: (configService: ConfigService) => new UserDeletionCacheService(configService),
    inject: [ConfigService],
};


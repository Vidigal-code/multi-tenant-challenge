import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {InviteBulkJobStatus} from "@application/dto/invites/invite-bulk.dto";

export interface InviteBulkJobMeta {
    jobId: string;
    userId: string;
    status: InviteBulkJobStatus;
    action: "delete" | "reject";
    target: "created" | "received";
    scope: "selected" | "all";
    total: number;
    processed: number;
    failedCount: number;
    createdAt: string;
    finishedAt?: string;
    error?: string;
}

@Injectable()
export class InviteBulkCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(InviteBulkCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.inviteBulk.redisTtlSeconds") as number) ??
            parseInt(process.env.INVITES_BULK_REDIS_TTL ?? "3600", 10);
        this.ttlSeconds = Math.max(300, ttl);
    }

    async initialize(meta: InviteBulkJobMeta): Promise<void> {
        await this.redis.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
    }

    async get(jobId: string): Promise<InviteBulkJobMeta | null> {
        const payload = await this.redis.get(this.metaKey(jobId));
        return payload ? (JSON.parse(payload) as InviteBulkJobMeta) : null;
    }

    async update(jobId: string, patch: Partial<InviteBulkJobMeta>): Promise<InviteBulkJobMeta> {
        const current = await this.get(jobId);
        if (!current) {
            throw new Error(`INVITE_BULK_JOB_NOT_FOUND:${jobId}`);
        }
        const next = {...current, ...patch};
        await this.redis.set(this.metaKey(jobId), JSON.stringify(next), "EX", this.ttlSeconds);
        return next;
    }

    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `invites:bulk:${jobId}:meta`;
    }
}

export const inviteBulkCacheProvider = {
    provide: InviteBulkCacheService,
    useClass: InviteBulkCacheService,
};


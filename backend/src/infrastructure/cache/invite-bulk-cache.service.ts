import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {InviteBulkJobMeta} from "@application/dto/invites/invite-bulk.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

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
        this.ttlSeconds = Math.max(60, ttl);
    }

    /**
     *
     * EN:
     * Initializes bulk job metadata in Redis, overwriting any previous state for the jobId.
     *
     * PT:
     * Inicializa os metadados do job de bulk no Redis, sobrescrevendo qualquer estado anterior para o jobId.
     *
     * @params meta
     * @returns Promise<void>
     */
    async initialize(meta: InviteBulkJobMeta): Promise<void> {
        await this.redis.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        this.logger.default(`Invite bulk job initialized: ${meta.jobId}`);
    }

    async get(jobId: string): Promise<InviteBulkJobMeta | null> {
        const raw = await this.redis.get(this.metaKey(jobId));
        return raw ? (JSON.parse(raw) as InviteBulkJobMeta) : null;
    }

    async update(jobId: string, patch: Partial<InviteBulkJobMeta>): Promise<InviteBulkJobMeta> {
        const current = await this.get(jobId);
        if (!current) {
            throw new Error(`INVITE_BULK_JOB_NOT_FOUND:${jobId}`);
        }
        const merged = {...current, ...patch};
        await this.redis.set(this.metaKey(jobId), JSON.stringify(merged), "EX", this.ttlSeconds);
        return merged;
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


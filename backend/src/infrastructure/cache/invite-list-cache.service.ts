import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import Redis from "ioredis";
import {InviteListItem, InviteListJobMeta} from "@application/dto/invites/invite-listing.dto";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class InviteListCacheService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly configService: ConfigService) {
        this.logger = new LoggerService(InviteListCacheService.name, configService);
        const redisUrl =
            (this.configService.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(redisUrl);
        const ttl =
            (this.configService.get("app.inviteListing.redisTtlSeconds") as number) ??
            parseInt(process.env.INVITES_LIST_REDIS_TTL ?? "3600", 10);
        this.ttlSeconds = Math.max(60, ttl);
    }

    /**
     * EN:
     * Initializes a job record, ensuring that metadata and storage lists are reset with the proper TTL.
     *
     * PT:
     * Inicializa o registro de um job, garantindo que metadados e listas de armazenamento sejam
     * reiniciados com o TTL correto.
     *
     * @param meta - EN: metadata that will be stored for the job / PT: metadados que serão armazenados para o job
     * @returns Promise<void>
     */
    async initializeJob(meta: InviteListJobMeta): Promise<void> {
        const pipeline = this.redis.pipeline();
        pipeline.del(this.metaKey(meta.jobId));
        pipeline.del(this.dataKey(meta.jobId));
        pipeline.set(this.metaKey(meta.jobId), JSON.stringify(meta), "EX", this.ttlSeconds);
        pipeline.expire(this.dataKey(meta.jobId), this.ttlSeconds);
        await pipeline.exec();
        this.logger.default(`Invite list job initialized: ${meta.jobId}`);
    }

    /**
     * EN:
     * Retrieves job metadata, returning null when the job is unknown or expired.
     *
     * PT:
     * Recupera os metadados do job, retornando null quando o job é desconhecido ou expirado.
     *
     * @param jobId - EN/PT: job identifier
     * @returns Promise<InviteListJobMeta | null>
     */
    async getMeta(jobId: string): Promise<InviteListJobMeta | null> {
        const data = await this.redis.get(this.metaKey(jobId));
        return data ? (JSON.parse(data) as InviteListJobMeta) : null;
    }

    /**
     * EN:
     * Merges new data into the stored metadata structure and refreshes the TTL.
     *
     * PT:
     * Mescla novos dados na estrutura de metadados armazenada e renova o TTL.
     *
     * @param jobId - EN/PT: job identifier
     * @param patch - EN/PT: partial metadata to merge
     * @returns Promise<InviteListJobMeta>
     */
    async updateMeta(jobId: string, patch: Partial<InviteListJobMeta>): Promise<InviteListJobMeta> {
        const current = (await this.getMeta(jobId)) ?? null;
        if (!current) {
            throw new Error(`INVITE_LIST_JOB_NOT_FOUND:${jobId}`);
        }
        const next: InviteListJobMeta = {
            ...current,
            ...patch,
        };
        await this.redis.set(this.metaKey(jobId), JSON.stringify(next), "EX", this.ttlSeconds);
        return next;
    }

    /**
     * EN:
     * Pushes invite items to the Redis list, keeping insertion order and renewing the TTL.
     *
     * PT:
     * Adiciona itens de convite na lista do Redis, mantendo a ordem de inserção e renovando o TTL.
     *
     * @param jobId - EN/PT: job identifier
     * @param items - EN/PT: invite representations to append
     * @returns Promise<void>
     */
    async append(jobId: string, items: InviteListItem[]): Promise<void> {
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

    /**
     * EN:
     * Retrieves invite items using cursor-based offsets stored within the Redis list.
     *
     * PT:
     * Recupera itens de convite utilizando offsets baseados em cursor armazenados na lista do Redis.
     *
     * @param jobId - EN/PT: job identifier
     * @param cursor - EN/PT: offset to start reading from
     * @param limit - EN/PT: maximum items to return
     * @returns Promise<{ items: InviteListItem[]; nextCursor: number | null; total: number }>
     */
    async getItems(jobId: string, cursor: number, limit: number): Promise<{
        items: InviteListItem[];
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
        const parsed = rawItems.map((value) => JSON.parse(value) as InviteListItem);
        const nextCursor = normalizedCursor + parsed.length;
        await this.redis.expire(this.dataKey(jobId), this.ttlSeconds);
        return {items: parsed, nextCursor, total};
    }

    /**
     * EN:
     * Permanently deletes both metadata and data entries related to the job.
     *
     * PT:
     * Remove definitivamente os metadados e os dados associados ao job.
     *
     * @param jobId - EN/PT: job identifier
     * @returns Promise<void>
     */
    async delete(jobId: string): Promise<void> {
        await this.redis.del(this.metaKey(jobId), this.dataKey(jobId));
    }

    private metaKey(jobId: string): string {
        return `invites:list:${jobId}:meta`;
    }

    private dataKey(jobId: string): string {
        return `invites:list:${jobId}:data`;
    }
}

export const inviteListCacheProvider = {
    provide: InviteListCacheService,
    useClass: InviteListCacheService,
};


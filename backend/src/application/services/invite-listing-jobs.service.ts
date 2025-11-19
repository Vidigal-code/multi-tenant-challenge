import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto";
import {InviteListCacheService} from "@infrastructure/cache/invite-list-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateInviteListJobDto,
    InviteListJobMeta,
    InviteListJobPayload,
    InviteListJobResponseDto,
    InviteListQueryDto,
} from "@application/dto/invites/invite-listing.dto";
import {DLQ_INVITES_LIST_QUEUE, INVITES_LIST_QUEUE} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class InviteListingJobsService {
    constructor(
        private readonly cache: InviteListCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    /**
     * EN:
     * Creates a new invite listing job, stores metadata in Redis, and enqueues the processing payload.
     *
     * PT:
     * Cria um novo job de listagem de convites, persiste os metadados no Redis e envia o payload para a fila.
     *
     * @param user - EN/PT: authenticated user initiating the job
     * @param dto - EN/PT: creation payload with type and chunk size overrides
     * @returns Promise<InviteListJobMeta>
     */
    async createJob(user: CurrentUserPayload, dto: CreateInviteListJobDto): Promise<InviteListJobMeta> {
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const jobId = randomUUID();
        const meta: InviteListJobMeta = {
            jobId,
            userId: user.sub,
            type: dto.type,
            status: "pending",
            chunkSize,
            processed: 0,
            createdAt: new Date().toISOString(),
        };

        await this.cache.initializeJob(meta);

        const payload: InviteListJobPayload = {
            jobId,
            userId: user.sub,
            userEmail: user.email?.toLowerCase(),
            type: dto.type,
            chunkSize,
        };

        await this.rabbit.assertEventQueue(INVITES_LIST_QUEUE, DLQ_INVITES_LIST_QUEUE);
        await this.rabbit.sendToQueue(INVITES_LIST_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    /**
     * EN:
     * Fetches the current state of a job plus the requested page from Redis, ensuring the job belongs to the caller.
     *
     * PT:
     * Busca o estado atual de um job e a página solicitada no Redis, garantindo que o job pertença ao usuário autenticado.
     *
     * @param userId - EN/PT: authenticated user identifier
     * @param jobId - EN/PT: job identifier
     * @param query - EN/PT: pagination query parameters
     * @returns Promise<InviteListJobResponseDto>
     */
    async getJob(userId: string, jobId: string, query: InviteListQueryDto): Promise<InviteListJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.INVITE_LIST_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        const pageSize = this.normalizePageSize(query.pageSize);
        const cursor = query.cursor ?? 0;
        const {items, nextCursor, total} = await this.cache.getItems(jobId, cursor, pageSize);
        const totalItems = meta.total ?? total;
        const computedCursor = typeof nextCursor === "number" ? nextCursor : cursor;
        const done = meta.status === "completed" && computedCursor >= totalItems;
        const displayNextCursor = done ? null : computedCursor;

        return {
            jobId,
            cursor,
            status: meta.status,
            processed: meta.processed,
            total: totalItems,
            items,
            nextCursor: displayNextCursor,
            done,
            error: meta.error,
        };
    }

    /**
     * EN:
     * Removes job metadata and cached items when the job belongs to the authenticated user.
     *
     * PT:
     * Remove metadados e itens em cache de um job pertencente ao usuário autenticado.
     *
     * @param userId - EN/PT: authenticated user identifier
     * @param jobId - EN/PT: job identifier
     * @returns Promise<void>
     */
    async deleteJob(userId: string, jobId: string): Promise<void> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.INVITE_LIST_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private normalizeChunkSize(requested?: number): number {
        const cfg = this.configService.get("app.inviteListing") as any;
        const min = Number(cfg?.minChunkSize ?? 200);
        const max = Number(cfg?.maxChunkSize ?? 5000);
        const fallback = Number(cfg?.defaultChunkSize ?? 1000);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(min, raw));
    }

    private normalizePageSize(requested?: number): number {
        const cfg = this.configService.get("app.inviteListing") as any;
        const max = Number(cfg?.maxPageSize ?? 1000);
        const fallback = Number(cfg?.defaultPageSize ?? 200);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(1, raw));
    }
}


import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto";
import {UserSearchCacheService} from "@infrastructure/cache/user-search-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateUserSearchJobDto,
    UserSearchJobMeta,
    UserSearchJobPayload,
    UserSearchJobResponseDto,
    UserSearchQueryDto,
} from "@application/dto/users/user-search.dto";
import {
    DLQ_USER_SEARCH_QUEUE,
    USER_SEARCH_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class UserSearchJobsService {
    constructor(
        private readonly cache: UserSearchCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    async createJob(user: CurrentUserPayload, dto: CreateUserSearchJobDto): Promise<UserSearchJobMeta> {
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const jobId = randomUUID();
        const meta: UserSearchJobMeta = {
            jobId,
            userId: user.sub,
            status: "pending",
            processed: 0,
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: UserSearchJobPayload = {
            jobId,
            userId: user.sub,
            query: dto.query,
            chunkSize,
        };

        await this.rabbit.assertEventQueue(USER_SEARCH_QUEUE, DLQ_USER_SEARCH_QUEUE);
        await this.rabbit.sendToQueue(USER_SEARCH_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string, query: UserSearchQueryDto): Promise<UserSearchJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.USER_SEARCH_JOB_NOT_FOUND);
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
            status: meta.status,
            processed: meta.processed,
            total: totalItems,
            items,
            nextCursor: displayNextCursor ?? undefined,
            done,
            error: meta.error,
        };
    }

    async deleteJob(userId: string, jobId: string): Promise<void> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.USER_SEARCH_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private normalizeChunkSize(requested?: number): number {
        const cfg = this.configService.get("app.userSearch") as any;
        const min = Number(cfg?.minChunkSize ?? 200);
        const max = Number(cfg?.maxChunkSize ?? 5000);
        const fallback = Number(cfg?.defaultChunkSize ?? 1000);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(min, raw));
    }

    private normalizePageSize(requested?: number): number {
        const cfg = this.configService.get("app.userSearch") as any;
        const max = Number(cfg?.maxPageSize ?? 100);
        const fallback = Number(cfg?.defaultPageSize ?? 20);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(1, raw));
    }
}


import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto";
import {FriendshipListCacheService} from "@infrastructure/cache/friendship-list-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateFriendshipListJobDto,
    FriendshipListJobMeta,
    FriendshipListingJobPayload,
    FriendshipListJobResponseDto,
    FriendshipListQueryDto,
} from "@application/dto/friendships/friendship-listing.dto";
import {
    DLQ_FRIENDSHIPS_LIST_QUEUE,
    FRIENDSHIPS_LIST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class FriendshipListingJobsService {
    constructor(
        private readonly cache: FriendshipListCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    async createJob(user: CurrentUserPayload, dto: CreateFriendshipListJobDto): Promise<FriendshipListJobMeta> {
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const jobId = randomUUID();
        const meta: FriendshipListJobMeta = {
            jobId,
            userId: user.sub,
            status: "pending",
            processed: 0,
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: FriendshipListingJobPayload = {
            jobId,
            userId: user.sub,
            status: dto.status,
            chunkSize,
        };

        await this.rabbit.assertEventQueue(FRIENDSHIPS_LIST_QUEUE, DLQ_FRIENDSHIPS_LIST_QUEUE);
        await this.rabbit.sendToQueue(FRIENDSHIPS_LIST_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string, query: FriendshipListQueryDto): Promise<FriendshipListJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.FRIENDSHIP_LIST_JOB_NOT_FOUND);
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
            throw new ApplicationError(ErrorCode.FRIENDSHIP_LIST_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private normalizeChunkSize(requested?: number): number {
        const cfg = this.configService.get("app.friendshipListing") as any;
        const min = Number(cfg?.minChunkSize ?? 200);
        const max = Number(cfg?.maxChunkSize ?? 5000);
        const fallback = Number(cfg?.defaultChunkSize ?? 1000);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(min, raw));
    }

    private normalizePageSize(requested?: number): number {
        const cfg = this.configService.get("app.friendshipListing") as any;
        const max = Number(cfg?.maxPageSize ?? 1000);
        const fallback = Number(cfg?.defaultPageSize ?? 200);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(1, raw));
    }
}


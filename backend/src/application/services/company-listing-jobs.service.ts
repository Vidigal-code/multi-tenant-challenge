import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto";
import {CompanyListCacheService} from "@infrastructure/cache/company-list-cache.service";
import {
    CompanyListingJobMeta,
    CompanyListingJobPayload,
    CompanyListingJobResponseDto,
    CompanyListingQueryDto,
    CreateCompanyListingJobDto,
} from "@application/dto/companys/company-listing.dto";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    COMPANIES_LIST_QUEUE,
    DLQ_COMPANIES_LIST_QUEUE,
} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
}

@Injectable()
export class CompanyListingJobsService {
    constructor(
        private readonly cache: CompanyListCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    /**
     *
     * EN:
     * Creates a new company listing job for either primary-owner or member view,
     * enqueues it via RabbitMQ and persists metadata in Redis.
     *
     * PT:
     * Cria um novo job de listagem de empresas (dono primário ou membro),
     * envia para o RabbitMQ e salva metadados no Redis.
     *
     * @params user - dados do usuário autenticado
     * @params dto - payload com tipo e chunkSize opcional
     * @returns Promise<CompanyListingJobMeta>
     */
    async createJob(user: CurrentUserPayload, dto: CreateCompanyListingJobDto): Promise<CompanyListingJobMeta> {
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const jobId = randomUUID();
        const meta: CompanyListingJobMeta = {
            jobId,
            userId: user.sub,
            type: dto.type,
            status: "pending",
            chunkSize,
            processed: 0,
            createdAt: new Date().toISOString(),
        };
        await this.cache.initializeJob(meta);

        const payload: CompanyListingJobPayload = {
            jobId,
            userId: user.sub,
            type: dto.type,
            chunkSize,
        };

        await this.rabbit.assertEventQueue(COMPANIES_LIST_QUEUE, DLQ_COMPANIES_LIST_QUEUE);
        await this.rabbit.sendToQueue(COMPANIES_LIST_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    /**
     *
     * EN:
     * Retrieves a page of company listing results from Redis, validating ownership.
     *
     * PT:
     * Recupera uma página dos resultados de listagem de empresas armazenados no Redis,
     * validando se o job pertence ao usuário.
     *
     * @params userId
     * @params jobId
     * @params query
     * @returns Promise<CompanyListingJobResponseDto>
     */
    async getJob(userId: string, jobId: string, query: CompanyListingQueryDto): Promise<CompanyListingJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.COMPANY_LIST_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        const pageSize = this.normalizePageSize(query.pageSize);
        const cursor = query.cursor ?? 0;
        const {items, nextCursor, total} = await this.cache.getItems(jobId, cursor, pageSize);
        const totalItems = meta.total ?? total;
        const effectiveCursor = typeof nextCursor === "number" ? nextCursor : cursor;
        const done = meta.status === "completed" && (nextCursor === null || effectiveCursor >= totalItems);

        return {
            jobId,
            cursor,
            status: meta.status,
            processed: meta.processed,
            total: totalItems,
            items,
            nextCursor: done ? null : effectiveCursor,
            done,
            error: meta.error,
        };
    }

    /**
     *
     * EN:
     * Deletes cached data for a company listing job owned by the user.
     *
     * PT:
     * Remove do Redis os dados de um job de listagem de empresas pertencente ao usuário.
     *
     * @params userId
     * @params jobId
     * @returns Promise<void>
     */
    async deleteJob(userId: string, jobId: string): Promise<void> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.COMPANY_LIST_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private normalizeChunkSize(requested?: number): number {
        const cfg = this.configService.get("app.companyListing") as any;
        const min = Number(cfg?.minChunkSize ?? 200);
        const max = Number(cfg?.maxChunkSize ?? 5000);
        const fallback = Number(cfg?.defaultChunkSize ?? 1000);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(min, raw));
    }

    private normalizePageSize(requested?: number): number {
        const cfg = this.configService.get("app.companyListing") as any;
        const max = Number(cfg?.maxPageSize ?? 1000);
        const fallback = Number(cfg?.defaultPageSize ?? 200);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(1, raw));
    }
}


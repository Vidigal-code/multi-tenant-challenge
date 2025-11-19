import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {randomUUID} from "crypto";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateInviteBulkJobDto,
    InviteBulkJobResponseDto,
    InviteBulkJobStatus,
} from "@application/dto/invites/invite-bulk.dto";
import {InviteBulkCacheService} from "@infrastructure/cache/invite-bulk-cache.service";
import {DLQ_INVITES_BULK_QUEUE, INVITES_BULK_QUEUE} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

export interface InviteBulkJobPayload {
    jobId: string;
    userId: string;
    userEmail?: string;
    action: "delete" | "reject";
    target: "created" | "received";
    scope: "selected" | "all";
    inviteIds?: string[];
    chunkSize: number;
}

@Injectable()
export class InviteBulkJobsService {
    constructor(
        private readonly cache: InviteBulkCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    /**
     *
     * EN:
     * Creates a background job for deleting or rejecting invitations in bulk.
     *
     * PT:
     * Cria um job em background para deletar ou rejeitar convites em lote.
     *
     * @params user - Current authenticated user / Usuário autenticado
     * @params dto - Bulk action DTO / DTO da ação em lote
     * @returns InviteBulkJobResponseDto
     */
    async createJob(user: CurrentUserPayload, dto: CreateInviteBulkJobDto): Promise<InviteBulkJobResponseDto> {
        if (dto.scope === "selected" && (!dto.inviteIds || dto.inviteIds.length === 0)) {
            throw new ApplicationError(ErrorCode.NO_FIELDS_TO_UPDATE);
        }
        if (dto.action === "delete" && dto.target !== "created") {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        if (dto.action === "reject" && dto.target !== "received") {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        const jobId = randomUUID();
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const payload: InviteBulkJobPayload = {
            jobId,
            userId: user.sub,
            userEmail: user.email?.toLowerCase(),
            action: dto.action,
            target: dto.target,
            scope: dto.scope,
            inviteIds: dto.scope === "selected" ? dto.inviteIds : undefined,
            chunkSize,
        };
        const meta = {
            jobId,
            userId: user.sub,
            status: "pending" as InviteBulkJobStatus,
            action: dto.action,
            target: dto.target,
            scope: dto.scope,
            total: dto.scope === "selected" ? (dto.inviteIds?.length ?? 0) : 0,
            processed: 0,
            failedCount: 0,
            createdAt: new Date().toISOString(),
        };
        await this.cache.initialize(meta);
        await this.rabbit.assertEventQueue(INVITES_BULK_QUEUE, DLQ_INVITES_BULK_QUEUE);
        await this.rabbit.sendToQueue(
            INVITES_BULK_QUEUE,
            Buffer.from(JSON.stringify(payload)),
        );
        return this.toResponse(meta);
    }

    async getJob(userId: string, jobId: string): Promise<InviteBulkJobResponseDto> {
        const meta = await this.cache.get(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.INVITE_BULK_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        return this.toResponse(meta);
    }

    async deleteJob(userId: string, jobId: string): Promise<void> {
        const meta = await this.cache.get(jobId);
        if (!meta) {
            return;
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private toResponse(meta: {
        jobId: string;
        status: InviteBulkJobStatus;
        processed: number;
        total: number;
        failedCount: number;
        error?: string;
    }): InviteBulkJobResponseDto {
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            total: meta.total,
            failedCount: meta.failedCount,
            error: meta.error,
        };
    }

    private normalizeChunkSize(requested?: number): number {
        const cfg = this.configService.get("app.inviteBulk") as any;
        const min = Number(cfg?.minChunkSize ?? 100);
        const max = Number(cfg?.maxChunkSize ?? 2000);
        const fallback = Number(cfg?.defaultChunkSize ?? 500);
        const raw = typeof requested === "number" ? requested : fallback;
        return Math.min(max, Math.max(min, raw));
    }
}


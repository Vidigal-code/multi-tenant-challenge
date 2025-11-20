import {Inject, Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {InviteBulkCacheService} from "@infrastructure/cache/invite-bulk-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateInviteBulkJobDto,
    InviteBulkJobMeta,
    InviteBulkJobPayload,
    InviteBulkJobResponseDto,
} from "@application/dto/invites/invite-bulk.dto";
import {randomUUID} from "crypto";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {
    DLQ_INVITES_BULK_QUEUE,
    INVITES_BULK_QUEUE,
} from "@infrastructure/messaging/constants/queue.constants";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/users/user.repository";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class InviteBulkJobsService {
    constructor(
        private readonly cache: InviteBulkCacheService,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    ) {
    }

    /**
     *
     * EN:
     * Creates a new invite bulk job (delete/reject) and sends the payload to RabbitMQ.
     *
     * PT:
     * Cria um novo job de bulk (delete/reject) e envia o payload para o RabbitMQ.
     *
     * @params user
     * @params dto
     * @returns Promise<InviteBulkJobResponseDto>
     */
    async createJob(user: CurrentUserPayload, dto: CreateInviteBulkJobDto): Promise<InviteBulkJobResponseDto> {
        if (dto.scope === "selected" && (!dto.inviteIds || dto.inviteIds.length === 0)) {
            throw new ApplicationError(ErrorCode.INVALID_REQUEST);
        }
        if (dto.action === "reject" && !user.email) {
            const dbUser = await this.users.findById(user.sub);
            if (!dbUser) {
                throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
            }
            user.email = dbUser.email.toString();
        }
        const chunkSize = this.normalizeChunkSize(dto.chunkSize);
        const jobId = randomUUID();
        const meta: InviteBulkJobMeta = {
            jobId,
            userId: user.sub,
            action: dto.action,
            scope: dto.scope,
            chunkSize,
            processed: 0,
            succeeded: 0,
            failed: 0,
            status: "pending",
            createdAt: new Date().toISOString(),
        };
        await this.cache.initialize(meta);
        const payload: InviteBulkJobPayload = {
            jobId,
            userId: user.sub,
            action: dto.action,
            scope: dto.scope,
            chunkSize,
            inviteIds: dto.scope === "selected" ? dto.inviteIds : undefined,
            userEmail: user.email?.toLowerCase(),
        };
        await this.rabbit.assertEventQueue(INVITES_BULK_QUEUE, DLQ_INVITES_BULK_QUEUE);
        await this.rabbit.sendToQueue(INVITES_BULK_QUEUE, Buffer.from(JSON.stringify(payload)));
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
            throw new ApplicationError(ErrorCode.INVITE_BULK_JOB_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }
        await this.cache.delete(jobId);
    }

    private toResponse(meta: InviteBulkJobMeta): InviteBulkJobResponseDto {
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            succeeded: meta.succeeded,
            failed: meta.failed,
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


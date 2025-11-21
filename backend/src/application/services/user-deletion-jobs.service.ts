import {Injectable} from "@nestjs/common";
import {randomUUID} from "crypto";
import {UserDeletionCacheService} from "@infrastructure/cache/user-deletion-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateUserDeleteJobDto,
    UserDeleteJobMeta,
    UserDeleteJobResponseDto,
    UserDeletionJobPayload
} from "@application/dto/users/user-deletion.dto";
import {
    DLQ_USERS_DELETE_QUEUE,
    USERS_DELETE_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class UserDeletionJobsService {
    constructor(
        private readonly cache: UserDeletionCacheService,
        private readonly rabbit: RabbitMQService,
    ) {
    }

    async createJob(user: CurrentUserPayload, _dto: CreateUserDeleteJobDto): Promise<UserDeleteJobMeta> {
        const jobId = randomUUID();
        const meta: UserDeleteJobMeta = {
            jobId,
            userId: user.sub,
            status: "pending",
            progress: 0,
            currentStep: "INIT",
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: UserDeletionJobPayload = {
            jobId,
            userId: user.sub,
            step: 'INIT'
        };

        await this.rabbit.assertEventQueue(USERS_DELETE_QUEUE, DLQ_USERS_DELETE_QUEUE);
        await this.rabbit.sendToQueue(USERS_DELETE_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string): Promise<UserDeleteJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);

        if (!meta) {
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        return {
            jobId,
            status: meta.status,
            progress: meta.progress,
            currentStep: meta.currentStep,
            done: meta.status === "completed" || meta.status === "failed",
            error: meta.error,
        };
    }
}


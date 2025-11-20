import {Injectable} from "@nestjs/common";
import {randomUUID} from "crypto";
import {NotificationDeletionCacheService} from "@infrastructure/cache/notification-deletion-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateNotificationDeleteJobDto,
    NotificationDeleteJobMeta,
    NotificationDeletionJobPayload,
    NotificationDeleteJobResponseDto,
} from "@application/dto/notifications/notification-deletion.dto";
import {
    DLQ_NOTIFICATIONS_DELETE_QUEUE,
    NOTIFICATIONS_DELETE_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class NotificationDeletionJobsService {
    constructor(
        private readonly cache: NotificationDeletionCacheService,
        private readonly rabbit: RabbitMQService,
    ) {
    }

    async createJob(user: CurrentUserPayload, dto: CreateNotificationDeleteJobDto): Promise<NotificationDeleteJobMeta> {
        const jobId = randomUUID();
        const meta: NotificationDeleteJobMeta = {
            jobId,
            userId: user.sub,
            status: "pending",
            deletedCount: 0,
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: NotificationDeletionJobPayload = {
            jobId,
            userId: user.sub,
            ids: dto.ids,
            deleteAll: dto.deleteAll,
        };

        await this.rabbit.assertEventQueue(NOTIFICATIONS_DELETE_QUEUE, DLQ_NOTIFICATIONS_DELETE_QUEUE);
        await this.rabbit.sendToQueue(NOTIFICATIONS_DELETE_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string): Promise<NotificationDeleteJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.NOTIFICATION_NOT_FOUND); // Or generic not found
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        return {
            jobId,
            status: meta.status,
            deletedCount: meta.deletedCount,
            done: meta.status === "completed" || meta.status === "failed",
            error: meta.error,
        };
    }
}


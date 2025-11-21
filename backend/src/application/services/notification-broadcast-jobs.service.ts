import {Injectable} from "@nestjs/common";
import {randomUUID} from "crypto";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateNotificationBroadcastJobDto,
    NotificationBroadcastJobMeta,
    NotificationBroadcastJobPayload,
    NotificationBroadcastJobResponseDto
} from "@application/dto/notifications/notification-broadcast.dto";
import {
    DLQ_NOTIFICATIONS_BROADCAST_QUEUE,
    NOTIFICATIONS_BROADCAST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {NotificationBroadcastCacheService} from "@infrastructure/cache/notification-broadcast-cache.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class NotificationBroadcastJobsService {
    constructor(
        private readonly cache: NotificationBroadcastCacheService,
        private readonly rabbit: RabbitMQService,
    ) {
    }

    async createJob(user: CurrentUserPayload, dto: CreateNotificationBroadcastJobDto): Promise<NotificationBroadcastJobMeta> {
        const jobId = randomUUID();
        const trimmedRecipients =
            dto.recipientsEmails?.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0) ?? [];

        const mode: 'selected' | 'members' = trimmedRecipients.length > 0 ? 'selected' : 'members';

        const meta: NotificationBroadcastJobMeta = {
            jobId,
            userId: user.sub,
            companyId: dto.companyId,
            title: dto.title,
            body: dto.body,
            onlyOwnersAndAdmins: dto.onlyOwnersAndAdmins ?? false,
            mode,
            selectedTargets: mode === 'selected' ? trimmedRecipients : undefined,
            status: "pending",
            processed: 0,
            totalTargets: mode === 'selected' ? trimmedRecipients.length : undefined,
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: NotificationBroadcastJobPayload = {
            jobId,
            userId: user.sub,
            step: 'INIT',
        };

        await this.rabbit.assertEventQueue(NOTIFICATIONS_BROADCAST_QUEUE, DLQ_NOTIFICATIONS_BROADCAST_QUEUE);
        await this.rabbit.sendToQueue(NOTIFICATIONS_BROADCAST_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string): Promise<NotificationBroadcastJobResponseDto> {
        const meta = await this.cache.getMeta(jobId);
        if (!meta) {
            throw new ApplicationError(ErrorCode.NOTIFICATION_NOT_FOUND);
        }
        if (meta.userId !== userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        return {
            jobId,
            status: meta.status,
            processed: meta.processed,
            totalTargets: meta.totalTargets,
            done: meta.status === "completed" || meta.status === "failed",
            error: meta.error,
        };
    }
}


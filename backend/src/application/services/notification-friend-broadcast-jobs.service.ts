import {Injectable} from "@nestjs/common";
import {randomUUID} from "crypto";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {
    CreateFriendBroadcastJobDto,
    NotificationFriendBroadcastJobMeta,
    NotificationFriendBroadcastJobPayload,
    NotificationFriendBroadcastJobResponseDto
} from "@application/dto/notifications/notification-friend-broadcast.dto";
import {
    DLQ_NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE,
    NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {NotificationFriendBroadcastCacheService} from "@infrastructure/cache/notification-friend-broadcast-cache.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

interface CurrentUserPayload {
    sub: string;
    email?: string;
}

@Injectable()
export class NotificationFriendBroadcastJobsService {
    constructor(
        private readonly cache: NotificationFriendBroadcastCacheService,
        private readonly rabbit: RabbitMQService,
    ) {
    }

    async createJob(user: CurrentUserPayload, dto: CreateFriendBroadcastJobDto): Promise<NotificationFriendBroadcastJobMeta> {
        const jobId = randomUUID();
        const trimmedRecipients =
            dto.recipientsEmails?.map((email) => email.trim().toLowerCase()).filter((email) => email.length > 0) ?? [];
        const mode: 'selected' | 'friends' = trimmedRecipients.length > 0 ? 'selected' : 'friends';

        const title = ((dto.title ?? '').trim()) || 'Mensagem';
        const body = ((dto.body ?? '').trim()) || ' ';

        const meta: NotificationFriendBroadcastJobMeta = {
            jobId,
            userId: user.sub,
            title,
            body,
            mode,
            selectedTargets: mode === 'selected' ? trimmedRecipients : undefined,
            status: "pending",
            processed: 0,
            totalTargets: mode === 'selected' ? trimmedRecipients.length : undefined,
            startedAt: Date.now(),
        };

        await this.cache.initializeJob(meta);

        const payload: NotificationFriendBroadcastJobPayload = {
            jobId,
            userId: user.sub,
            step: 'INIT',
        };

        await this.rabbit.assertEventQueue(NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE, DLQ_NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE);
        await this.rabbit.sendToQueue(NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE, Buffer.from(JSON.stringify(payload)));

        return meta;
    }

    async getJob(userId: string, jobId: string): Promise<NotificationFriendBroadcastJobResponseDto> {
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


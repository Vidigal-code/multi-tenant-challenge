import {Injectable, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {NotificationBroadcastJobPayload} from "@application/dto/notifications/notification-broadcast.dto";
import {NotificationBroadcastCacheService} from "@infrastructure/cache/notification-broadcast-cache.service";
import {
    DLQ_NOTIFICATIONS_BROADCAST_QUEUE,
    NOTIFICATIONS_BROADCAST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {SendNotificationUseCase, ResolvedRecipient} from "@application/use-cases/notifications/send-notification.usecase";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {Role} from "@domain/enums/role.enum";

@Injectable()
export class NotificationBroadcastConsumer extends BaseResilientConsumer<NotificationBroadcastJobPayload> implements OnModuleInit {
    constructor(
        rabbit: RabbitMQService,
        configService: ConfigService,
        private readonly cache: NotificationBroadcastCacheService,
        private readonly sendNotification: SendNotificationUseCase,
        private readonly prisma: PrismaService,
    ) {
        super(rabbit, {
            queue: NOTIFICATIONS_BROADCAST_QUEUE,
            dlq: DLQ_NOTIFICATIONS_BROADCAST_QUEUE,
            prefetch: 1,
            retryMax: 5,
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    async onModuleInit() {
        await this.start();
    }

    protected async process(payload: NotificationBroadcastJobPayload): Promise<void> {
        const meta = await this.cache.getMeta(payload.jobId);
        if (!meta) {
            this.logger.default(`Broadcast job meta missing: ${payload.jobId}`);
            return;
        }

        try {
            if (payload.step === 'INIT') {
                await this.cache.updateMeta(meta.jobId, {status: "processing"});
                const nextStep = meta.mode === 'selected' ? 'SELECTED' : 'MEMBERS';
                await this.requeue({jobId: meta.jobId, userId: meta.userId, step: nextStep, index: 0, cursor: null});
                return;
            }

            if (payload.step === 'SELECTED') {
                const targets = meta.selectedTargets ?? [];
                const startIndex = payload.index || 0;
                const BATCH_SIZE = 200;
                const batch = targets.slice(startIndex, startIndex + BATCH_SIZE);

                if (batch.length === 0) {
                    await this.cache.updateMeta(meta.jobId, {
                        status: "completed",
                        finishedAt: Date.now(),
                    });
                    return;
                }

                await this.sendNotification.execute({
                    companyId: meta.companyId,
                    senderUserId: meta.userId,
                    recipientsEmails: batch,
                    title: meta.title,
                    body: meta.body,
                    onlyOwnersAndAdmins: meta.onlyOwnersAndAdmins,
                });

                await this.cache.updateMeta(meta.jobId, {
                    processed: startIndex + batch.length,
                    totalTargets: targets.length,
                });

                await this.requeue({
                    jobId: meta.jobId,
                    userId: meta.userId,
                    step: 'SELECTED',
                    index: startIndex + batch.length,
                });
                return;
            }

            if (payload.step === 'MEMBERS') {
                const take = 200;
                const memberships = await this.prisma.membership.findMany({
                    where: {
                        companyId: meta.companyId,
                        ...(meta.onlyOwnersAndAdmins ? {role: {in: [Role.OWNER, Role.ADMIN]}} : {}),
                    },
                    orderBy: {id: "asc"},
                    take,
                    ...(payload.cursor ? {skip: 1, cursor: {id: payload.cursor}} : {}),
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                            },
                        },
                    },
                });

                if (memberships.length === 0) {
                    await this.cache.updateMeta(meta.jobId, {
                        status: "completed",
                        finishedAt: Date.now(),
                    });
                    return;
                }

                const recipients: ResolvedRecipient[] = memberships
                    .filter((membership: any) => membership.user && membership.user.id !== meta.userId)
                    .map((membership: any) => ({
                        userId: membership.user.id,
                        email: membership.user.email,
                        via: "company" as const,
                    }));

                if (recipients.length > 0) {
                    await this.sendNotification.execute({
                        companyId: meta.companyId,
                        senderUserId: meta.userId,
                        resolvedRecipients: recipients,
                        title: meta.title,
                        body: meta.body,
                        onlyOwnersAndAdmins: meta.onlyOwnersAndAdmins,
                    });

                    await this.cache.updateMeta(meta.jobId, {
                        processed: (meta.processed || 0) + recipients.length,
                    });
                }

                const nextCursor = memberships[memberships.length - 1]?.id || null;

                await this.requeue({
                    jobId: meta.jobId,
                    userId: meta.userId,
                    step: 'MEMBERS',
                    cursor: nextCursor,
                });
                return;
            }
        } catch (error: any) {
            const message = error?.message || "NOTIFICATION_BROADCAST_FAILED";
            this.logger.error(`Notification broadcast job failed: ${payload.jobId} - ${message}`);
            await this.cache.updateMeta(meta.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private async requeue(payload: NotificationBroadcastJobPayload) {
        await this.rabbit.sendToQueue(NOTIFICATIONS_BROADCAST_QUEUE, Buffer.from(JSON.stringify(payload)));
    }
}


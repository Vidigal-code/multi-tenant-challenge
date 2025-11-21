import {Injectable, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {NotificationFriendBroadcastJobPayload, NotificationFriendBroadcastJobMeta} from "@application/dto/notifications/notification-friend-broadcast.dto";
import {
    DLQ_NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE,
    NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {NotificationFriendBroadcastCacheService} from "@infrastructure/cache/notification-friend-broadcast-cache.service";
import {SendFriendMessageUseCase, ResolvedFriendRecipient} from "@application/use-cases/friendships/send-friend-message.usecase";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

@Injectable()
export class NotificationFriendBroadcastConsumer extends BaseResilientConsumer<NotificationFriendBroadcastJobPayload> implements OnModuleInit {
    constructor(
        rabbit: RabbitMQService,
        configService: ConfigService,
        private readonly cache: NotificationFriendBroadcastCacheService,
        private readonly sendFriendMessage: SendFriendMessageUseCase,
        private readonly prisma: PrismaService,
    ) {
        super(rabbit, {
            queue: NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE,
            dlq: DLQ_NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE,
            prefetch: 1,
            retryMax: 5,
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    async onModuleInit() {
        await this.start();
    }

    protected async process(payload: NotificationFriendBroadcastJobPayload): Promise<void> {
        const meta = await this.cache.getMeta(payload.jobId);
        if (!meta) {
            this.logger.default(`Friend broadcast job meta missing: ${payload.jobId}`);
            return;
        }

        try {
            if (payload.step === 'INIT') {
                await this.cache.updateMeta(meta.jobId, {status: "processing"});
                const nextStep = meta.mode === 'selected' ? 'SELECTED' : 'FRIENDS';
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

                const resolved = await this.resolveFriendEmails(meta, batch);

                if (resolved.length > 0) {
                    await this.sendFriendMessage.execute({
                        senderUserId: meta.userId,
                        resolvedRecipients: resolved,
                        title: meta.title,
                        body: meta.body,
                    });
                }

                await this.cache.updateMeta(meta.jobId, {
                    processed: startIndex + resolved.length,
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

            if (payload.step === 'FRIENDS') {
                const take = 200;
                const friendships = await this.prisma.friendship.findMany({
                    where: {
                        status: FriendshipStatus.ACCEPTED,
                        OR: [
                            {requesterId: meta.userId},
                            {addresseeId: meta.userId},
                        ],
                    },
                    orderBy: {id: "asc"},
                    take,
                    ...(payload.cursor ? {skip: 1, cursor: {id: payload.cursor}} : {}),
                    include: {
                        requester: {
                            select: {id: true, email: true},
                        },
                        addressee: {
                            select: {id: true, email: true},
                        },
                    },
                });

                if (friendships.length === 0) {
                    await this.cache.updateMeta(meta.jobId, {
                        status: "completed",
                        finishedAt: Date.now(),
                    });
                    return;
                }

                const recipients: ResolvedFriendRecipient[] = [];
                for (const friendship of friendships) {
                    const friend =
                        friendship.requesterId === meta.userId
                            ? friendship.addressee
                            : friendship.requester;
                    if (!friend || !friend.email || friend.id === meta.userId) continue;
                    recipients.push({
                        userId: friend.id,
                        email: friend.email,
                    });
                }

                if (recipients.length > 0) {
                    await this.sendFriendMessage.execute({
                        senderUserId: meta.userId,
                        resolvedRecipients: recipients,
                        title: meta.title,
                        body: meta.body,
                    });

                    await this.cache.updateMeta(meta.jobId, {
                        processed: (meta.processed || 0) + recipients.length,
                    });
                }

                const nextCursor = friendships[friendships.length - 1]?.id || null;

                await this.requeue({
                    jobId: meta.jobId,
                    userId: meta.userId,
                    step: 'FRIENDS',
                    cursor: nextCursor,
                });
                return;
            }
        } catch (error: any) {
            const message = error?.message || "FRIEND_BROADCAST_FAILED";
            this.logger.error(`Friend broadcast job failed: ${payload.jobId} - ${message}`);
            await this.cache.updateMeta(meta.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });

            if (error instanceof ApplicationError && error.code === ErrorCode.INVALID_REQUEST) {
                return;
            }

            throw error;
        }
    }

    private async resolveFriendEmails(meta: NotificationFriendBroadcastJobMeta, emails: string[]): Promise<ResolvedFriendRecipient[]> {
        if (emails.length === 0) {
            return [];
        }
        const users = await this.prisma.user.findMany({
            where: {
                email: {
                    in: emails,
                    mode: "insensitive",
                },
            },
            select: {
                id: true,
                email: true,
            },
        });

        if (users.length === 0) {
            return [];
        }

        const friendships = await this.prisma.friendship.findMany({
            where: {
                status: FriendshipStatus.ACCEPTED,
                OR: users.map((user) => ({
                    requesterId: meta.userId,
                    addresseeId: user.id,
                })).concat(users.map((user) => ({
                    requesterId: user.id,
                    addresseeId: meta.userId,
                }))),
            },
            select: {
                requesterId: true,
                addresseeId: true,
            },
        });

        const validUserIds = new Set<string>();
        friendships.forEach((friendship) => {
            const friendId = friendship.requesterId === meta.userId ? friendship.addresseeId : friendship.requesterId;
            if (friendId && friendId !== meta.userId) {
                validUserIds.add(friendId);
            }
        });

        return users
            .filter((user) => validUserIds.has(user.id))
            .map((user) => ({
                userId: user.id,
                email: user.email.toLowerCase(),
            }));
    }

    private async requeue(payload: NotificationFriendBroadcastJobPayload) {
        await this.rabbit.sendToQueue(NOTIFICATIONS_FRIENDS_BROADCAST_QUEUE, Buffer.from(JSON.stringify(payload)));
    }
}


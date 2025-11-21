import {NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {SuccessCode} from "@application/success/success-code";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {EventPayloadBuilderService} from "@application/services/event-payload-builder.service";

export interface ResolvedFriendRecipient {
    userId: string;
    email: string;
}

export interface SendFriendMessageInput {
    senderUserId: string;
    friendEmail?: string;
    resolvedRecipients?: ResolvedFriendRecipient[];
    title: string;
    body: string;
}

export interface SendFriendMessageResult {
    notification: any;
    validationResult: { email: string; status: "sent" | "failed"; code: string };
}

export class SendFriendMessageUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly userRepo: UserRepository,
        private readonly friendshipRepo: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly eventBuilder: EventPayloadBuilderService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(SendFriendMessageUseCase.name, configService);
    }

    async execute(input: SendFriendMessageInput): Promise<SendFriendMessageResult> {
        const senderUser = await this.userRepo.findById(input.senderUserId);
        if (!senderUser) {
            this.logger.default(`Send friend message failed: sender not found - user: ${input.senderUserId}`);
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        const normalizedTitle = ((input.title ?? "").trim()) || "Mensagem";
        const normalizedBody = ((input.body ?? "").trim()) || " ";

        const resolvedTargets: ResolvedFriendRecipient[] = [];

        if (input.resolvedRecipients && input.resolvedRecipients.length > 0) {
            resolvedTargets.push(
                ...input.resolvedRecipients.filter((target) => target.userId !== input.senderUserId),
            );
        } else if (input.friendEmail) {
            const friendEmail = input.friendEmail.trim().toLowerCase();
            const friendUser = await this.userRepo.findByEmail(friendEmail);
            if (!friendUser) {
                return {
                    notification: null,
                    validationResult: {
                        email: friendEmail,
                        status: "failed",
                        code: ErrorCode.USER_NOT_FOUND,
                    },
                };
            }

            if (friendUser.id === input.senderUserId) {
                return {
                    notification: null,
                    validationResult: {
                        email: friendEmail,
                        status: "failed",
                        code: ErrorCode.CANNOT_SEND_TO_SELF,
                    },
                };
            }

            const areFriends = await this.friendshipRepo.areFriends(input.senderUserId, friendUser.id);
            if (!areFriends) {
                return {
                    notification: null,
                    validationResult: {
                        email: friendEmail,
                        status: "failed",
                        code: ErrorCode.USER_MUST_BE_MEMBER_OR_FRIEND,
                    },
                };
            }

            resolvedTargets.push({
                userId: friendUser.id,
                email: friendEmail,
            });
        } else {
            throw new ApplicationError(ErrorCode.INVALID_REQUEST);
        }

        const notifications: any[] = [];
        for (const target of resolvedTargets) {
            const notification = await this.notificationRepo.create({
                companyId: null,
                senderUserId: input.senderUserId,
                recipientUserId: target.userId,
                recipientsEmails: [target.email],
                title: normalizedTitle,
                body: normalizedBody,
                meta: {
                    kind: "notification.sent",
                    channel: "friend",
                    sender: {
                        id: senderUser.id,
                        name: senderUser.name,
                        email: senderUser.email.toString(),
                    },
                },
            });
            notifications.push(notification);

            const eventPayload = await this.eventBuilder.build({
                eventId: "NOTIFICATION_SENT",
                senderId: input.senderUserId,
                receiverId: target.userId,
                companyId: null,
                additionalData: {
                    notificationId: notification.id,
                    recipientUserId: target.userId,
                    senderUserId: input.senderUserId,
                    title: normalizedTitle,
                    body: normalizedBody,
                },
            });

            await this.domainEvents.publish({
                name: "notifications.sent",
                payload: eventPayload,
            });
        }

        const firstTarget = resolvedTargets[0];
        return {
            notification: notifications[0] ?? null,
            validationResult: {
                email: firstTarget?.email || "*",
                status: "sent",
                code: SuccessCode.NOTIFICATION_SENT,
            },
        };
    }
}


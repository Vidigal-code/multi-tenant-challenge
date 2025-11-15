import {NotificationRepository} from "@domain/repositories/notification.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {SuccessCode} from "@application/success/success-code";
import {UserRepository} from "@domain/repositories/user.repository";
import {FriendshipRepository} from "@domain/repositories/friendship.repository";

export interface SendFriendMessageInput {
    senderUserId: string;
    friendEmail: string;
    title: string;
    body: string;
}

export interface SendFriendMessageResult {
    notification: any;
    validationResult: { email: string; status: "sent" | "failed"; code: string };
}

export class SendFriendMessageUseCase {
    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly userRepo: UserRepository,
        private readonly friendshipRepo: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: SendFriendMessageInput): Promise<SendFriendMessageResult> {
        const senderUser = await this.userRepo.findById(input.senderUserId);
        if (!senderUser) {
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

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

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: input.senderUserId,
            recipientUserId: friendUser.id,
            recipientsEmails: [friendEmail],
            title: input.title,
            body: input.body,
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

        await this.domainEvents.publish({
            name: "notification.sent",
            payload: {
                notificationId: notification.id,
                companyId: null,
                recipientUserId: friendUser.id,
                senderUserId: input.senderUserId,
                title: input.title,
                sender: {
                    id: senderUser.id,
                    name: senderUser.name,
                    email: senderUser.email.toString(),
                },
            },
        });

        return {
            notification,
            validationResult: {
                email: friendEmail,
                status: "sent",
                code: SuccessCode.NOTIFICATION_SENT,
            },
        };
    }
}


import {NotificationRepository} from "@domain/repositories/notification.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {UserRepository} from "@domain/repositories/user.repository";
import {USER_REPOSITORY} from "@domain/repositories/user.repository";
import {Inject} from "@nestjs/common";

export interface ReplyToNotificationInput {
    notificationId: string;
    userId: string;
    replyBody: string;
}

export class ReplyToNotificationUseCase {
    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly domainEvents: DomainEventsService,
        @Inject(USER_REPOSITORY)
        private readonly userRepo: UserRepository,
    ) {
    }

    async execute(input: ReplyToNotificationInput) {

        const originalNotification = await this.notificationRepo.findById(input.notificationId);
        if (!originalNotification) {
            throw new ApplicationError("NOTIFICATION_NOT_FOUND");
        }

        const canReply =
            originalNotification.senderUserId === input.userId ||
            originalNotification.recipientUserId === input.userId;

        if (!canReply) {
            throw new ApplicationError("CANNOT_REPLY_TO_NOTIFICATION");
        }

        const replier = await this.userRepo.findById(input.userId);
        if (!replier) {
            throw new ApplicationError("USER_NOT_FOUND");
        }

        const replyNotification = await this.notificationRepo.create({
            companyId: originalNotification.companyId,
            senderUserId: input.userId,
            recipientUserId: originalNotification.senderUserId,
            title: "NOTIFICATION_REPLY",
            body: input.replyBody,
            meta: {
                kind: "notification.reply",
                originalNotificationId: input.notificationId,
                originalTitle: originalNotification.title,
                replyTo: originalNotification.senderUserId,
                sender: {
                    id: replier.id,
                    name: replier.name,
                    email: replier.email.toString(),
                },
            },
        });

        await this.domainEvents.publish({
            name: "notification.replied",
            payload: {
                replyNotificationId: replyNotification.id,
                originalNotificationId: input.notificationId,
                replierId: input.userId,
                recipientId: originalNotification.senderUserId,
            },
        });
        
        // Also emit notification.created for realtime popups
        await this.domainEvents.publish({
            name: "notification.created",
            payload: {
                notificationId: replyNotification.id,
                companyId: originalNotification.companyId,
                recipientUserId: originalNotification.senderUserId,
                senderUserId: input.userId,
            },
        });

        return {replyNotification};
    }
}
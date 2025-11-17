import {NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {Inject} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface ReplyToNotificationInput {
    notificationId: string;
    userId: string;
    replyBody: string;
}

export class ReplyToNotificationUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly domainEvents: DomainEventsService,
        @Inject(USER_REPOSITORY)
        private readonly userRepo: UserRepository,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(ReplyToNotificationUseCase.name, configService);
    }

    async execute(input: ReplyToNotificationInput) {
        if (!input.replyBody || !input.replyBody.trim()) {
            this.logger.default(`Reply to notification failed: reply body is required - notification: ${input.notificationId}, user: ${input.userId}`);
            throw new ApplicationError(ErrorCode.MISSING_USER_DATA);
        }

        const originalNotification = await this.notificationRepo.findById(input.notificationId);
        if (!originalNotification) {
            this.logger.default(`Reply to notification failed: notification not found - notification: ${input.notificationId}, user: ${input.userId}`);
            throw new ApplicationError(ErrorCode.NOTIFICATION_NOT_FOUND);
        }

        const canReply =
            originalNotification.senderUserId === input.userId ||
            originalNotification.recipientUserId === input.userId;

        if (!canReply) {
            this.logger.default(`Reply to notification failed: cannot reply - notification: ${input.notificationId}, user: ${input.userId}, sender: ${originalNotification.senderUserId}, recipient: ${originalNotification.recipientUserId}`);
            throw new ApplicationError(ErrorCode.CANNOT_REPLY_TO_NOTIFICATION);
        }

        const replier = await this.userRepo.findById(input.userId);
        if (!replier) {
            this.logger.default(`Reply to notification failed: user not found - user: ${input.userId}`);
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        const originalMeta = originalNotification.meta || {};
        const originalContext = {
            originalNotificationId: input.notificationId,
            originalTitle: originalNotification.title,
            originalBody: originalNotification.body,
            originalMeta: {
                kind: originalMeta.kind,
                channel: originalMeta.channel,
                sender: originalMeta.sender,
                company: originalMeta.company,
                companyName: originalMeta.companyName,
                companyId: originalMeta.companyId,
                inviteId: originalMeta.inviteId,
                inviteUrl: originalMeta.inviteUrl,
                inviteEmail: originalMeta.inviteEmail,
                role: originalMeta.role,
                previousRole: originalMeta.previousRole,
                removedBy: originalMeta.removedBy,
                rejectedByName: originalMeta.rejectedByName,
                rejectedByEmail: originalMeta.rejectedByEmail,
            },
        };

        const replyNotification = await this.notificationRepo.create({
            companyId: originalNotification.companyId,
            senderUserId: input.userId,
            recipientUserId: originalNotification.senderUserId,
            title: originalNotification.title,
            body: input.replyBody.trim(),
            meta: {
                kind: "notifications.reply",
                replyTo: originalNotification.senderUserId,
                sender: {
                    id: replier.id,
                    name: replier.name,
                    email: replier.email.toString(),
                },
                ...originalContext,
            },
        });

        await this.domainEvents.publish({
            name: "notifications.replied",
            payload: {
                replyNotificationId: replyNotification.id,
                originalNotificationId: input.notificationId,
                replierId: input.userId,
                recipientId: originalNotification.senderUserId,
            },
        });
        
        await this.domainEvents.publish({
            name: "notifications.created",
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
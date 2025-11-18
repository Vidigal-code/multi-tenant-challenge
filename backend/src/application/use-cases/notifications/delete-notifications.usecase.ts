import {NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors";

export interface DeleteNotificationsInput {
    notificationIds: string[];
    userId: string;
}

export class DeleteNotificationsUseCase {
    constructor(private readonly notifications: NotificationRepository) {
    }

    async execute(input: DeleteNotificationsInput) {
        for (const notificationId of input.notificationIds) {
            const notification = await this.notifications.findById(notificationId);
            if (!notification) {
                continue; 
            }
            if (notification.recipientUserId !== input.userId && notification.senderUserId !== input.userId) {
                throw new ApplicationError(ErrorCode.NOT_AUTHORIZED);
            }
        }

        for (const notificationId of input.notificationIds) {
            await this.notifications.delete(notificationId);
        }

        return {success: true, deletedCount: input.notificationIds.length};
    }
}


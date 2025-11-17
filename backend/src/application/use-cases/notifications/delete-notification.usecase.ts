import { NotificationRepository } from "@domain/repositories/notifications/notification.repository";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors";

export interface DeleteNotificationInput {
  notificationId: string;
  userId: string;
}

export class DeleteNotificationUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(input: DeleteNotificationInput) {
    const notification = await this.notifications.findById(
      input.notificationId,
    );
    if (!notification) {
      throw new ApplicationError(ErrorCode.NOTIFICATION_NOT_FOUND);
    }
    if (
      notification.recipientUserId !== input.userId &&
      notification.senderUserId !== input.userId
    ) {
      throw new ApplicationError(ErrorCode.NOT_AUTHORIZED);
    }
    await this.notifications.delete(input.notificationId);
    return { deleted: true };
  }
}

import {
  ListNotificationsFilters,
  NotificationRepository,
} from "@domain/repositories/notifications/notification.repository";

export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(filters: ListNotificationsFilters) {
    return this.notifications.listByUser(filters);
  }
}

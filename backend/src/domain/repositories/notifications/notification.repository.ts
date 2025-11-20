import {Notification} from "@domain/entities/notifications/notification.entity";

export interface CreateNotificationInput {
    companyId?: string | null;
    senderUserId: string;
    recipientUserId?: string | null;
    recipientsEmails?: string[] | null;
    title: string;
    body: string;
    meta?: Record<string, any>;
}

export interface ListNotificationsFilters {
    userId: string;
    page: number;
    pageSize: number;
}

export interface PaginatedNotifications {
    data: Notification[];
    total: number;
    page: number;
    pageSize: number;
}

export interface NotificationRepository {
    create(data: CreateNotificationInput): Promise<Notification>;

    listByUser(filters: ListNotificationsFilters): Promise<PaginatedNotifications>;

    listByUserCursor(userId: string, cursor: number, limit: number): Promise<Notification[]>;

    markRead(id: string | number): Promise<void>;

    findById(id: string | number): Promise<Notification | null>;

    delete(id: string | number): Promise<void>;
}

export const NOTIFICATION_REPOSITORY = Symbol("NOTIFICATION_REPOSITORY");

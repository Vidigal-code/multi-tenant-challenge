import {Injectable} from "@nestjs/common";
import {PrismaService} from "../services/prisma.service";
import {
    CreateNotificationInput,
    ListNotificationsFilters,
    NOTIFICATION_REPOSITORY,
    NotificationRepository,
    PaginatedNotifications,
} from "@domain/repositories/notifications/notification.repository";
import {Notification} from "@domain/entities/notifications/notification.entity";

@Injectable()
export class NotificationPrismaRepository implements NotificationRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async create(data: CreateNotificationInput): Promise<Notification> {
        const created = await (this.prisma as any).notification.create({
            data: {
                companyId: data.companyId,
                senderUserId: data.senderUserId,
                recipientUserId: data.recipientUserId ?? null,
                recipientsEmails: (data.recipientsEmails == null ? undefined : data.recipientsEmails) as any,
                title: data.title,
                body: data.body ?? '',
                meta: data.meta ?? {},
            },
        });
        return this.toDomain(created);
    }

    async listByUser(filters: ListNotificationsFilters): Promise<PaginatedNotifications> {
        const {userId, page, pageSize} = filters;
        const skip = (page - 1) * pageSize;

        const [rows, total] = await (this.prisma as any).$transaction([
            (this.prisma as any).notification.findMany({
                where: {
                    OR: [
                        {recipientUserId: userId},
                        {
                            AND: [
                                {recipientUserId: null},
                                {company: {memberships: {some: {userId}}}},
                            ],
                        },
                    ],
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {createdAt: "desc"},
                skip,
                take: pageSize,
            }),
            (this.prisma as any).notification.count({
                where: {
                    OR: [
                        {recipientUserId: userId},
                        {
                            AND: [
                                {recipientUserId: null},
                                {company: {memberships: {some: {userId}}}},
                            ],
                        },
                    ],
                },
            }),
        ]);
        return {data: rows.map((r: any) => this.toDomainWithSender(r)), total, page, pageSize};
    }

    async markRead(id: string | number): Promise<void> {
        await (this.prisma as any).notification.update({
            where: {id: Number(id)},
            data: {read: true},
        });
    }

    async findById(id: string | number): Promise<Notification | null> {
        const record = await (this.prisma as any).notification.findUnique({where: {id: Number(id)}});
        return record ? this.toDomain(record) : null;
    }

    async delete(id: string | number): Promise<void> {
        await (this.prisma as any).notification.delete({where: {id: Number(id)}});
    }

    private toDomain(record: any): Notification {
        return Notification.create({
            id: record.id,
            companyId: record.companyId,
            senderUserId: record.senderUserId,
            recipientUserId: record.recipientUserId,
            recipientsEmails: record.recipientsEmails,
            title: record.title,
            body: record.body,
            createdAt: record.createdAt,
            read: record.read,
            meta: record.meta || {},
        });
    }

    private toDomainWithSender(record: any): Notification {
        const meta = record.meta || {};
        if (!meta.sender && record.sender) {
            meta.sender = {
                id: record.sender.id,
                name: record.sender.name,
                email: record.sender.email,
            };
        }
        return Notification.create({
            id: record.id,
            companyId: record.companyId,
            senderUserId: record.senderUserId,
            recipientUserId: record.recipientUserId,
            recipientsEmails: record.recipientsEmails,
            title: record.title,
            body: record.body,
            createdAt: record.createdAt,
            read: record.read,
            meta,
        });
    }
}

export const notificationRepositoryProvider = {
    provide: NOTIFICATION_REPOSITORY,
    useClass: NotificationPrismaRepository,
};

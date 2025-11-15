import {NOTIFICATION_REPOSITORY, NotificationRepository} from '@domain/repositories/notification.repository';
import {Inject} from '@nestjs/common';
import {DomainEventsService} from '@domain/services/domain-events.service';
import {ApplicationError} from '@application/errors/application-error';

export interface MarkNotificationReadInput {
    notificationId: number | string;
    userId: string;
}

export class MarkNotificationReadUseCase {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: MarkNotificationReadInput) {
        const notif = await this.notifications.findById(input.notificationId);
        if (!notif) throw new ApplicationError('NOTIFICATION_NOT_FOUND');
        if (notif.recipientUserId && notif.recipientUserId !== input.userId) {
            throw new ApplicationError('FORBIDDEN_NOTIFICATION');
        }
        await this.notifications.markRead(input.notificationId);
        await this.domainEvents.publish({
            name: 'notification.read',
            payload: {
                notificationId: Number(input.notificationId),
                companyId: notif.companyId,
                recipientUserId: notif.recipientUserId,
            },
        });
        return {success: true};
    }
}

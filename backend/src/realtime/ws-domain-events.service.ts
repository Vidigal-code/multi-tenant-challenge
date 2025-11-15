import {Injectable} from '@nestjs/common';
import {DomainEvent, DomainEventsService} from '@domain/services/domain-events.service';
import {RabbitMQDomainEventsService} from '@infrastructure/messaging/domain-events.service';
import {EventsGateway, RT_EVENT} from './events.gateway';
import {NotificationCreatorService} from '@application/services/notification-creator.service';

@Injectable()
export class WsDomainEventsBridgeService implements DomainEventsService {
    constructor(
        private readonly rabbit: RabbitMQDomainEventsService,
        private readonly gateway: EventsGateway,
        private readonly notificationCreator: NotificationCreatorService,
    ) {
    }

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        await this.rabbit.publish(event);
        
        // Create notifications for system events
        await this.notificationCreator.createNotificationForEvent(event.name, event.payload);
        
        switch (event.name) {
            case 'company.updated': {
                const payload: any = event.payload;
                if (payload?.id) {
                    this.gateway.emitToCompany(payload.id, RT_EVENT.COMPANY_UPDATED, payload);
                }
                break;
            }
            case 'membership.joined': {
                const payload: any = event.payload;
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_JOINED, payload);
                }
                break;
            }
            case 'membership.left':
            case 'member.left': {
                const payload: any = event.payload;
                if (Array.isArray(payload?.notifiedUserIds) && payload.notifiedUserIds.length > 0) {
                    payload.notifiedUserIds.forEach((userId: string) => {
                        this.gateway.emitToUser(userId, RT_EVENT.MEMBER_LEFT, payload);
                    });
                } else if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_LEFT, payload);
                }
                break;
            }
            case 'notification.created':
            case 'notification.sent':
            case 'notification.replied': {
                const payload: any = event.payload;
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.NOTIFICATION_CREATED, payload);
                }
                if (payload?.recipientUserId) {
                    this.gateway.emitToUser(payload.recipientUserId, RT_EVENT.NOTIFICATION_CREATED, payload);
                }
                break;
            }
            case 'membership.removed': {
                const payload: any = event.payload;
                if (Array.isArray(payload?.notifiedUserIds) && payload.notifiedUserIds.length > 0) {
                    payload.notifiedUserIds.forEach((userId: string) => {
                        this.gateway.emitToUser(userId, RT_EVENT.MEMBER_LEFT, payload);
                    });
                } else if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_LEFT, payload);
                }
                break;
            }
            case 'invite.rejected': {
                const payload: any = event.payload;
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.INVITE_REJECTED, payload);
                }
                break;
            }
            case 'notification.read': {
                const payload: any = event.payload;
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.NOTIFICATION_READ, payload);
                }
                if (payload?.recipientUserId) {
                    this.gateway.emitToUser(payload.recipientUserId, RT_EVENT.NOTIFICATION_READ, payload);
                }
                break;
            }
            case 'friend.request.sent': {
                const payload: any = event.payload;
                if (payload?.addresseeId) {
                    this.gateway.emitToUser(payload.addresseeId, RT_EVENT.FRIEND_REQUEST_SENT, payload);
                }
                break;
            }
            case 'friend.request.accepted': {
                const payload: any = event.payload;
                if (payload?.requesterId) {
                    this.gateway.emitToUser(payload.requesterId, RT_EVENT.FRIEND_REQUEST_ACCEPTED, payload);
                }
                if (payload?.addresseeId) {
                    this.gateway.emitToUser(payload.addresseeId, RT_EVENT.FRIEND_REQUEST_ACCEPTED, payload);
                }
                break;
            }
            case 'friend.request.rejected':
            case 'friend.removed': {
                const payload: any = event.payload;
                if (payload?.requesterId) {
                    this.gateway.emitToUser(payload.requesterId, RT_EVENT.FRIEND_REMOVED, payload);
                }
                if (payload?.addresseeId) {
                    this.gateway.emitToUser(payload.addresseeId, RT_EVENT.FRIEND_REMOVED, payload);
                }
                break;
            }
            default:
                break;
        }
    }
}

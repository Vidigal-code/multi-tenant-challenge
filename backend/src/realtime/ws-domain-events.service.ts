import {Inject, Injectable} from '@nestjs/common';
import {DomainEvent, DomainEventsService} from '@domain/services/domain-events.service';
import {RabbitMQDomainEventsService} from '@infrastructure/messaging/services/domain-events.service';
import {EventsGateway, RT_EVENT} from './events.gateway';
import {NotificationCreatorService} from '@application/services/notification-creator.service';
import {USER_REPOSITORY, UserRepository} from '@domain/repositories/users/user.repository';
import {
    NOTIFICATION_REPOSITORY,
    NotificationRepository
} from '@domain/repositories/notifications/notification.repository';

/**
 * WsDomainEventsBridgeService - Bridges domain events to WebSocket and RabbitMQ
 * 
 * Architecture for millions of users:
 * - Events are published to RabbitMQ for async processing (non-blocking)
 * - Notifications are created automatically for system events
 * - WebSocket events are emitted in real-time to connected clients
 * - Stateless design allows horizontal scaling
 * 
 * Event Flow:
 * 1. Domain event is published
 * 2. Event is sent to RabbitMQ for async processing (non-blocking)
 * 3. Notification is created for the event
 * 4. WebSocket event is emitted to relevant users/companies
 * 
 * This ensures:
 * - WebSocket remains responsive (non-blocking)
 * - Events are processed reliably via RabbitMQ
 * - Notifications are always created and stored
 * - Real-time updates are delivered immediately
 * 
 * Serviço que conecta eventos de domínio ao WebSocket e RabbitMQ
 * 
 * Arquitetura para milhões de usuários:
 * - Eventos são publicados no RabbitMQ para processamento assíncrono (não-bloqueante)
 * - Notificações são criadas automaticamente para eventos do sistema
 * - Eventos WebSocket são emitidos em tempo real para clientes conectados
 * - Design stateless permite escalonamento horizontal
 * 
 * Fluxo de Eventos:
 * 1. Evento de domínio é publicado
 * 2. Evento é enviado ao RabbitMQ para processamento assíncrono (não-bloqueante)
 * 3. Notificação é criada para o evento
 * 4. Evento WebSocket é emitido para usuários/empresas relevantes
 * 
 * Isto garante:
 * - WebSocket permanece responsivo (não-bloqueante)
 * - Eventos são processados de forma confiável via RabbitMQ
 * - Notificações são sempre criadas e armazenadas
 * - Atualizações em tempo real são entregues imediatamente
 */
@Injectable()
export class WsDomainEventsBridgeService implements DomainEventsService {
    constructor(
        private readonly rabbit: RabbitMQDomainEventsService,
        private readonly gateway: EventsGateway,
        private readonly notificationCreator: NotificationCreatorService,
        @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
        @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepo: NotificationRepository,
    ) {
    }

    private getCategoryFromEvent(eventName: string): string | null {
        if (eventName === 'invites.created' || eventName === 'invites.accepted' || eventName === 'invites.rejected') {
            return 'companyInvitations';
        }
        if (eventName === 'friend.request.sent' || eventName === 'friend.request.accepted' || 
            eventName === 'friend.request.rejected' || eventName === 'friend.removed') {
            return 'friendRequests';
        }
        if (eventName === 'notifications.sent' || eventName === 'notifications.replied' || 
            eventName === 'notifications.created') {
            return 'companyMessages';
        }
        if (eventName === 'memberships.joined' || eventName === 'memberships.removed' || 
            eventName === 'memberships.left') {
            return 'membershipChanges';
        }
        if (eventName === 'memberships.role.updated') {
            return 'roleChanges';
        }
        return null;
    }

    private getCategoryFromNotificationKind(payload: any): string | null {
        const kind = payload?.meta?.kind || payload?.kind;
        if (!kind) return null;

        if (kind.includes('invite')) {
            return 'companyInvitations';
        }
        if (kind.includes('friend')) {
            return 'friendRequests';
        }
        if (kind === 'notification.sent' || kind === 'notifications.sent' || 
            kind === 'notification.reply' || kind === 'notifications.replied') {
            return 'companyMessages';
        }
        if (kind === 'member.added' || kind === 'membership.joined' || 
            kind === 'member.removed' || kind === 'membership.removed') {
            return 'membershipChanges';
        }
        if (kind === 'role.changed' || kind === 'membership.role.updated') {
            return 'roleChanges';
        }
        return null;
    }

    private async getCategoryFromNotificationId(notificationId: string | number | bigint): Promise<string | null> {
        try {
            const id = typeof notificationId === 'bigint' ? Number(notificationId) : notificationId;
            const notification = await this.notificationRepo.findById(id);
            if (!notification) return null;
            
            const meta = notification.meta || {};
            return this.getCategoryFromNotificationKind({ meta });
        } catch {
            return null;
        }
    }

    private async shouldEmitToUser(userId: string): Promise<boolean> {
        try {
            const user = await this.userRepo.findById(userId);
            if (!user) return false;
            
            const prefs = user.notificationPreferences || {};
            return prefs.realtimeEnabled !== false;
        } catch {
            return false;
        }
    }

    private async shouldEmitCategory(userId: string, category: string | null): Promise<boolean> {
        if (!category) return true;
        
        try {
            const user = await this.userRepo.findById(userId);
            if (!user) return false;
            
            const prefs = user.notificationPreferences || {};
            
            if (prefs.realtimeEnabled === false) return false;
            
            return prefs[category] !== false;
        } catch {
            return false;
        }
    }

    private async emitToUserIfAllowed(userId: string, event: string, payload: any, eventName: string): Promise<void> {
        const shouldEmit = await this.shouldEmitToUser(userId);
        if (!shouldEmit) return;

        let category: string | null = null;
        if (payload?.notificationId) {
            category = await this.getCategoryFromNotificationId(payload.notificationId);
        }
        
        if (!category) {
            category = this.getCategoryFromNotificationKind(payload);
        }
        
        if (!category) {
            category = this.getCategoryFromEvent(eventName);
        }
        
        const categoryAllowed = await this.shouldEmitCategory(userId, category);
        if (!categoryAllowed) return;

        this.gateway.emitToUser(userId, event, payload);
    }

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        await this.rabbit.publish(event);
        
        await this.notificationCreator.createNotificationForEvent(event.name, event.payload);
        
        switch (event.name) {
            case 'companys.updated': {
                const payload: any = event.payload;
                if (payload?.id) {
                    this.gateway.emitToCompany(payload.id, RT_EVENT.COMPANY_UPDATED, payload);
                }
                break;
            }
            case 'memberships.joined': {
                const payload: any = event.payload;
                if (payload?.userId) {
                    await this.emitToUserIfAllowed(
                        payload.userId,
                        RT_EVENT.MEMBER_JOINED,
                        payload,
                        event.name
                    );
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_JOINED, payload);
                }
                break;
            }
            case 'memberships.left':
            case 'member.left': {
                const payload: any = event.payload;
                if (Array.isArray(payload?.notifiedUserIds) && payload.notifiedUserIds.length > 0) {
                    for (const userId of payload.notifiedUserIds) {
                        await this.emitToUserIfAllowed(userId, RT_EVENT.MEMBER_LEFT, payload, event.name);
                    }
                } else if (payload?.userId) {
                    await this.emitToUserIfAllowed(payload.userId, RT_EVENT.MEMBER_LEFT, payload, event.name);
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_LEFT, payload);
                }
                break;
            }
            case 'notifications.created':
            case 'notifications.sent':
            case 'notifications.replied': {
                const payload: any = event.payload;
                if (payload?.recipientUserId) {
                    await this.emitToUserIfAllowed(
                        payload.recipientUserId,
                        RT_EVENT.NOTIFICATION_CREATED,
                        payload,
                        event.name
                    );
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.NOTIFICATION_CREATED, payload);
                }
                break;
            }
            case 'memberships.removed': {
                const payload: any = event.payload;
                if (Array.isArray(payload?.notifiedUserIds) && payload.notifiedUserIds.length > 0) {
                    for (const userId of payload.notifiedUserIds) {
                        await this.emitToUserIfAllowed(userId, RT_EVENT.MEMBER_LEFT, payload, event.name);
                    }
                } else if (payload?.userId) {
                    await this.emitToUserIfAllowed(payload.userId, RT_EVENT.MEMBER_LEFT, payload, event.name);
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.MEMBER_LEFT, payload);
                }
                break;
            }
            case 'invites.created': {
                const payload: any = event.payload;
                if (payload?.recipientUserId || payload?.invitedUserId || payload?.email) {
                    if (payload.recipientUserId) {
                        await this.emitToUserIfAllowed(payload.recipientUserId, RT_EVENT.NOTIFICATION_CREATED, payload, event.name);
                    }
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.NOTIFICATION_CREATED, payload);
                }
                break;
            }
            case 'invites.accepted': {
                const payload: any = event.payload;
                if (payload?.inviterId) {
                    await this.emitToUserIfAllowed(payload.inviterId, RT_EVENT.NOTIFICATION_CREATED, payload, event.name);
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.NOTIFICATION_CREATED, payload);
                }
                break;
            }
            case 'invites.rejected': {
                const payload: any = event.payload;
                if (payload?.inviterId) {
                    await this.emitToUserIfAllowed(payload.inviterId, RT_EVENT.INVITE_REJECTED, payload, event.name);
                }
                if (payload?.companyId) {
                    this.gateway.emitToCompany(payload.companyId, RT_EVENT.INVITE_REJECTED, payload);
                }
                break;
            }
            case 'notifications.read': {
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
                    await this.emitToUserIfAllowed(
                        payload.addresseeId,
                        RT_EVENT.FRIEND_REQUEST_SENT,
                        payload,
                        event.name
                    );
                }
                break;
            }
            case 'friend.request.accepted': {
                const payload: any = event.payload;
                if (payload?.requesterId) {
                    await this.emitToUserIfAllowed(
                        payload.requesterId,
                        RT_EVENT.FRIEND_REQUEST_ACCEPTED,
                        payload,
                        event.name
                    );
                }
                if (payload?.addresseeId) {
                    await this.emitToUserIfAllowed(
                        payload.addresseeId,
                        RT_EVENT.FRIEND_REQUEST_ACCEPTED,
                        payload,
                        event.name
                    );
                }
                break;
            }
            case 'friend.request.rejected':
            case 'friend.removed': {
                const payload: any = event.payload;
                if (payload?.requesterId) {
                    await this.emitToUserIfAllowed(
                        payload.requesterId,
                        RT_EVENT.FRIEND_REMOVED,
                        payload,
                        event.name
                    );
                }
                if (payload?.addresseeId) {
                    await this.emitToUserIfAllowed(
                        payload.addresseeId,
                        RT_EVENT.FRIEND_REMOVED,
                        payload,
                        event.name
                    );
                }
                break;
            }
            default:
                break;
        }
    }
}

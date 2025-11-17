import { Inject, Injectable } from "@nestjs/common";
import {
  DomainEvent,
  DomainEventsService,
} from "@domain/services/domain-events.service";
import { RabbitMQDomainEventsService } from "@infrastructure/messaging/services/domain-events.service";
import { EventsGateway, RT_EVENT } from "./events.gateway";
import { NotificationCreatorService } from "@application/services/notification-creator.service";
import {
  USER_REPOSITORY,
  UserRepository,
} from "@domain/repositories/users/user.repository";
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from "@domain/repositories/notifications/notification.repository";

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
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: NotificationRepository,
  ) {}

  private getCategoryFromEvent(eventName: string): string | null {
    if (
      eventName === "invites.created" ||
      eventName === "invites.accepted" ||
      eventName === "invites.rejected"
    ) {
      return "companyInvitations";
    }
    if (
      eventName === "friend.request.sent" ||
      eventName === "friend.request.accepted" ||
      eventName === "friend.request.rejected" ||
      eventName === "friend.removed"
    ) {
      return "friendRequests";
    }
    if (
      eventName === "notifications.sent" ||
      eventName === "notifications.replied" ||
      eventName === "notifications.created"
    ) {
      return "companyMessages";
    }
    if (
      eventName === "memberships.joined" ||
      eventName === "memberships.removed" ||
      eventName === "memberships.left"
    ) {
      return "membershipChanges";
    }
    if (eventName === "memberships.role.updated") {
      return "roleChanges";
    }
    return null;
  }

  private getCategoryFromNotificationKind(payload: any): string | null {
    const kind = payload?.meta?.kind || payload?.kind;
    if (!kind) return null;

    if (kind.includes("invite")) {
      return "companyInvitations";
    }
    if (kind.includes("friend")) {
      return "friendRequests";
    }
    if (
      kind === "notification.sent" ||
      kind === "notifications.sent" ||
      kind === "notification.reply" ||
      kind === "notifications.replied"
    ) {
      return "companyMessages";
    }
    if (
      kind === "member.added" ||
      kind === "membership.joined" ||
      kind === "member.removed" ||
      kind === "membership.removed"
    ) {
      return "membershipChanges";
    }
    if (kind === "role.changed" || kind === "membership.role.updated") {
      return "roleChanges";
    }
    return null;
  }

  private async getCategoryFromNotificationId(
    notificationId: string | number | bigint,
  ): Promise<string | null> {
    try {
      const id =
        typeof notificationId === "bigint"
          ? Number(notificationId)
          : notificationId;
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

  private async shouldEmitCategory(
    userId: string,
    category: string | null,
  ): Promise<boolean> {
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

  private async emitToUserIfAllowed(
    userId: string,
    event: string,
    payload: any,
    eventName: string,
  ): Promise<void> {
    const shouldEmit = await this.shouldEmitToUser(userId);
    if (!shouldEmit) return;

    let category: string | null = null;
    if (payload?.notificationId) {
      category = await this.getCategoryFromNotificationId(
        payload.notificationId,
      );
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

  /**
   * EN -
   * Handles company update events by emitting WebSocket events to the company room.
   * Emits to all members connected to the company when company data is updated.
   *
   * PT -
   * Trata eventos de atualização de empresa emitindo eventos WebSocket para a sala da empresa.
   * Emite para todos os membros conectados à empresa quando dados da empresa são atualizados.
   *
   * @param payload - Event payload containing company data
   */
  private async handleCompanyUpdated(payload: any): Promise<void> {
    if (payload?.id) {
      this.gateway.emitToCompany(payload.id, RT_EVENT.COMPANY_UPDATED, payload);
    }
  }

  /**
   * EN -
   * Handles membership joined events by emitting WebSocket events to user and company.
   * Notifies the user who joined and all company members about the new membership.
   *
   * PT -
   * Trata eventos de entrada de membro emitindo eventos WebSocket para usuário e empresa.
   * Notifica o usuário que entrou e todos os membros da empresa sobre a nova associação.
   *
   * @param payload - Event payload containing membership data
   * @param eventName - Name of the domain event
   */
  private async handleMembershipJoined(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.userId) {
      await this.emitToUserIfAllowed(
        payload.userId,
        RT_EVENT.MEMBER_JOINED,
        payload,
        eventName,
      );
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.MEMBER_JOINED,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles membership left/removed events by emitting WebSocket events to affected users and company.
   * Supports both single user and multiple users notification scenarios.
   *
   * PT -
   * Trata eventos de saída/remoção de membro emitindo eventos WebSocket para usuários afetados e empresa.
   * Suporta cenários de notificação de usuário único e múltiplos usuários.
   *
   * @param payload - Event payload containing membership data
   * @param eventName - Name of the domain event
   */
  private async handleMembershipLeft(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (
      Array.isArray(payload?.notifiedUserIds) &&
      payload.notifiedUserIds.length > 0
    ) {
      for (const userId of payload.notifiedUserIds) {
        await this.emitToUserIfAllowed(
          userId,
          RT_EVENT.MEMBER_LEFT,
          payload,
          eventName,
        );
      }
    } else if (payload?.userId) {
      await this.emitToUserIfAllowed(
        payload.userId,
        RT_EVENT.MEMBER_LEFT,
        payload,
        eventName,
      );
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.MEMBER_LEFT,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles notification created/sent/replied events by emitting WebSocket events to recipient and company.
   * Notifies the recipient user and all company members about the notification.
   *
   * PT -
   * Trata eventos de notificação criada/enviada/respondida emitindo eventos WebSocket para destinatário e empresa.
   * Notifica o usuário destinatário e todos os membros da empresa sobre a notificação.
   *
   * @param payload - Event payload containing notification data
   * @param eventName - Name of the domain event
   */
  private async handleNotificationCreated(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.recipientUserId) {
      await this.emitToUserIfAllowed(
        payload.recipientUserId,
        RT_EVENT.NOTIFICATION_CREATED,
        payload,
        eventName,
      );
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.NOTIFICATION_CREATED,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles invite created events by emitting WebSocket events to recipient and company.
   * Notifies the invited user and company members about the new invitation.
   *
   * PT -
   * Trata eventos de convite criado emitindo eventos WebSocket para destinatário e empresa.
   * Notifica o usuário convidado e membros da empresa sobre o novo convite.
   *
   * @param payload - Event payload containing invite data
   * @param eventName - Name of the domain event
   */
  private async handleInviteCreated(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.recipientUserId || payload?.invitedUserId || payload?.email) {
      if (payload.recipientUserId) {
        await this.emitToUserIfAllowed(
          payload.recipientUserId,
          RT_EVENT.NOTIFICATION_CREATED,
          payload,
          eventName,
        );
      }
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.NOTIFICATION_CREATED,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles invite accepted events by emitting WebSocket events to inviter and company.
   * Notifies the user who sent the invite and company members about the acceptance.
   *
   * PT -
   * Trata eventos de convite aceito emitindo eventos WebSocket para convidador e empresa.
   * Notifica o usuário que enviou o convite e membros da empresa sobre a aceitação.
   *
   * @param payload - Event payload containing invite acceptance data
   * @param eventName - Name of the domain event
   */
  private async handleInviteAccepted(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.inviterId) {
      await this.emitToUserIfAllowed(
        payload.inviterId,
        RT_EVENT.NOTIFICATION_CREATED,
        payload,
        eventName,
      );
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.NOTIFICATION_CREATED,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles invite rejected events by emitting WebSocket events to inviter and company.
   * Notifies the user who sent the invite and company members about the rejection.
   *
   * PT -
   * Trata eventos de convite rejeitado emitindo eventos WebSocket para convidador e empresa.
   * Notifica o usuário que enviou o convite e membros da empresa sobre a rejeição.
   *
   * @param payload - Event payload containing invite rejection data
   * @param eventName - Name of the domain event
   */
  private async handleInviteRejected(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.inviterId) {
      await this.emitToUserIfAllowed(
        payload.inviterId,
        RT_EVENT.INVITE_REJECTED,
        payload,
        eventName,
      );
    }
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.INVITE_REJECTED,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles notification read events by emitting WebSocket events to recipient and company.
   * Notifies about notification read status to keep UI synchronized.
   *
   * PT -
   * Trata eventos de notificação lida emitindo eventos WebSocket para destinatário e empresa.
   * Notifica sobre status de leitura da notificação para manter UI sincronizada.
   *
   * @param payload - Event payload containing notification read data
   */
  private async handleNotificationRead(payload: any): Promise<void> {
    if (payload?.companyId) {
      this.gateway.emitToCompany(
        payload.companyId,
        RT_EVENT.NOTIFICATION_READ,
        payload,
      );
    }
    if (payload?.recipientUserId) {
      this.gateway.emitToUser(
        payload.recipientUserId,
        RT_EVENT.NOTIFICATION_READ,
        payload,
      );
    }
  }

  /**
   * EN -
   * Handles friend request sent events by emitting WebSocket events to the addressee.
   * Notifies the user who received the friend request.
   *
   * PT -
   * Trata eventos de solicitação de amizade enviada emitindo eventos WebSocket para o destinatário.
   * Notifica o usuário que recebeu a solicitação de amizade.
   *
   * @param payload - Event payload containing friend request data
   * @param eventName - Name of the domain event
   */
  private async handleFriendRequestSent(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.addresseeId) {
      await this.emitToUserIfAllowed(
        payload.addresseeId,
        RT_EVENT.FRIEND_REQUEST_SENT,
        payload,
        eventName,
      );
    }
  }

  /**
   * EN -
   * Handles friend request accepted events by emitting WebSocket events to both users.
   * Notifies both the requester and addressee about the friendship acceptance.
   *
   * PT -
   * Trata eventos de solicitação de amizade aceita emitindo eventos WebSocket para ambos os usuários.
   * Notifica tanto o solicitante quanto o destinatário sobre a aceitação da amizade.
   *
   * @param payload - Event payload containing friend request acceptance data
   * @param eventName - Name of the domain event
   */
  private async handleFriendRequestAccepted(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.requesterId) {
      await this.emitToUserIfAllowed(
        payload.requesterId,
        RT_EVENT.FRIEND_REQUEST_ACCEPTED,
        payload,
        eventName,
      );
    }
    if (payload?.addresseeId) {
      await this.emitToUserIfAllowed(
        payload.addresseeId,
        RT_EVENT.FRIEND_REQUEST_ACCEPTED,
        payload,
        eventName,
      );
    }
  }

  /**
   * EN -
   * Handles friend request rejected/removed events by emitting WebSocket events to both users.
   * Notifies both the requester and addressee about the friendship rejection or removal.
   *
   * PT -
   * Trata eventos de solicitação de amizade rejeitada/removida emitindo eventos WebSocket para ambos os usuários.
   * Notifica tanto o solicitante quanto o destinatário sobre a rejeição ou remoção da amizade.
   *
   * @param payload - Event payload containing friend request rejection/removal data
   * @param eventName - Name of the domain event
   */
  private async handleFriendRequestRejectedOrRemoved(
    payload: any,
    eventName: string,
  ): Promise<void> {
    if (payload?.requesterId) {
      await this.emitToUserIfAllowed(
        payload.requesterId,
        RT_EVENT.FRIEND_REMOVED,
        payload,
        eventName,
      );
    }
    if (payload?.addresseeId) {
      await this.emitToUserIfAllowed(
        payload.addresseeId,
        RT_EVENT.FRIEND_REMOVED,
        payload,
        eventName,
      );
    }
  }

  /**
   * EN -
   * Routes domain events to appropriate event handlers based on event name.
   * Uses strategy pattern to delegate event processing to specialized handlers.
   *
   * PT -
   * Roteia eventos de domínio para handlers apropriados baseado no nome do evento.
   * Usa padrão strategy para delegar processamento de eventos para handlers especializados.
   *
   * @param event - Domain event to route
   */
  private async routeEventToHandler<T>(event: DomainEvent<T>): Promise<void> {
    const payload: any = event.payload;

    switch (event.name) {
      case "companys.updated":
        await this.handleCompanyUpdated(payload);
        break;
      case "memberships.joined":
        await this.handleMembershipJoined(payload, event.name);
        break;
      case "memberships.left":
      case "member.left":
        await this.handleMembershipLeft(payload, event.name);
        break;
      case "notifications.created":
      case "notifications.sent":
      case "notifications.replied":
        await this.handleNotificationCreated(payload, event.name);
        break;
      case "memberships.removed":
        await this.handleMembershipLeft(payload, event.name);
        break;
      case "invites.created":
        await this.handleInviteCreated(payload, event.name);
        break;
      case "invites.accepted":
        await this.handleInviteAccepted(payload, event.name);
        break;
      case "invites.rejected":
        await this.handleInviteRejected(payload, event.name);
        break;
      case "notifications.read":
        await this.handleNotificationRead(payload);
        break;
      case "friend.request.sent":
        await this.handleFriendRequestSent(payload, event.name);
        break;
      case "friend.request.accepted":
        await this.handleFriendRequestAccepted(payload, event.name);
        break;
      case "friend.request.rejected":
      case "friend.removed":
        await this.handleFriendRequestRejectedOrRemoved(payload, event.name);
        break;
      default:
        break;
    }
  }

  /**
   * EN -
   * Publishes a domain event to RabbitMQ, creates notification, and emits WebSocket events.
   * Orchestrates the complete event processing pipeline: messaging, notification, and real-time updates.
   * Ensures events are processed asynchronously via RabbitMQ while providing immediate WebSocket feedback.
   *
   * PT -
   * Publica um evento de domínio no RabbitMQ, cria notificação e emite eventos WebSocket.
   * Orquestra o pipeline completo de processamento de eventos: mensageria, notificação e atualizações em tempo real.
   * Garante que eventos sejam processados assincronamente via RabbitMQ enquanto fornece feedback imediato via WebSocket.
   *
   * @param event - Domain event to publish
   */
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    await this.rabbit.publish(event);

    await this.notificationCreator.createNotificationForEvent(
      event.name,
      event.payload,
    );

    await this.routeEventToHandler(event);
  }
}

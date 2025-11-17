import { Injectable, Inject } from "@nestjs/common";
import {
  NotificationRepository,
  NOTIFICATION_REPOSITORY,
} from "@domain/repositories/notifications/notification.repository";
import {
  UserRepository,
  USER_REPOSITORY,
} from "@domain/repositories/users/user.repository";
import {
  CompanyRepository,
  COMPANY_REPOSITORY,
} from "@domain/repositories/companys/company.repository";
import {
  InviteRepository,
  INVITE_REPOSITORY,
} from "@domain/repositories/invites/invite.repository";
import {
  FriendshipRepository,
  FRIENDSHIP_REPOSITORY,
} from "@domain/repositories/friendships/friendship.repository";
import {
  MembershipRepository,
  MEMBERSHIP_REPOSITORY,
} from "@domain/repositories/memberships/membership.repository";
import { DomainEventsService } from "@domain/services/domain-events.service";
import { ConfigService } from "@nestjs/config";
import { NotificationMessageFormatterService } from "./notification-message-formatter.service";
import { Role } from "@domain/enums/role.enum";
import { LoggerService } from "@infrastructure/logging/logger.service";

/**
 * EN -
 * NotificationCreatorService - Service responsible for creating notifications based on domain events.
 *
 * This service handles the creation of notifications for various domain events such as friend requests,
 * invites, membership changes, and company updates. It follows SOLID principles with single-responsibility
 * methods for each operation.
 *
 * Architecture:
 * - Routes events to appropriate handlers based on event name
 * - Extracts user and company information from payloads
 * - Formats notification messages using NotificationMessageFormatterService
 * - Creates notifications in the database
 * - Emits domain events for notification creation
 *
 * PT -
 * NotificationCreatorService - Serviço responsável por criar notificações baseadas em eventos de domínio.
 *
 * Este serviço gerencia a criação de notificações para vários eventos de domínio como solicitações de amizade,
 * convites, mudanças de associação e atualizações de empresa. Segue princípios SOLID com métodos de responsabilidade
 * única para cada operação.
 *
 * Arquitetura:
 * - Roteia eventos para handlers apropriados baseado no nome do evento
 * - Extrai informações de usuário e empresa dos payloads
 * - Formata mensagens de notificação usando NotificationMessageFormatterService
 * - Cria notificações no banco de dados
 * - Emite eventos de domínio para criação de notificação
 */
@Injectable()
export class NotificationCreatorService {
  private readonly logger: LoggerService;

  constructor(
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: NotificationRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    @Inject(INVITE_REPOSITORY) private readonly inviteRepo: InviteRepository,
    @Inject(FRIENDSHIP_REPOSITORY)
    private readonly friendshipRepo: FriendshipRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: MembershipRepository,
    @Inject("DOMAIN_EVENTS_SERVICE")
    private readonly domainEvents: DomainEventsService,
    private readonly configService: ConfigService,
    private readonly messageFormatter: NotificationMessageFormatterService,
  ) {
    this.logger = new LoggerService("NotificationCreator", this.configService);
  }

  /**
   * EN -
   * Creates a notification for a specific domain event by routing to the appropriate handler.
   * Handles errors gracefully and logs detailed error information for debugging.
   *
   * PT -
   * Cria uma notificação para um evento de domínio específico roteando para o handler apropriado.
   * Trata erros graciosamente e registra informações detalhadas de erro para depuração.
   *
   * @param eventName - Name of the domain event (e.g., 'friend.request.sent', 'invite.created')
   * @param payload - Event payload containing data needed to create the notification
   */
  async createNotificationForEvent(
    eventName: string,
    payload: any,
  ): Promise<void> {
    try {
      switch (eventName) {
        case "notification.sent":
        case "notifications.sent":
          await this.handleNotificationSent(payload);
          break;
        case "friend.request.sent":
          await this.handleFriendRequestSent(payload);
          break;
        case "friend.request.accepted":
          await this.handleFriendRequestAccepted(payload);
          break;
        case "friend.request.rejected":
          await this.handleFriendRequestRejected(payload);
          break;
        case "friend.removed":
          await this.handleFriendRemoved(payload);
          break;
        case "invite.created":
        case "invites.created":
          this.logger.notificationCreator(
            `Handling invite.created, inviteId=${payload?.inviteId}, invitedEmail=${payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email}`,
          );
          await this.handleInviteCreated(payload);
          break;
        case "invite.accepted":
        case "invites.accepted":
          await this.handleInviteAccepted(payload);
          break;
        case "invite.rejected":
        case "invites.rejected":
          await this.handleInviteRejected(payload);
          break;
        case "membership.joined":
        case "memberships.joined":
          await this.handleMemberAdded(payload);
          break;
        case "membership.removed":
        case "memberships.removed":
          await this.handleMemberRemoved(payload);
          break;
        case "membership.role.updated":
        case "memberships.role.updated":
          await this.handleRoleChanged(payload);
          break;
        case "companys.created":
          await this.handleCompanyCreated(payload);
          break;
        case "companys.updated":
          await this.handleCompanyUpdated(payload);
          break;
        case "companys.deleted":
          await this.handleCompanyDeleted(payload);
          break;
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to create notification for event ${eventName}:`,
        error,
      );
      this.logger.error(`Error message: ${error?.message || String(error)}`);
      this.logger.error(`Error stack: ${error?.stack || "No stack trace"}`);
      if (
        error?.message?.includes("inviteId") ||
        error?.message?.includes("invitedEmail")
      ) {
        this.logger.error(
          `Payload received:`,
          JSON.stringify(payload, null, 2),
        );
      }
    }
  }

  /**
   * EN -
   * Emits a domain event indicating that a notification was created.
   * This allows other parts of the system to react to notification creation.
   *
   * PT -
   * Emite um evento de domínio indicando que uma notificação foi criada.
   * Isto permite que outras partes do sistema reajam à criação de notificação.
   *
   * @param notification - The created notification object
   * @param companyId - Company ID associated with the notification (null if not company-related)
   * @param recipientUserId - ID of the user receiving the notification
   * @param senderUserId - ID of the user sending the notification
   */
  private async emitNotificationCreated(
    notification: any,
    companyId: string | null,
    recipientUserId: string | null,
    senderUserId: string | null,
  ): Promise<void> {
    await this.domainEvents.publish({
      name: "notifications.created",
      payload: {
        notificationId: notification.id,
        companyId: companyId || null,
        recipientUserId: recipientUserId || null,
        senderUserId: senderUserId || null,
      },
    });
  }

  /**
   * EN -
   * Converts a date value to ISO string format.
   * Handles both Date objects and ISO string dates safely.
   *
   * PT -
   * Converte um valor de data para formato ISO string.
   * Trata tanto objetos Date quanto strings ISO de forma segura.
   *
   * @param date - Date value to convert (Date object, ISO string, or undefined)
   * @returns ISO string representation of the date, or undefined if invalid
   */
  private toISOString(date: any): string | undefined {
    if (!date) return undefined;
    if (date instanceof Date) {
      return date.toISOString();
    }
    if (typeof date === "string") {
      return date;
    }
    return undefined;
  }

  /**
   * EN -
   * Retrieves comprehensive company information including member count and primary owner details.
   * Used to enrich notification metadata with company context.
   *
   * PT -
   * Recupera informações abrangentes da empresa incluindo contagem de membros e detalhes do proprietário principal.
   * Usado para enriquecer metadados de notificação com contexto da empresa.
   *
   * @param companyId - ID of the company to retrieve information for
   * @returns Company information object with name, description, logo, member count, and owner details
   */
  private async getCompanyInfo(companyId: string | null): Promise<{
    companyName?: string;
    companyId?: string;
    companyDescription?: string;
    companyLogoUrl?: string;
    companyCreatedAt?: string;
    companyMemberCount?: number;
    companyOwnerName?: string;
    companyOwnerEmail?: string;
  }> {
    if (!companyId) return {};

    try {
      const company = await this.companyRepo.findById(companyId);
      if (!company) return { companyId };

      const members = await this.membershipRepo.listByCompany(companyId);
      const memberCount = members.length;

      const primaryOwnerInfo = await this.getPrimaryOwnerInfo(members);

      return {
        companyName: company.name,
        companyId: company.id,
        companyDescription: company.description || undefined,
        companyLogoUrl: company.logoUrl || undefined,
        companyCreatedAt: this.toISOString(company.createdAt),
        companyMemberCount: memberCount,
        companyOwnerName: primaryOwnerInfo.name,
        companyOwnerEmail: primaryOwnerInfo.email,
      };
    } catch (error) {
      this.logger.error(
        `Error getting company info for ${companyId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return { companyId };
    }
  }

  /**
   * EN -
   * Extracts primary owner information from a list of memberships.
   * Primary owner is determined as the oldest OWNER membership by creation date.
   *
   * PT -
   * Extrai informações do proprietário principal de uma lista de associações.
   * Proprietário principal é determinado como a associação OWNER mais antiga por data de criação.
   *
   * @param members - List of memberships to search for owners
   * @returns Object containing primary owner name and email, or undefined values if not found
   */
  private async getPrimaryOwnerInfo(
    members: any[],
  ): Promise<{ name?: string; email?: string }> {
    const ownerMemberships = members.filter((m) => m.role === Role.OWNER);
    if (ownerMemberships.length === 0) {
      return {};
    }

    ownerMemberships.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const primaryOwner = ownerMemberships[0];
    const primaryOwnerUser = await this.userRepo.findById(primaryOwner.userId);

    if (!primaryOwnerUser) {
      return {};
    }

    return {
      name: primaryOwnerUser.name,
      email: primaryOwnerUser.email.toString(),
    };
  }

  /**
   * EN -
   * Extracts sender user information from payload or fetches from repository.
   * Handles both cases where sender is already in payload or needs to be fetched by ID.
   *
   * PT -
   * Extrai informações do usuário remetente do payload ou busca do repositório.
   * Trata ambos os casos onde o remetente já está no payload ou precisa ser buscado por ID.
   *
   * @param payload - Event payload containing sender information
   * @param senderId - ID of the sender user (fallback if not in payload)
   * @returns User object representing the sender, or null if not found
   */
  private async extractSenderInfo(
    payload: any,
    senderId?: string | null,
  ): Promise<any | null> {
    if (payload?.sender) {
      return payload.sender;
    }
    if (senderId) {
      return await this.userRepo.findById(senderId);
    }
    return null;
  }

  /**
   * EN -
   * Extracts receiver user information from payload or fetches from repository.
   * Handles both cases where receiver is already in payload or needs to be fetched by ID.
   *
   * PT -
   * Extrai informações do usuário destinatário do payload ou busca do repositório.
   * Trata ambos os casos onde o destinatário já está no payload ou precisa ser buscado por ID.
   *
   * @param payload - Event payload containing receiver information
   * @param receiverId - ID of the receiver user (fallback if not in payload)
   * @returns User object representing the receiver, or null if not found
   */
  private async extractReceiverInfo(
    payload: any,
    receiverId?: string | null,
  ): Promise<any | null> {
    if (payload?.receiver) {
      return payload.receiver;
    }
    if (receiverId) {
      return await this.userRepo.findById(receiverId);
    }
    return null;
  }

  /**
   * EN -
   * Builds a standardized sender metadata object for notification meta.
   * Ensures consistent format across all notification types.
   *
   * PT -
   * Constrói um objeto de metadados do remetente padronizado para meta da notificação.
   * Garante formato consistente em todos os tipos de notificação.
   *
   * @param sender - User object representing the sender
   * @param senderId - Fallback sender ID if sender object doesn't have ID
   * @returns Standardized sender metadata object
   */
  private buildSenderMeta(
    sender: any,
    senderId?: string,
  ): {
    id: string;
    name: string;
    email: string;
  } {
    return {
      id: sender.id || senderId || "",
      name: sender.name,
      email: sender.email?.toString() || sender.email,
    };
  }

  /**
   * EN -
   * Builds a standardized company metadata object for notification meta.
   * Merges company data from payload with enriched company info.
   *
   * PT -
   * Constrói um objeto de metadados da empresa padronizado para meta da notificação.
   * Mescla dados da empresa do payload com informações enriquecidas da empresa.
   *
   * @param companyData - Company data from payload (may be partial)
   * @param companyInfo - Enriched company information from repository
   * @param companyId - Company ID
   * @returns Standardized company metadata object
   */
  private buildCompanyMeta(
    companyData: any,
    companyInfo: any,
    companyId: string,
  ): {
    id: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    createdAt: string | undefined;
    memberCount: number | undefined;
  } {
    return {
      id: companyData?.id || companyId,
      name: companyData?.name || companyInfo.companyName || "",
      description:
        companyData?.description || companyInfo.companyDescription || null,
      logoUrl: companyData?.logoUrl || companyInfo.companyLogoUrl || null,
      createdAt:
        this.toISOString(companyData?.createdAt) ||
        companyInfo.companyCreatedAt,
      memberCount: companyData?.memberCount || companyInfo.companyMemberCount,
    };
  }

  /**
   * EN -
   * Builds base notification metadata with common fields.
   * Includes event ID, timestamp, and channel information.
   *
   * PT -
   * Constrói metadados base da notificação com campos comuns.
   * Inclui ID do evento, timestamp e informações de canal.
   *
   * @param kind - Type of notification (e.g., 'friend.request.sent', 'invite.created')
   * @param channel - Channel type ('friend' or 'company')
   * @param payload - Event payload containing eventId and timestamp
   * @returns Base metadata object with common fields
   */
  private buildBaseMeta(
    kind: string,
    channel: string,
    payload: any,
  ): {
    kind: string;
    channel: string;
    eventId: string;
    timestamp: string;
  } {
    return {
      kind,
      channel,
      eventId: payload?.eventId || kind.toUpperCase().replace(/\./g, "_"),
      timestamp: payload?.timestamp || new Date().toISOString(),
    };
  }

  /**
   * EN -
   * Creates a notification in the database and emits the creation event.
   * This is a helper method that encapsulates the common pattern of creating and emitting notifications.
   * Ensures senderUserId is always a valid string (uses empty string as fallback for system notifications).
   *
   * PT -
   * Cria uma notificação no banco de dados e emite o evento de criação.
   * Este é um método auxiliar que encapsula o padrão comum de criar e emitir notificações.
   * Garante que senderUserId seja sempre uma string válida (usa string vazia como fallback para notificações de sistema).
   *
   * @param notificationData - Data for creating the notification
   * @param companyId - Company ID associated with the notification
   * @param recipientUserId - ID of the user receiving the notification
   * @param senderUserId - ID of the user sending the notification (null becomes empty string for system notifications)
   * @returns Created notification object
   */
  private async createAndEmitNotification(
    notificationData: {
      companyId: string | null;
      senderUserId: string | null;
      recipientUserId: string;
      recipientsEmails: string[];
      title: string;
      body: string;
      meta: any;
    },
    companyId: string | null,
    recipientUserId: string,
    senderUserId: string | null,
  ): Promise<any> {
    const notification = await this.notificationRepo.create({
      ...notificationData,
      senderUserId: notificationData.senderUserId || "",
    });
    await this.emitNotificationCreated(
      notification,
      companyId,
      recipientUserId,
      senderUserId,
    );
    return notification;
  }

  /**
   * EN -
   * Builds message formatter configuration for company-related notifications.
   * Extracts and formats company information for message formatting.
   *
   * PT -
   * Constrói configuração do formatador de mensagens para notificações relacionadas a empresas.
   * Extrai e formata informações da empresa para formatação de mensagens.
   *
   * @param companyData - Company data from payload
   * @param companyInfo - Enriched company information
   * @param companyId - Company ID
   * @returns Configuration object for message formatter
   */
  private buildCompanyMessageConfig(
    companyData: any,
    companyInfo: any,
    companyId: string,
  ): {
    companyName?: string;
    companyId?: string;
    companyDescription?: string;
    companyLogoUrl?: string;
    companyCreatedAt?: string;
    companyMemberCount?: number;
    companyOwnerName?: string;
    companyOwnerEmail?: string;
  } {
    return {
      companyName: companyData?.name || companyInfo.companyName,
      companyId,
      companyDescription:
        companyData?.description || companyInfo.companyDescription,
      companyLogoUrl: companyData?.logoUrl || companyInfo.companyLogoUrl,
      companyCreatedAt:
        this.toISOString(companyData?.createdAt) ||
        companyInfo.companyCreatedAt,
      companyMemberCount:
        companyData?.memberCount || companyInfo.companyMemberCount,
      companyOwnerName: companyInfo.companyOwnerName,
      companyOwnerEmail: companyInfo.companyOwnerEmail,
    };
  }

  /**
   * EN -
   * Handles notification.sent event by creating a notification for manually sent messages.
   * Supports both existing notifications (by ID) and new notification creation.
   *
   * PT -
   * Trata evento notification.sent criando uma notificação para mensagens enviadas manualmente.
   * Suporta tanto notificações existentes (por ID) quanto criação de nova notificação.
   *
   * @param payload - Event payload containing notification data
   */
  private async handleNotificationSent(payload: any): Promise<void> {
    const {
      notificationId,
      recipientUserId,
      senderUserId,
      companyId,
      title,
      body,
    } = payload;

    if (notificationId && recipientUserId) {
      const existingNotification =
        await this.notificationRepo.findById(notificationId);
      if (existingNotification) {
        await this.emitNotificationCreated(
          existingNotification,
          companyId || null,
          recipientUserId,
          senderUserId || null,
        );
      }
      return;
    }

    const receiverId = payload?.receiver?.id || payload?.userId;
    if (!receiverId) return;

    const sender = payload?.sender;
    const companyData = payload?.company;
    const finalCompanyId = companyId || companyData?.id || null;

    const companyInfo = await this.getCompanyInfo(finalCompanyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      finalCompanyId || "",
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "NOTIFICATION_SENT",
      senderName: sender?.name,
      senderEmail: sender?.email,
      ...companyConfig,
      additionalData: { title, body },
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "NOTIFICATION_SENT",
      senderName: sender?.name,
      senderEmail: sender?.email,
      ...companyConfig,
      additionalData: { title, body },
    });

    const meta = {
      ...this.buildBaseMeta(
        "notification.sent",
        finalCompanyId ? "company" : "user",
        payload,
      ),
      sender: sender ? this.buildSenderMeta(sender, senderUserId) : undefined,
      company:
        companyData || companyInfo.companyId
          ? this.buildCompanyMeta(
              companyData,
              companyInfo,
              finalCompanyId || "",
            )
          : undefined,
    };

    await this.createAndEmitNotification(
      {
        companyId: finalCompanyId,
        senderUserId: senderUserId || sender?.id || null,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      finalCompanyId,
      receiverId,
      senderUserId || sender?.id || null,
    );
  }

  /**
   * EN -
   * Handles friend.request.sent event by creating a notification for new friend requests.
   * Includes friendshipId in meta for direct linking to the friend request page.
   *
   * PT -
   * Trata evento friend.request.sent criando uma notificação para novas solicitações de amizade.
   * Inclui friendshipId no meta para link direto para a página de solicitação de amizade.
   *
   * @param payload - Event payload containing friend request data
   */
  private async handleFriendRequestSent(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.requesterId;
    const receiverId = payload?.receiver?.id || payload?.addresseeId;
    if (!senderId || !receiverId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    if (!sender) return;

    const receiver = await this.extractReceiverInfo(payload, receiverId);
    const friendshipId =
      payload?.friendshipId || payload?.additionalData?.friendshipId;

    if (!friendshipId) {
      this.logger.error(
        `FriendshipId not found in payload for friend request. Payload keys: ${Object.keys(payload).join(", ")}`,
      );
    } else {
      this.logger.default(`FriendshipId found: ${friendshipId}`);
    }

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "FRIEND_REQUEST_SENT",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      friendEmail: receiver?.email?.toString() || receiver?.email,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "FRIEND_REQUEST_SENT",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      recipientName: receiver?.name,
      recipientEmail: receiver?.email?.toString() || receiver?.email,
      friendEmail: receiver?.email?.toString() || receiver?.email,
    });

    const meta: any = {
      ...this.buildBaseMeta("friend.request.sent", "friend", payload),
      sender: this.buildSenderMeta(sender, senderId),
    };

    if (friendshipId) {
      meta.friendshipId = friendshipId;
    }

    this.logger.default(
      `Creating notification with meta: ${JSON.stringify(meta)}`,
    );

    await this.createAndEmitNotification(
      {
        companyId: null,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      null,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Handles friend.request.accepted event by creating a notification when a friend request is accepted.
   * Notifies the original requester that their request was accepted.
   *
   * PT -
   * Trata evento friend.request.accepted criando uma notificação quando uma solicitação de amizade é aceita.
   * Notifica o solicitante original que sua solicitação foi aceita.
   *
   * @param payload - Event payload containing friend request acceptance data
   */
  private async handleFriendRequestAccepted(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.addresseeId;
    const receiverId = payload?.receiver?.id || payload?.requesterId;
    if (!senderId || !receiverId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    if (!sender) return;

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "ACCEPTED_FRIEND",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "ACCEPTED_FRIEND",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      friendEmail: sender.email?.toString() || sender.email,
    });

    const meta = {
      ...this.buildBaseMeta("friend.request.accepted", "friend", payload),
      sender: this.buildSenderMeta(sender, senderId),
    };

    await this.createAndEmitNotification(
      {
        companyId: null,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      null,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Handles friend.request.rejected event by creating a notification when a friend request is rejected.
   * Notifies the original requester that their request was rejected.
   *
   * PT -
   * Trata evento friend.request.rejected criando uma notificação quando uma solicitação de amizade é rejeitada.
   * Notifica o solicitante original que sua solicitação foi rejeitada.
   *
   * @param payload - Event payload containing friend request rejection data
   */
  private async handleFriendRequestRejected(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.addresseeId;
    const receiverId = payload?.receiver?.id || payload?.requesterId;
    if (!senderId || !receiverId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    if (!sender) return;

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "REJECTED_FRIEND",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "REJECTED_FRIEND",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      friendEmail: sender.email?.toString() || sender.email,
    });

    const meta = {
      ...this.buildBaseMeta("friend.request.rejected", "friend", payload),
      sender: this.buildSenderMeta(sender, senderId),
    };

    await this.createAndEmitNotification(
      {
        companyId: null,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      null,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Handles friend.removed event by creating a notification when a friendship is removed.
   * Determines the correct recipient based on who initiated the removal.
   *
   * PT -
   * Trata evento friend.removed criando uma notificação quando uma amizade é removida.
   * Determina o destinatário correto baseado em quem iniciou a remoção.
   *
   * @param payload - Event payload containing friendship removal data
   */
  private async handleFriendRemoved(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.userId;
    const receiverId =
      payload?.receiver?.id ||
      (payload?.requesterId && payload?.addresseeId
        ? senderId === payload.requesterId
          ? payload.addresseeId
          : payload.requesterId
        : null);
    if (!senderId || !receiverId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    if (!sender) return;

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "FRIEND_REMOVED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "FRIEND_REMOVED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      friendEmail: sender.email?.toString() || sender.email,
    });

    const meta = {
      ...this.buildBaseMeta("friend.removed", "friend", payload),
      sender: this.buildSenderMeta(sender, senderId),
    };

    await this.createAndEmitNotification(
      {
        companyId: null,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      null,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Extracts invite-related information from payload for validation and processing.
   * Handles multiple possible field names for invite email and company ID.
   *
   * PT -
   * Extrai informações relacionadas a convite do payload para validação e processamento.
   * Trata múltiplos possíveis nomes de campo para email do convite e ID da empresa.
   *
   * @param payload - Event payload containing invite data
   * @returns Object containing extracted invite information or null if invalid
   */
  private extractInviteInfo(payload: any): {
    companyId: string;
    inviteId: string;
    inviteEmail: string;
  } | null {
    const companyId = payload?.companyId || payload?.company?.id;
    const inviteId = payload?.inviteId;
    const inviteEmail =
      payload?.invitedEmail ||
      payload?.receiverEmail ||
      payload?.receiver?.email ||
      payload?.email;

    if (!inviteId || !companyId || !inviteEmail) {
      this.logger.error(
        `handleInviteCreated: Missing required fields - inviteId=${inviteId}, companyId=${companyId}, inviteEmail=${inviteEmail}`,
      );
      this.logger.error(
        `handleInviteCreated: Payload keys: ${Object.keys(payload || {}).join(", ")}`,
      );
      return null;
    }

    return { companyId, inviteId, inviteEmail };
  }

  /**
   * EN -
   * Builds invite URL from invite token and frontend base URL configuration.
   * Falls back to inviteUrl from payload if token is not available.
   *
   * PT -
   * Constrói URL do convite a partir do token do convite e configuração de URL base do frontend.
   * Usa fallback para inviteUrl do payload se token não estiver disponível.
   *
   * @param invite - Invite object containing token
   * @param payload - Event payload that may contain inviteUrl
   * @returns Complete invite URL or undefined if not available
   */
  private buildInviteUrl(invite: any, payload: any): string | undefined {
    const appCfg = this.configService.get<any>("app") || {};
    const frontendBase =
      appCfg?.frontendBaseUrl ||
      process.env.FRONTEND_BASE_URL ||
      "http://localhost:3000";

    if (invite?.token) {
      return `${frontendBase}/invite/${invite.token}`;
    }

    return payload?.inviteUrl;
  }

  /**
   * EN -
   * Handles invite.created event by creating a notification for new company invites.
   * Validates that recipient exists in the system before creating notification.
   *
   * PT -
   * Trata evento invite.created criando uma notificação para novos convites de empresa.
   * Valida que o destinatário existe no sistema antes de criar notificação.
   *
   * @param payload - Event payload containing invite creation data
   */
  private async handleInviteCreated(payload: any): Promise<void> {
    this.logger.notificationCreator(
      `handleInviteCreated: Starting with payload keys: ${Object.keys(payload || {}).join(", ")}`,
    );
    this.logger.notificationCreator(
      `handleInviteCreated: Full payload:`,
      JSON.stringify(payload, null, 2),
    );

    const inviteInfo = this.extractInviteInfo(payload);
    if (!inviteInfo) return;

    const { companyId, inviteId, inviteEmail } = inviteInfo;

    const inviter = await this.extractSenderInfo(payload, payload?.inviterId);
    const company =
      payload?.company || (await this.companyRepo.findById(companyId));
    const recipient = await this.userRepo.findByEmail(inviteEmail);

    this.logger.notificationCreator(
      `handleInviteCreated: inviter=${!!inviter}, company=${!!company}, recipient=${!!recipient}, inviteEmail=${inviteEmail}`,
    );

    if (!inviter || !company) {
      this.logger.error(
        `handleInviteCreated: Missing inviter or company - inviter=${!!inviter}, company=${!!company}`,
      );
      return;
    }

    if (!recipient) {
      this.logger.notificationCreator(
        `handleInviteCreated: Recipient not found by email ${inviteEmail}, notification will not be created`,
      );
      return;
    }

    const invite = await this.inviteRepo.findById(inviteId);
    const inviteUrl = this.buildInviteUrl(invite, payload);
    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      company,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "INVITE_CREATED",
      senderName: inviter.name,
      senderEmail: inviter.email?.toString() || inviter.email,
      ...companyConfig,
      inviteId,
      inviteUrl,
      inviteEmail,
      role: invite?.role || payload?.role,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "INVITE_CREATED",
      senderName: inviter.name,
      senderEmail: inviter.email?.toString() || inviter.email,
      ...companyConfig,
      inviteId,
      inviteUrl,
      inviteEmail,
      role: invite?.role || payload?.role,
    });

    const meta = {
      ...this.buildBaseMeta("invite.created", "company", payload),
      sender: this.buildSenderMeta(inviter, payload.inviterId),
      company: this.buildCompanyMeta(company, companyInfo, companyId),
      companyName: company.name,
      companyId,
      inviteId,
      inviteUrl,
      role: invite?.role || payload?.role,
    };

    const notification = await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: inviter.id || payload.inviterId,
        recipientUserId: recipient.id,
        recipientsEmails: [inviteEmail],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      recipient.id,
      inviter.id || payload.inviterId,
    );

    this.logger.notificationCreator(
      `handleInviteCreated: Notification created successfully - id=${notification.id}, title=${notification.title}`,
    );
    this.logger.notificationCreator(
      `handleInviteCreated: Notification event emitted`,
    );
  }

  /**
   * EN -
   * Handles invite.accepted event by creating a notification when an invite is accepted.
   * Notifies the inviter that their invite was accepted.
   *
   * PT -
   * Trata evento invite.accepted criando uma notificação quando um convite é aceito.
   * Notifica o convidador que seu convite foi aceito.
   *
   * @param payload - Event payload containing invite acceptance data
   */
  private async handleInviteAccepted(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.invitedUserId;
    const receiverId = payload?.receiver?.id || payload?.inviterId;
    const companyId = payload?.companyId || payload?.company?.id;
    const inviteId = payload?.inviteId;

    if (!inviteId || !companyId || !senderId || !receiverId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    const companyData =
      payload?.company || (await this.companyRepo.findById(companyId));
    if (!sender || !companyData) return;

    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "INVITE_ACCEPTED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      ...companyConfig,
      inviteId,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "INVITE_ACCEPTED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      ...companyConfig,
      inviteId,
    });

    const meta = {
      ...this.buildBaseMeta("invite.accepted", "company", payload),
      sender: this.buildSenderMeta(sender, senderId),
      company: this.buildCompanyMeta(companyData, companyInfo, companyId),
      companyName: companyData.name,
      companyId,
      inviteId,
    };

    await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Handles invite.rejected event (fallback handler).
   * Actual rejection handling is done in invites.controller.ts.
   *
   * PT -
   * Trata evento invite.rejected (handler de fallback).
   * Tratamento real de rejeição é feito em invites.controller.ts.
   *
   * @param payload - Event payload containing invite rejection data
   */
  private async handleInviteRejected(payload: any): Promise<void> {
    // Already handled in invites.controller.ts rejectByCode
    // This is a fallback
  }

  /**
   * EN -
   * Handles membership.joined event by creating a notification when a user joins a company.
   * Notifies the user who joined about their new membership.
   *
   * PT -
   * Trata evento membership.joined criando uma notificação quando um usuário entra em uma empresa.
   * Notifica o usuário que entrou sobre sua nova associação.
   *
   * @param payload - Event payload containing membership join data
   */
  private async handleMemberAdded(payload: any): Promise<void> {
    const userId =
      payload?.userId || payload?.sender?.id || payload?.receiver?.id;
    const companyId = payload?.companyId || payload?.company?.id;
    if (!userId || !companyId) return;

    const companyData =
      payload?.company || (await this.companyRepo.findById(companyId));
    if (!companyData) return;

    const sender = await this.extractSenderInfo(payload, userId);
    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "MEMBER_ADDED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "MEMBER_ADDED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
    });

    const meta = {
      ...this.buildBaseMeta("membership.joined", "company", payload),
      company: this.buildCompanyMeta(companyData, companyInfo, companyId),
      companyName: companyData.name,
      companyId,
    };

    await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: userId,
        recipientUserId: userId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      userId,
      userId,
    );
  }

  /**
   * EN -
   * Handles membership.removed event by creating a notification when a user is removed from a company.
   * Notifies the removed user about their removal.
   *
   * PT -
   * Trata evento membership.removed criando uma notificação quando um usuário é removido de uma empresa.
   * Notifica o usuário removido sobre sua remoção.
   *
   * @param payload - Event payload containing membership removal data
   */
  private async handleMemberRemoved(payload: any): Promise<void> {
    const senderId = payload?.sender?.id || payload?.initiatorId;
    const receiverId = payload?.receiver?.id || payload?.userId;
    const companyId = payload?.companyId || payload?.company?.id;

    if (!receiverId || !companyId || !senderId) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    const companyData =
      payload?.company || (await this.companyRepo.findById(companyId));
    if (!sender || !companyData) return;

    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "MEMBER_REMOVED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      ...companyConfig,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "MEMBER_REMOVED",
      senderName: sender.name,
      senderEmail: sender.email?.toString() || sender.email,
      ...companyConfig,
    });

    const meta = {
      ...this.buildBaseMeta("membership.removed", "company", payload),
      sender: this.buildSenderMeta(sender, senderId),
      company: this.buildCompanyMeta(companyData, companyInfo, companyId),
      companyName: companyData.name,
      companyId,
    };

    await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: senderId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      receiverId,
      senderId,
    );
  }

  /**
   * EN -
   * Handles membership.role.updated event by creating a notification when a user's role changes.
   * Notifies the user whose role was changed.
   *
   * PT -
   * Trata evento membership.role.updated criando uma notificação quando o papel de um usuário muda.
   * Notifica o usuário cujo papel foi alterado.
   *
   * @param payload - Event payload containing role change data
   */
  private async handleRoleChanged(payload: any): Promise<void> {
    const receiverId = payload?.receiver?.id || payload?.userId;
    const senderId =
      payload?.sender?.id ||
      payload?.changedBy ||
      payload?.initiatorId ||
      receiverId;
    const companyId = payload?.companyId || payload?.company?.id;
    const newRole = payload?.newRole || payload?.role;
    const oldRole = payload?.oldRole || payload?.previousRole;

    if (!receiverId || !companyId || !newRole) return;

    const sender = await this.extractSenderInfo(payload, senderId);
    const companyData =
      payload?.company || (await this.companyRepo.findById(companyId));
    if (!companyData) return;

    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "ROLE_CHANGED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
      newRole,
      oldRole,
      role: newRole,
      previousRole: oldRole,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "ROLE_CHANGED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
      newRole,
      oldRole,
      role: newRole,
      previousRole: oldRole,
    });

    const meta = {
      ...this.buildBaseMeta("membership.role.updated", "company", payload),
      sender: sender ? this.buildSenderMeta(sender, senderId) : undefined,
      company: this.buildCompanyMeta(companyData, companyInfo, companyId),
      companyName: companyData.name,
      companyId,
      role: newRole,
      previousRole: oldRole,
    };

    await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: senderId || receiverId,
        recipientUserId: receiverId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      receiverId,
      senderId || receiverId,
    );
  }

  /**
   * EN -
   * Handles companys.created event by creating a notification when a company is created.
   * Notifies the creator about the successful company creation.
   *
   * PT -
   * Trata evento companys.created criando uma notificação quando uma empresa é criada.
   * Notifica o criador sobre a criação bem-sucedida da empresa.
   *
   * @param payload - Event payload containing company creation data
   */
  private async handleCompanyCreated(payload: any): Promise<void> {
    const userId = payload?.userId || payload?.sender?.id;
    const companyId = payload?.companyId || payload?.company?.id;
    if (!companyId || !userId) return;

    const companyData =
      payload?.company || (await this.companyRepo.findById(companyId));
    const sender = await this.extractSenderInfo(payload, userId);
    if (!companyData) return;

    const companyInfo = await this.getCompanyInfo(companyId);
    const companyConfig = this.buildCompanyMessageConfig(
      companyData,
      companyInfo,
      companyId,
    );

    const titleText = this.messageFormatter.formatTitle({
      eventCode: "COMPANY_CREATED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
    });

    const bodyText = this.messageFormatter.formatBody({
      eventCode: "COMPANY_CREATED",
      senderName: sender?.name,
      senderEmail: sender?.email?.toString() || sender?.email,
      ...companyConfig,
    });

    const meta = {
      ...this.buildBaseMeta("companys.created", "company", payload),
      company: this.buildCompanyMeta(companyData, companyInfo, companyId),
      companyName: companyData.name,
      companyId,
    };

    await this.createAndEmitNotification(
      {
        companyId,
        senderUserId: userId,
        recipientUserId: userId,
        recipientsEmails: [],
        title: titleText,
        body: bodyText,
        meta,
      },
      companyId,
      userId,
      userId,
    );
  }

  /**
   * EN -
   * Handles companys.updated event (placeholder handler).
   * Company update notifications are handled elsewhere in the system.
   *
   * PT -
   * Trata evento companys.updated (handler placeholder).
   * Notificações de atualização de empresa são tratadas em outro lugar do sistema.
   *
   * @param payload - Event payload containing company update data
   */
  private async handleCompanyUpdated(payload: any): Promise<void> {
    const { id: companyId } = payload;
    if (!companyId) return;

    const company = await this.companyRepo.findById(companyId);
    if (!company) return;

    // Notify all members
    // This would require getting all members, which is handled elsewhere
  }

  /**
   * EN -
   * Handles companys.deleted event (placeholder handler).
   * Company deletion notifications are handled by cascade delete in the database.
   *
   * PT -
   * Trata evento companys.deleted (handler placeholder).
   * Notificações de exclusão de empresa são tratadas por cascade delete no banco de dados.
   *
   * @param payload - Event payload containing company deletion data
   */
  private async handleCompanyDeleted(payload: any): Promise<void> {
    // Company is deleted, so we can't create notifications
    // This is handled by cascade delete
  }
}

import { NotificationRepository } from "@domain/repositories/notifications/notification.repository";
import { DomainEventsService } from "@domain/services/domain-events.service";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { SuccessCode } from "@application/success/success-code";
import { Role } from "@domain/enums/role.enum";
import { MembershipRepository } from "@domain/repositories/memberships/membership.repository";
import { UserRepository } from "@domain/repositories/users/user.repository";
import { FriendshipRepository } from "@domain/repositories/friendships/friendship.repository";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { EventPayloadBuilderService } from "@application/services/event-payload-builder.service";

export interface SendNotificationInput {
  companyId: string;
  senderUserId: string;
  recipientsEmails?: string[];
  title: string;
  body: string;
  onlyOwnersAndAdmins?: boolean;
}

export interface SendNotificationResult {
  notifications: any[];
  validationResults: {
    email: string;
    status: "sent" | "failed";
    code: string;
    count?: number;
  }[];
}

export class SendNotificationUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly membershipRepo: MembershipRepository,
    private readonly notificationRepo: NotificationRepository,
    private readonly userRepo: UserRepository,
    private readonly friendshipRepo: FriendshipRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly eventBuilder: EventPayloadBuilderService,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(
      SendNotificationUseCase.name,
      configService,
    );
  }

  async execute(input: SendNotificationInput): Promise<SendNotificationResult> {
    if (!input.onlyOwnersAndAdmins) {
      const senderMembership = await this.membershipRepo.findByUserAndCompany(
        input.senderUserId,
        input.companyId,
      );
      if (!senderMembership) {
        this.logger.default(
          `Notification failed: sender is not a member - user: ${input.senderUserId}, company: ${input.companyId}`,
        );
        throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
      }
      if (![Role.OWNER, Role.ADMIN].includes(senderMembership.role)) {
        this.logger.default(
          `Notification failed: insufficient role - user: ${input.senderUserId}, company: ${input.companyId}, role: ${senderMembership.role}`,
        );
        throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
      }
    }

    const validationResults: {
      email: string;
      status: "sent" | "failed";
      code: string;
      count?: number;
    }[] = [];
    const recipients: Map<
      string,
      { userId: string; email: string; via: "company" | "friend" }
    > = new Map();

    const senderUser = await this.userRepo.findById(input.senderUserId);
    if (!senderUser) {
      this.logger.default(
        `Notification failed: sender not found - user: ${input.senderUserId}`,
      );
      throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
    }

    const normalizedContacts =
      input.recipientsEmails
        ?.map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0) ?? [];

    if (normalizedContacts.length === 0) {
      const memberships = await this.membershipRepo.listByCompany(
        input.companyId,
      );
      for (const membership of memberships) {
        if (membership.userId === input.senderUserId) continue;

        if (
          input.onlyOwnersAndAdmins &&
          ![Role.OWNER, Role.ADMIN].includes(membership.role)
        ) {
          continue;
        }

        const user = await this.userRepo.findById(membership.userId);
        if (!user) continue;
        recipients.set(user.id, {
          userId: user.id,
          email: user.email.toString(),
          via: "company",
        });
      }
      validationResults.push({
        email: "*",
        status: recipients.size > 0 ? "sent" : "failed",
        code:
          recipients.size > 0
            ? SuccessCode.NOTIFICATION_SENT_TO_ALL_MEMBERS
            : ErrorCode.NO_COMPANY_MEMBERS_AVAILABLE,
        count: recipients.size,
      });
    } else {
      for (const email of normalizedContacts) {
        const user = await this.userRepo.findByEmail(email);
        if (!user) {
          validationResults.push({
            email,
            status: "failed",
            code: ErrorCode.USER_NOT_FOUND,
          });
          continue;
        }

        if (user.id === input.senderUserId) {
          validationResults.push({
            email,
            status: "failed",
            code: ErrorCode.CANNOT_SEND_TO_SELF,
          });
          continue;
        }

        const isInCompany = await this.membershipRepo.findByUserAndCompany(
          user.id,
          input.companyId,
        );

        if (input.onlyOwnersAndAdmins) {
          if (!isInCompany) {
            validationResults.push({
              email,
              status: "failed",
              code: ErrorCode.USER_NOT_FOUND,
            });
            continue;
          }
          if (![Role.OWNER, Role.ADMIN].includes(isInCompany.role)) {
            validationResults.push({
              email,
              status: "failed",
              code: ErrorCode.INSUFFICIENT_ROLE,
            });
            continue;
          }
        } else {
          const isFriend = await this.friendshipRepo.areFriends(
            input.senderUserId,
            user.id,
          );
          if (!isInCompany && !isFriend) {
            validationResults.push({
              email,
              status: "failed",
              code: ErrorCode.USER_MUST_BE_MEMBER_OR_FRIEND,
            });
            continue;
          }
        }

        recipients.set(user.id, {
          userId: user.id,
          email: user.email.toString(),
          via: isInCompany ? "company" : "friend",
        });

        validationResults.push({
          email,
          status: "sent",
          code: SuccessCode.NOTIFICATION_SENT,
        });
      }
    }

    if (recipients.size === 0) {
      return { notifications: [], validationResults };
    }

    const createdNotifications: any[] = [];

    for (const recipient of recipients.values()) {
      const notification = await this.notificationRepo.create({
        companyId: input.companyId,
        senderUserId: input.senderUserId,
        recipientUserId: recipient.userId,
        recipientsEmails: [recipient.email],
        title: input.title,
        body: input.body,
        meta: {
          kind: "notification.sent",
          channel: recipient.via,
          sender: {
            id: senderUser.id,
            name: senderUser.name,
            email: senderUser.email.toString(),
          },
        },
      });
      createdNotifications.push(notification);

      const eventPayload = await this.eventBuilder.build({
        eventId: "NOTIFICATION_SENT",
        senderId: input.senderUserId,
        receiverId: recipient.userId,
        companyId: input.companyId || null,
        additionalData: {
          notificationId: notification.id,
          recipientUserId: recipient.userId,
          senderUserId: input.senderUserId,
          title: input.title,
          body: input.body,
        },
      });

      await this.domainEvents.publish({
        name: "notifications.sent",
        payload: eventPayload,
      });
    }

    return {
      notifications: createdNotifications,
      validationResults,
    };
  }
}

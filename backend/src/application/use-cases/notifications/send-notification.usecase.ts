import {NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {SuccessCode} from "@application/success/success-code";
import {Role} from "@domain/enums/role.enum";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";

export interface SendNotificationInput {
    companyId: string;
    senderUserId: string;
    recipientsEmails?: string[];
    title: string;
    body: string;
    onlyOwnersAndAdmins?: boolean; // Se true, envia apenas para OWNERs e ADMINs
}

export interface SendNotificationResult {
    notifications: any[];
    validationResults: { email: string; status: "sent" | "failed"; code: string; count?: number }[];
}

export class SendNotificationUseCase {
    constructor(
        private readonly membershipRepo: MembershipRepository,
        private readonly notificationRepo: NotificationRepository,
        private readonly userRepo: UserRepository,
        private readonly friendshipRepo: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: SendNotificationInput): Promise<SendNotificationResult> {
        // Se onlyOwnersAndAdmins for true, o sender pode não ser membro (Request to Join)
        if (!input.onlyOwnersAndAdmins) {
            const senderMembership = await this.membershipRepo.findByUserAndCompany(
                input.senderUserId,
                input.companyId,
            );
            if (!senderMembership) throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
            if (![Role.OWNER, Role.ADMIN].includes(senderMembership.role)) {
                throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
            }
        }

        const validationResults: { email: string; status: "sent" | "failed"; code: string; count?: number }[] = [];
        const recipients: Map<string, { userId: string; email: string; via: "company" | "friend" }> = new Map();
        
        const senderUser = await this.userRepo.findById(input.senderUserId);
        if (!senderUser) {
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        const normalizedContacts =
            input.recipientsEmails?.map(
                (email) => email.trim().toLowerCase()).filter((email) => email.length > 0) ?? [];

        if (normalizedContacts.length === 0) {
            // Enviar para todos os membros da empresa (ou apenas OWNERs/ADMINs se onlyOwnersAndAdmins)
            const memberships = await this.membershipRepo.listByCompany(input.companyId);
            for (const membership of memberships) {
                if (membership.userId === input.senderUserId) continue;
                
                // Se onlyOwnersAndAdmins for true, filtrar apenas OWNERs e ADMINs
                if (input.onlyOwnersAndAdmins && ![Role.OWNER, Role.ADMIN].includes(membership.role)) {
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
                code: recipients.size > 0 ? SuccessCode.NOTIFICATION_SENT_TO_ALL_MEMBERS : ErrorCode.NO_COMPANY_MEMBERS_AVAILABLE,
                count: recipients.size,
            });
        } else {
            // Enviar para emails específicos
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

                const isInCompany = await this.membershipRepo.findByUserAndCompany(user.id, input.companyId);
                
                // Se onlyOwnersAndAdmins for true, verificar se é OWNER ou ADMIN
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
                    const isFriend = await this.friendshipRepo.areFriends(input.senderUserId, user.id);
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
            return {notifications: [], validationResults};
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
                    kind: "notifications.sent",
                    channel: recipient.via,
                    sender: {
                        id: senderUser.id,
                        name: senderUser.name,
                        email: senderUser.email.toString(),
                    },
                },
            });
            createdNotifications.push(notification);

            await this.domainEvents.publish({
                name: "notifications.sent",
                payload: {
                    notificationId: notification.id,
                    companyId: input.companyId,
                    recipientUserId: recipient.userId,
                    senderUserId: input.senderUserId,
                    title: input.title,
                    sender: {
                        id: senderUser.id,
                        name: senderUser.name,
                        email: senderUser.email.toString(),
                    },
                },
            });
        }

        return {
            notifications: createdNotifications,
            validationResults,
        };
    }
}

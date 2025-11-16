import {Injectable, Inject} from "@nestjs/common";
import {NotificationRepository, NOTIFICATION_REPOSITORY} from "@domain/repositories/notifications/notification.repository";
import {UserRepository, USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {CompanyRepository, COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {InviteRepository, INVITE_REPOSITORY} from "@domain/repositories/invites/invite.repository";
import {FriendshipRepository, FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendships/friendship.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class NotificationCreatorService {
    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepo: NotificationRepository,
        @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
        @Inject(INVITE_REPOSITORY) private readonly inviteRepo: InviteRepository,
        @Inject(FRIENDSHIP_REPOSITORY) private readonly friendshipRepo: FriendshipRepository,
        @Inject("DOMAIN_EVENTS_SERVICE") private readonly domainEvents: DomainEventsService,
        private readonly configService: ConfigService,
    ) {
    }

    private async emitNotificationCreated(notification: any, companyId: string |
        null, recipientUserId: string | null, senderUserId: string | null): Promise<void> {
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

    async createNotificationForEvent(eventName: string, payload: any): Promise<void> {
        try {
            switch (eventName) {
                case 'friend.request.sent':
                    await this.handleFriendRequestSent(payload);
                    break;
                case 'friend.request.accepted':
                    await this.handleFriendRequestAccepted(payload);
                    break;
                case 'friend.request.rejected':
                    await this.handleFriendRequestRejected(payload);
                    break;
                case 'friend.removed':
                    await this.handleFriendRemoved(payload);
                    break;
                case 'invites.created':
                    await this.handleInviteCreated(payload);
                    break;
                case 'invites.accepted':
                    await this.handleInviteAccepted(payload);
                    break;
                case 'invites.rejected':
                    await this.handleInviteRejected(payload);
                    break;
                case 'memberships.joined':
                    await this.handleMemberAdded(payload);
                    break;
                case 'memberships.removed':
                    await this.handleMemberRemoved(payload);
                    break;
                case 'memberships.role.updated':
                    await this.handleRoleChanged(payload);
                    break;
                case 'companys.created':
                    await this.handleCompanyCreated(payload);
                    break;
                case 'companys.updated':
                    await this.handleCompanyUpdated(payload);
                    break;
                case 'companys.deleted':
                    await this.handleCompanyDeleted(payload);
                    break;
            }
        } catch (error) {
            console.error(`Failed to create notification for event ${eventName}:`, error);
        }
    }

    private async handleFriendRequestSent(payload: any): Promise<void> {
        const {requesterId, addresseeId} = payload;
        if (!requesterId || !addresseeId) return;

        const requester = await this.userRepo.findById(requesterId);
        if (!requester) return;

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: requesterId,
            recipientUserId: addresseeId,
            recipientsEmails: [],
            title: "FRIEND_REQUEST_SENT",
            body: "FRIEND_REQUEST_SENT",
            meta: {
                kind: "friend.request.sent",
                channel: "friend",
                sender: {
                    id: requester.id,
                    name: requester.name,
                    email: requester.email.toString(),
                },
            },
        });
        
        await this.domainEvents.publish({
            name: "notifications.created",
            payload: {
                notificationId: notification.id,
                companyId: null,
                recipientUserId: addresseeId,
                senderUserId: requesterId,
            },
        });
    }

    private async handleFriendRequestAccepted(payload: any): Promise<void> {
        const {requesterId, addresseeId} = payload;
        if (!requesterId || !addresseeId) return;

        const addressee = await this.userRepo.findById(addresseeId);
        if (!addressee) return;

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: addresseeId,
            recipientUserId: requesterId,
            recipientsEmails: [],
            title: "FRIEND_REQUEST_ACCEPTED",
            body: "FRIEND_REQUEST_ACCEPTED",
            meta: {
                kind: "friend.request.accepted",
                channel: "friend",
                sender: {
                    id: addressee.id,
                    name: addressee.name,
                    email: addressee.email.toString(),
                },
            },
        });
        await this.emitNotificationCreated(notification, null, requesterId, addresseeId);
    }

    private async handleFriendRequestRejected(payload: any): Promise<void> {
        const {requesterId, addresseeId} = payload;
        if (!requesterId || !addresseeId) return;

        const addressee = await this.userRepo.findById(addresseeId);
        if (!addressee) return;

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: addresseeId,
            recipientUserId: requesterId,
            recipientsEmails: [],
            title: "FRIEND_REQUEST_REJECTED",
            body: "FRIEND_REQUEST_REJECTED",
            meta: {
                kind: "friend.request.rejected",
                channel: "friend",
                sender: {
                    id: addressee.id,
                    name: addressee.name,
                    email: addressee.email.toString(),
                },
            },
        });
        await this.emitNotificationCreated(notification, null, requesterId, addresseeId);
    }

    private async handleFriendRemoved(payload: any): Promise<void> {
        const {requesterId, addresseeId, userId} = payload;
        if (!userId) return;

        const removedBy = await this.userRepo.findById(userId);
        if (!removedBy) return;

        const notifyUserId = userId === requesterId ? addresseeId : requesterId;
        if (!notifyUserId) return;

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: userId,
            recipientUserId: notifyUserId,
            recipientsEmails: [],
            title: "FRIEND_REMOVED",
            body: "FRIEND_REMOVED",
            meta: {
                kind: "friend.removed",
                channel: "friend",
                sender: {
                    id: removedBy.id,
                    name: removedBy.name,
                    email: removedBy.email.toString(),
                },
            },
        });
        await this.emitNotificationCreated(notification, null, notifyUserId, userId);
    }

    private async handleInviteCreated(payload: any): Promise<void> {
        const {inviteId, companyId, email} = payload;
        if (!inviteId || !companyId || !email) return;

        const invite = await this.inviteRepo.findById(inviteId);
        if (!invite || !invite.inviterId) return;

        const inviter = await this.userRepo.findById(invite.inviterId);
        const company = await this.companyRepo.findById(companyId);
        const recipient = await this.userRepo.findByEmail(email);
        if (!inviter || !company) return;

        const appCfg = this.configService.get<any>('app') || {};
        const frontendBase = appCfg?.frontendBaseUrl || process.env.FRONTEND_BASE_URL || "http://localhost:3000";
        const inviteUrl = `${frontendBase}/invite/${invite.token}`;

        if (recipient) {
            const notification = await this.notificationRepo.create({
                companyId,
                senderUserId: invite.inviterId,
                recipientUserId: recipient.id,
                recipientsEmails: [email],
                title: "INVITE_CREATED",
                body: "INVITE_CREATED",
                meta: {
                    kind: "invite.created",
                    channel: "company",
                    sender: {
                        id: inviter.id,
                        name: inviter.name,
                        email: inviter.email.toString(),
                    },
                    companyName: company.name,
                    companyId,
                    inviteId,
                    inviteUrl,
                    role: invite.role,
                },
            });
            await this.emitNotificationCreated(notification, companyId, recipient.id, invite.inviterId);
        }
    }

    private async handleInviteAccepted(payload: any): Promise<void> {
        const {inviteId, companyId, invitedUserId} = payload;
        if (!inviteId || !companyId || !invitedUserId) return;

        const invite = await this.inviteRepo.findById(inviteId);
        if (!invite || !invite.inviterId) return;

        const acceptedBy = await this.userRepo.findById(invitedUserId);
        const company = await this.companyRepo.findById(companyId);
        if (!acceptedBy || !company) return;

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: invitedUserId,
            recipientUserId: invite.inviterId,
            recipientsEmails: [],
            title: "INVITE_ACCEPTED",
            body: "INVITE_ACCEPTED",
            meta: {
                kind: "invite.accepted",
                channel: "company",
                sender: {
                    id: acceptedBy.id,
                    name: acceptedBy.name,
                    email: acceptedBy.email.toString(),
                },
                companyName: company.name,
                companyId,
                inviteId,
            },
        });
        await this.emitNotificationCreated(notification, companyId, invite.inviterId, invitedUserId);
    }

    private async handleInviteRejected(payload: any): Promise<void> {
        // Already handled in invites.controller.ts rejectByCode
        // This is a fallback
    }

    private async handleMemberAdded(payload: any): Promise<void> {
        const {userId, companyId} = payload;
        if (!userId || !companyId) return;

        const company = await this.companyRepo.findById(companyId);
        if (!company) return;

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: userId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: "MEMBER_ADDED",
            body: "MEMBER_ADDED",
            meta: {
                kind: "membership.joined",
                channel: "company",
                companyName: company.name,
                companyId,
            },
        });
        await this.emitNotificationCreated(notification, companyId, userId, userId);
    }

    private async handleMemberRemoved(payload: any): Promise<void> {
        const {userId, companyId, initiatorId} = payload;
        if (!userId || !companyId || !initiatorId) return;

        const company = await this.companyRepo.findById(companyId);
        const removedBy = await this.userRepo.findById(initiatorId);
        if (!company || !removedBy) return;

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: initiatorId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: "MEMBER_REMOVED",
            body: "MEMBER_REMOVED",
            meta: {
                kind: "membership.removed",
                channel: "company",
                sender: {
                    id: removedBy.id,
                    name: removedBy.name,
                    email: removedBy.email.toString(),
                },
                removedBy: {
                    id: removedBy.id,
                    name: removedBy.name,
                    email: removedBy.email.toString(),
                },
                companyName: company.name,
                companyId,
            },
        });
        await this.emitNotificationCreated(notification, companyId, userId, initiatorId);
    }

    private async handleRoleChanged(payload: any): Promise<void> {
        const {userId, companyId, role, previousRole, changedBy} = payload;
        if (!userId || !companyId || !role) return;

        const company = await this.companyRepo.findById(companyId);
        const changer = changedBy ? await this.userRepo.findById(changedBy) : null;
        if (!company) return;

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: changedBy || userId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: "ROLE_CHANGED",
            body: "ROLE_CHANGED",
            meta: {
                kind: "membership.role.updated",
                channel: "company",
                sender: changer ? {
                    id: changer.id,
                    name: changer.name,
                    email: changer.email.toString(),
                } : undefined,
                companyName: company.name,
                companyId,
                role,
                previousRole,
            },
        });
        await this.emitNotificationCreated(notification, companyId, userId, changedBy || userId);
    }

    private async handleCompanyCreated(payload: any): Promise<void> {
        const {companyId, userId} = payload;
        if (!companyId || !userId) return;

        const company = await this.companyRepo.findById(companyId);
        if (!company) return;

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: userId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: "COMPANY_CREATED",
            body: "COMPANY_CREATED",
            meta: {
                kind: "companys.created",
                channel: "company",
                companyName: company.name,
                companyId,
            },
        });
        await this.emitNotificationCreated(notification, companyId, userId, userId);
    }

    private async handleCompanyUpdated(payload: any): Promise<void> {
        const {id: companyId} = payload;
        if (!companyId) return;

        const company = await this.companyRepo.findById(companyId);
        if (!company) return;

        // Notify all members
        // This would require getting all members, which is handled elsewhere
    }

    private async handleCompanyDeleted(payload: any): Promise<void> {
        // Company is deleted, so we can't create notifications
        // This is handled by cascade delete
    }
}


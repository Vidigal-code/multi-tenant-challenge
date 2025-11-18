import {Injectable, Inject} from "@nestjs/common";
import {NotificationRepository, NOTIFICATION_REPOSITORY} from "@domain/repositories/notifications/notification.repository";
import {UserRepository, USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {CompanyRepository, COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {InviteRepository, INVITE_REPOSITORY} from "@domain/repositories/invites/invite.repository";
import {FriendshipRepository, FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendships/friendship.repository";
import {MembershipRepository, MEMBERSHIP_REPOSITORY} from "@domain/repositories/memberships/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ConfigService} from "@nestjs/config";
import {NotificationMessageFormatterService} from "./notification-message-formatter.service";
import {Role} from "@domain/enums/role.enum";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class NotificationCreatorService {
    private readonly logger: LoggerService;

    constructor(
        @Inject(NOTIFICATION_REPOSITORY) private readonly notificationRepo: NotificationRepository,
        @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
        @Inject(INVITE_REPOSITORY) private readonly inviteRepo: InviteRepository,
        @Inject(FRIENDSHIP_REPOSITORY) private readonly friendshipRepo: FriendshipRepository,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly membershipRepo: MembershipRepository,
        @Inject("DOMAIN_EVENTS_SERVICE") private readonly domainEvents: DomainEventsService,
        private readonly configService: ConfigService,
        private readonly messageFormatter: NotificationMessageFormatterService,
    ) {
        this.logger = new LoggerService('NotificationCreator', this.configService);
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

    /**
     * Converts a date value to ISO string format
     * Handles both Date objects and ISO string dates
     */
    private toISOString(date: any): string | undefined {
        if (!date) return undefined;
        if (date instanceof Date) {
            return date.toISOString();
        }
        if (typeof date === 'string') {
            return date;
        }
        return undefined;
    }

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
            
            let ownerName: string | undefined;
            let ownerEmail: string | undefined;
            
            const ownerMemberships = members.filter(m => m.role === Role.OWNER);
            if (ownerMemberships.length > 0) {
                ownerMemberships.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
                const primaryOwner = ownerMemberships[0];
                const primaryOwnerUser = await this.userRepo.findById(primaryOwner.userId);
                if (primaryOwnerUser) {
                    ownerName = primaryOwnerUser.name;
                    ownerEmail = primaryOwnerUser.email.toString();
                }
            }

            return {
                companyName: company.name,
                companyId: company.id,
                companyDescription: company.description || undefined,
                companyLogoUrl: company.logoUrl || undefined,
                companyCreatedAt: this.toISOString(company.createdAt),
                companyMemberCount: memberCount,
                companyOwnerName: ownerName,
                companyOwnerEmail: ownerEmail,
            };
        } catch (error) {
            this.logger.error(`Error getting company info for ${companyId}:`, error instanceof Error ? error.message : String(error));
            return { companyId };
        }
    }

    async createNotificationForEvent(eventName: string, payload: any): Promise<void> {
        try {
            switch (eventName) {
                case 'notification.sent':
                case 'notifications.sent':
                    await this.handleNotificationSent(payload);
                    break;
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
                case 'invite.created':
                case 'invites.created':
                    this.logger.notificationCreator(`Handling invite.created, 
                    inviteId=${payload?.inviteId}, invitedEmail=${payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email}`);
                    await this.handleInviteCreated(payload);
                    break;
                case 'invite.accepted':
                case 'invites.accepted':
                    await this.handleInviteAccepted(payload);
                    break;
                case 'invite.rejected':
                case 'invites.rejected':
                    await this.handleInviteRejected(payload);
                    break;
                case 'membership.joined':
                case 'memberships.joined':
                    await this.handleMemberAdded(payload);
                    break;
                case 'membership.removed':
                case 'memberships.removed':
                    await this.handleMemberRemoved(payload);
                    break;
                case 'membership.role.updated':
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
        } catch (error: any) {
            this.logger.error(`Failed to create notification for event ${eventName}:`, error);
            this.logger.error(`Error message: ${error?.message || String(error)}`);
            this.logger.error(`Error stack: ${error?.stack || 'No stack trace'}`);
            if (error?.message?.includes('inviteId') || error?.message?.includes('invitedEmail')) {
                this.logger.error(`Payload received:`, JSON.stringify(payload, null, 2));
            }
        }
    }

    private async handleNotificationSent(payload: any): Promise<void> {
        const {notificationId, recipientUserId, senderUserId, companyId, title, body} = payload;
        if (!notificationId || !recipientUserId) {
            const receiverId = payload?.receiver?.id || payload?.userId;
            if (!receiverId) return;
            
            const sender = payload?.sender;
            const companyData = payload?.company;
            const finalCompanyId = companyId || companyData?.id || null;
            
            const companyInfo = await this.getCompanyInfo(finalCompanyId);
            
            const titleText = this.messageFormatter.formatTitle({
                eventCode: 'NOTIFICATION_SENT',
                senderName: sender?.name,
                senderEmail: sender?.email,
                companyName: companyData?.name || companyInfo.companyName,
                companyId: finalCompanyId,
                companyDescription: companyData?.description || companyInfo.companyDescription,
                companyLogoUrl: companyData?.logoUrl || companyInfo.companyLogoUrl,
                companyCreatedAt: companyData?.createdAt || companyInfo.companyCreatedAt,
                companyMemberCount: companyData?.memberCount || companyInfo.companyMemberCount,
                companyOwnerName: companyInfo.companyOwnerName,
                companyOwnerEmail: companyInfo.companyOwnerEmail,
                additionalData: { title, body },
            });
            
            const bodyText = this.messageFormatter.formatBody({
                eventCode: 'NOTIFICATION_SENT',
                senderName: sender?.name,
                senderEmail: sender?.email,
                companyName: companyData?.name || companyInfo.companyName,
                companyId: finalCompanyId,
                companyDescription: companyData?.description || companyInfo.companyDescription,
                companyLogoUrl: companyData?.logoUrl || companyInfo.companyLogoUrl,
                companyCreatedAt: companyData?.createdAt || companyInfo.companyCreatedAt,
                companyMemberCount: companyData?.memberCount || companyInfo.companyMemberCount,
                companyOwnerName: companyInfo.companyOwnerName,
                companyOwnerEmail: companyInfo.companyOwnerEmail,
                additionalData: { title, body },
            });
            
            const notification = await this.notificationRepo.create({
                companyId: finalCompanyId,
                senderUserId: senderUserId || sender?.id || null,
                recipientUserId: receiverId,
                recipientsEmails: [],
                title: titleText,
                body: bodyText,
                meta: {
                    kind: "notification.sent",
                    channel: finalCompanyId ? "company" : "user",
                    sender: sender ? {
                        id: sender.id,
                        name: sender.name,
                        email: sender.email,
                    } : undefined,
                    company: companyData || companyInfo.companyId ? {
                        id: finalCompanyId,
                        name: companyData?.name || companyInfo.companyName,
                        description: companyData?.description || companyInfo.companyDescription,
                        logoUrl: companyData?.logoUrl || companyInfo.companyLogoUrl,
                        createdAt: companyData?.createdAt || companyInfo.companyCreatedAt,
                        memberCount: companyData?.memberCount || companyInfo.companyMemberCount,
                    } : undefined,
                    eventId: payload?.eventId || 'NOTIFICATION_SENT',
                    timestamp: payload?.timestamp || new Date().toISOString(),
                },
            });
            
            await this.emitNotificationCreated(
                notification,
                finalCompanyId,
                receiverId,
                senderUserId || sender?.id || null
            );
            return;
        }

        const existingNotification = await this.notificationRepo.findById(notificationId);
        if (existingNotification) {
            await this.emitNotificationCreated(
                existingNotification,
                companyId || null,
                recipientUserId,
                senderUserId || null
            );
        }
    }

    private async handleFriendRequestSent(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.requesterId;
        const receiverId = payload?.receiver?.id || payload?.addresseeId;
        if (!senderId || !receiverId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        const receiver = payload?.receiver || await this.userRepo.findById(receiverId);
        if (!sender) return;

        const friendshipId = payload?.friendshipId || payload?.additionalData?.friendshipId;
        
        if (!friendshipId) {
            this.logger.error(`FriendshipId not found in payload for friend request. Payload keys: ${Object.keys(payload).join(', ')}`);
        } else {
            this.logger.default(`FriendshipId found: ${friendshipId}`);
        }

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'FRIEND_REQUEST_SENT',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            friendEmail: receiver?.email?.toString() || receiver?.email,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'FRIEND_REQUEST_SENT',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            recipientName: receiver?.name,
            recipientEmail: receiver?.email?.toString() || receiver?.email,
            friendEmail: receiver?.email?.toString() || receiver?.email,
        });

        const meta: any = {
            kind: "friend.request.sent",
            channel: "friend",
            sender: {
                id: sender.id || senderId,
                name: sender.name,
                email: sender.email?.toString() || sender.email,
            },
            eventId: payload?.eventId || 'FRIEND_REQUEST_SENT',
            timestamp: payload?.timestamp || new Date().toISOString(),
        };
        
        if (friendshipId) {
            meta.friendshipId = friendshipId;
        }
        
        this.logger.default(`Creating notification with meta: ${JSON.stringify(meta)}`);

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: meta,
        });
        
        await this.emitNotificationCreated(notification, null, receiverId, senderId);
    }

    private async handleFriendRequestAccepted(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.addresseeId;
        const receiverId = payload?.receiver?.id || payload?.requesterId;
        if (!senderId || !receiverId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        if (!sender) return;

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'ACCEPTED_FRIEND',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'ACCEPTED_FRIEND',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            friendEmail: sender.email?.toString() || sender.email,
        });

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "friend.request.accepted",
                channel: "friend",
                sender: {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                },
                eventId: payload?.eventId || 'FRIEND_REQUEST_ACCEPTED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, null, receiverId, senderId);
    }

    private async handleFriendRequestRejected(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.addresseeId;
        const receiverId = payload?.receiver?.id || payload?.requesterId;
        if (!senderId || !receiverId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        if (!sender) return;

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'REJECTED_FRIEND',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'REJECTED_FRIEND',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            friendEmail: sender.email?.toString() || sender.email,
        });

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "friend.request.rejected",
                channel: "friend",
                sender: {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                },
                eventId: payload?.eventId || 'FRIEND_REQUEST_REJECTED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, null, receiverId, senderId);
    }

    private async handleFriendRemoved(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.userId;
        const receiverId = payload?.receiver?.id || (payload?.requesterId && payload?.addresseeId ? (senderId === payload.requesterId ? payload.addresseeId : payload.requesterId) : null);
        if (!senderId || !receiverId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        if (!sender) return;

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'FRIEND_REMOVED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'FRIEND_REMOVED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            friendEmail: sender.email?.toString() || sender.email,
        });

        const notification = await this.notificationRepo.create({
            companyId: null,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "friend.removed",
                channel: "friend",
                sender: {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                },
                eventId: payload?.eventId || 'FRIEND_REMOVED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, null, receiverId, senderId);
    }

    private async handleInviteCreated(payload: any): Promise<void> {
        this.logger.notificationCreator(`handleInviteCreated: Starting with payload keys: ${Object.keys(payload || {}).join(', ')}`);
        this.logger.notificationCreator(`handleInviteCreated: Full payload:`, JSON.stringify(payload, null, 2));
        
        const companyId = payload?.companyId || payload?.company?.id;
        const inviteId = payload?.inviteId;
        const inviteEmail = payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email;
        const sender = payload?.sender;
        const companyData = payload?.company;
        
        this.logger.notificationCreator(`handleInviteCreated: Extracted values - inviteId=${inviteId}, companyId=${companyId}, inviteEmail=${inviteEmail}`);
        this.logger.notificationCreator(`handleInviteCreated: sender=${!!sender}, companyData=${!!companyData}`);
        
        if (!inviteId || !companyId || !inviteEmail) {
            this.logger.error(`handleInviteCreated: Missing required fields - inviteId=${inviteId}, companyId=${companyId}, inviteEmail=${inviteEmail}`);
            this.logger.error(`handleInviteCreated: Payload keys: ${Object.keys(payload || {}).join(', ')}`);
            this.logger.error(`handleInviteCreated: Payload.receiver:`, JSON.stringify(payload?.receiver));
            this.logger.error(`handleInviteCreated: Payload.company:`, JSON.stringify(payload?.company));
            return;
        }

        const inviter = sender || (payload?.inviterId ? await this.userRepo.findById(payload.inviterId) : null);
        const company = companyData || await this.companyRepo.findById(companyId);
        const recipient = await this.userRepo.findByEmail(inviteEmail);
        
        this.logger.notificationCreator(`handleInviteCreated: inviter=${!!inviter}, company=${!!company}, recipient=${!!recipient}, inviteEmail=${inviteEmail}`);
        
        if (!inviter || !company) {
            this.logger.error(`handleInviteCreated: Missing inviter or company - inviter=${!!inviter}, company=${!!company}`);
            return;
        }
        
        if (!recipient) {
            this.logger.notificationCreator(`handleInviteCreated: Recipient not found by email ${inviteEmail}, notification will not be created`);
            return;
        }

        const invite = await this.inviteRepo.findById(inviteId);
        const appCfg = this.configService.get<any>('app') || {};
        const frontendBase = appCfg?.frontendBaseUrl || process.env.FRONTEND_BASE_URL || "http://localhost:3000";
        const inviteUrl = invite?.token ? `${frontendBase}/invite/${invite.token}` : payload?.inviteUrl;

        const companyInfo = await this.getCompanyInfo(companyId);

        if (recipient) {
            const titleText = this.messageFormatter.formatTitle({
                eventCode: 'INVITE_CREATED',
                senderName: inviter.name,
                senderEmail: inviter.email?.toString() || inviter.email,
                companyName: company.name,
                companyId,
                companyDescription: company.description,
                companyLogoUrl: company.logoUrl,
                companyCreatedAt: this.toISOString(company.createdAt) || companyInfo.companyCreatedAt,
                companyMemberCount: company.memberCount || companyInfo.companyMemberCount,
                companyOwnerName: companyInfo.companyOwnerName,
                companyOwnerEmail: companyInfo.companyOwnerEmail,
                inviteId,
                inviteUrl,
                inviteEmail,
                role: invite?.role || payload?.role,
            });

            const bodyText = this.messageFormatter.formatBody({
                eventCode: 'INVITE_CREATED',
                senderName: inviter.name,
                senderEmail: inviter.email?.toString() || inviter.email,
                companyName: company.name,
                companyId,
                companyDescription: company.description,
                companyLogoUrl: company.logoUrl,
                companyCreatedAt: this.toISOString(company.createdAt) || companyInfo.companyCreatedAt,
                companyMemberCount: company.memberCount || companyInfo.companyMemberCount,
                companyOwnerName: companyInfo.companyOwnerName,
                companyOwnerEmail: companyInfo.companyOwnerEmail,
                inviteId,
                inviteUrl,
                inviteEmail,
                role: invite?.role || payload?.role,
            });

            const notification = await this.notificationRepo.create({
                companyId,
                senderUserId: inviter.id || payload.inviterId,
                recipientUserId: recipient.id,
                recipientsEmails: [inviteEmail],
                title: titleText,
                body: bodyText,
                meta: {
                    kind: "invite.created",
                    channel: "company",
                    sender: {
                        id: inviter.id,
                        name: inviter.name,
                        email: inviter.email?.toString() || inviter.email,
                    },
                    company: {
                        id: company.id || companyId,
                        name: company.name,
                        description: company.description,
                        logoUrl: company.logoUrl,
                        createdAt: this.toISOString(company.createdAt) || companyInfo.companyCreatedAt,
                        memberCount: company.memberCount || companyInfo.companyMemberCount,
                    },
                    companyName: company.name,
                    companyId,
                    inviteId,
                    inviteUrl,
                    role: invite?.role || payload?.role,
                    eventId: payload?.eventId || 'INVITE_CREATED',
                    timestamp: payload?.timestamp || new Date().toISOString(),
                },
            });
            this.logger.notificationCreator(`handleInviteCreated: Notification created successfully - id=${notification.id}, title=${notification.title}`);
            await this.emitNotificationCreated(notification, companyId, recipient.id, inviter.id || payload.inviterId);
            this.logger.notificationCreator(`handleInviteCreated: Notification event emitted`);
        } else {
            this.logger.notificationCreator(`handleInviteCreated: Recipient not found, skipping notification creation`);
        }
    }

    private async handleInviteAccepted(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.invitedUserId;
        const receiverId = payload?.receiver?.id || payload?.inviterId;
        const companyId = payload?.companyId || payload?.company?.id;
        const inviteId = payload?.inviteId;
        
        if (!inviteId || !companyId || !senderId || !receiverId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        const companyData = payload?.company || await this.companyRepo.findById(companyId);
        if (!sender || !companyData) return;

        const companyInfo = await this.getCompanyInfo(companyId);

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'INVITE_ACCEPTED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
            inviteId,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'INVITE_ACCEPTED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
            inviteId,
        });

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "invite.accepted",
                channel: "company",
                sender: {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                },
                company: {
                    id: companyData.id || companyId,
                    name: companyData.name,
                    description: companyData.description,
                    logoUrl: companyData.logoUrl,
                        createdAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
                    memberCount: companyData.memberCount || companyInfo.companyMemberCount,
                },
                companyName: companyData.name,
                companyId,
                inviteId,
                eventId: payload?.eventId || 'INVITE_ACCEPTED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, companyId, receiverId, senderId);
    }

    private async handleInviteRejected(_payload: any): Promise<void> {
        // Already handled in invites.controller.ts rejectByCode
        // This is a fallback
    }

    private async handleMemberAdded(payload: any): Promise<void> {
        const userId = payload?.userId || payload?.sender?.id || payload?.receiver?.id;
        const companyId = payload?.companyId || payload?.company?.id;
        if (!userId || !companyId) return;

        const companyData = payload?.company || await this.companyRepo.findById(companyId);
        const sender = payload?.sender || await this.userRepo.findById(userId);
        if (!companyData) return;

        const companyInfo = await this.getCompanyInfo(companyId);

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'MEMBER_ADDED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'MEMBER_ADDED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: userId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "membership.joined",
                channel: "company",
                company: {
                    id: companyData.id || companyId,
                    name: companyData.name,
                    description: companyData.description,
                    logoUrl: companyData.logoUrl,
                        createdAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
                    memberCount: companyData.memberCount || companyInfo.companyMemberCount,
                },
                companyName: companyData.name,
                companyId,
                eventId: payload?.eventId || 'MEMBER_ADDED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, companyId, userId, userId);
    }

    private async handleMemberRemoved(payload: any): Promise<void> {
        const senderId = payload?.sender?.id || payload?.initiatorId;
        const receiverId = payload?.receiver?.id || payload?.userId;
        const companyId = payload?.companyId || payload?.company?.id;
        
        if (!receiverId || !companyId || !senderId) return;

        const sender = payload?.sender || await this.userRepo.findById(senderId);
        const companyData = payload?.company || await this.companyRepo.findById(companyId);
        if (!sender || !companyData) return;

        const companyInfo = await this.getCompanyInfo(companyId);

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'MEMBER_REMOVED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'MEMBER_REMOVED',
            senderName: sender.name,
            senderEmail: sender.email?.toString() || sender.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: senderId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "membership.removed",
                channel: "company",
                sender: {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                },
                company: {
                    id: companyData.id || companyId,
                    name: companyData.name,
                    description: companyData.description,
                    logoUrl: companyData.logoUrl,
                        createdAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
                    memberCount: companyData.memberCount || companyInfo.companyMemberCount,
                },
                companyName: companyData.name,
                companyId,
                eventId: payload?.eventId || 'MEMBER_REMOVED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, companyId, receiverId, senderId);
    }

    private async handleRoleChanged(payload: any): Promise<void> {
        const receiverId = payload?.receiver?.id || payload?.userId;
        const senderId = payload?.sender?.id || payload?.changedBy || payload?.initiatorId || receiverId;
        const companyId = payload?.companyId || payload?.company?.id;
        const newRole = payload?.newRole || payload?.role;
        const oldRole = payload?.oldRole || payload?.previousRole;
        
        if (!receiverId || !companyId || !newRole) return;

        const sender = payload?.sender || (senderId ? await this.userRepo.findById(senderId) : null);
        const companyData = payload?.company || await this.companyRepo.findById(companyId);
        if (!companyData) return;

        const companyInfo = await this.getCompanyInfo(companyId);

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'ROLE_CHANGED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
            newRole,
            oldRole,
            role: newRole,
            previousRole: oldRole,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'ROLE_CHANGED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
            newRole,
            oldRole,
            role: newRole,
            previousRole: oldRole,
        });

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: senderId || receiverId,
            recipientUserId: receiverId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "membership.role.updated",
                channel: "company",
                sender: sender ? {
                    id: sender.id || senderId,
                    name: sender.name,
                    email: sender.email?.toString() || sender.email,
                } : undefined,
                company: {
                    id: companyData.id || companyId,
                    name: companyData.name,
                    description: companyData.description,
                    logoUrl: companyData.logoUrl,
                        createdAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
                    memberCount: companyData.memberCount || companyInfo.companyMemberCount,
                },
                companyName: companyData.name,
                companyId,
                role: newRole,
                previousRole: oldRole,
                eventId: payload?.eventId || 'ROLE_CHANGED',
                timestamp: payload?.timestamp || new Date().toISOString(),
            },
        });
        await this.emitNotificationCreated(notification, companyId, receiverId, senderId || receiverId);
    }

    private async handleCompanyCreated(payload: any): Promise<void> {
        const userId = payload?.userId || payload?.sender?.id;
        const companyId = payload?.companyId || payload?.company?.id;
        if (!companyId || !userId) return;

        const companyData = payload?.company || await this.companyRepo.findById(companyId);
        const sender = payload?.sender || await this.userRepo.findById(userId);
        if (!companyData) return;

        const companyInfo = await this.getCompanyInfo(companyId);

        const titleText = this.messageFormatter.formatTitle({
            eventCode: 'COMPANY_CREATED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const bodyText = this.messageFormatter.formatBody({
            eventCode: 'COMPANY_CREATED',
            senderName: sender?.name,
            senderEmail: sender?.email?.toString() || sender?.email,
            companyName: companyData.name,
            companyId,
            companyDescription: companyData.description,
            companyLogoUrl: companyData.logoUrl,
            companyCreatedAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
            companyMemberCount: companyData.memberCount || companyInfo.companyMemberCount,
            companyOwnerName: companyInfo.companyOwnerName,
            companyOwnerEmail: companyInfo.companyOwnerEmail,
        });

        const notification = await this.notificationRepo.create({
            companyId,
            senderUserId: userId,
            recipientUserId: userId,
            recipientsEmails: [],
            title: titleText,
            body: bodyText,
            meta: {
                kind: "companys.created",
                channel: "company",
                company: {
                    id: companyData.id || companyId,
                    name: companyData.name,
                    description: companyData.description,
                    logoUrl: companyData.logoUrl,
                        createdAt: this.toISOString(companyData.createdAt) || companyInfo.companyCreatedAt,
                    memberCount: companyData.memberCount || companyInfo.companyMemberCount,
                },
                companyName: companyData.name,
                companyId,
                eventId: payload?.eventId || 'COMPANY_CREATED',
                timestamp: payload?.timestamp || new Date().toISOString(),
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

    private async handleCompanyDeleted(_payload: any): Promise<void> {
        // Company is deleted, so we can't create notifications
        // This is handled by cascade delete
    }
}


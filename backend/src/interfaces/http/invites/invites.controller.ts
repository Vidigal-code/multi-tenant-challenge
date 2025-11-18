import {Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards} from "@nestjs/common";
import {ApiBody, ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {INVITE_REPOSITORY, InviteRepository} from "@domain/repositories/invites/invite.repository";
import {NOTIFICATION_REPOSITORY, NotificationRepository} from "@domain/repositories/notifications/notification.repository";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/users/user.repository";
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {InviteStatus} from "@domain/enums/invite-status.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {InviteInfoResponse, SuccessResponse} from "@application/dto/invites/invite.dto";
import {COMPANY_REPOSITORY, CompanyRepository} from "@domain/repositories/companys/company.repository";
import {ConfigService} from "@nestjs/config";
import {Role} from "@domain/enums/role.enum";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {EventPayloadBuilderService} from "@application/services/event-payload-builder.service";

@ApiTags("invites")
@ApiCookieAuth()
@Controller("invites")
export class InvitesController {
    private readonly logger: LoggerService;

    constructor(
        @Inject(INVITE_REPOSITORY) private readonly invites: InviteRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
        @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
        @Inject('EventPayloadBuilderService') private readonly eventBuilder: EventPayloadBuilderService,
    ) {
        this.logger = new LoggerService(InvitesController.name, configService);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "List invites received by authenticated users"})
    @ApiQuery({name: "page", required: false, example: 1})
    @ApiQuery({name: "pageSize", required: false, example: 10})
    @ApiResponse({status: 200, description: "Invites listed"})
    @ApiResponse({status: 400, description: "Invalid pagination params", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    async list(@CurrentUser() user: any, @Query("page") page = 1, @Query("pageSize") pageSize = 10) {
        const email = user.email;
        const p = Math.max(1, Number(page) || 1);
        const ps = Math.min(50, Math.max(1, Number(pageSize) || 10));
        const {data, total} = await this.invites.listByEmail(email, p, ps);
        const pendingInvites = data.filter(i => i.status === InviteStatus.PENDING);
        const invitesWithCompany = await Promise.all(pendingInvites.map(async (i) => {
            const company = await this.companies.findById(i.companyId);
            const inviter = i.inviterId ? await this.users.findById(i.inviterId) : null;
            return {
                id: i.id,
                email: i.email.toString(),
                companyId: i.companyId,
                role: i.role,
                status: i.status,
                token: i.token,
                inviterId: i.inviterId || null,
                inviterName: inviter?.name || null,
                inviterEmail: inviter?.email?.toString() || null,
                createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
                expiresAt: i.expiresAt instanceof Date ? i.expiresAt.toISOString() : (i.expiresAt || null),
                name: company?.name || 'Unknown',
                description: company?.description || '',
                logoUrl: company?.logoUrl || null,
            };
        }));
        return {
            data: invitesWithCompany,
            total: pendingInvites.length,
            page: p,
            pageSize: ps,
        };
    }

    @Get("created")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "List invites created by authenticated users"})
    @ApiQuery({name: "page", required: false, example: 1})
    @ApiQuery({name: "pageSize", required: false, example: 10})
    @ApiResponse({status: 200, description: "Created invites listed"})
    @ApiResponse({status: 400, description: "Invalid pagination params", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    async listCreated(@CurrentUser() user: any, @Query("page") page = 1, @Query("pageSize") pageSize = 10) {
        const p = Math.max(1, Number(page) || 1);
        const ps = Math.min(50, Math.max(1, Number(pageSize) || 10));
        const {data, total} = await this.invites.listByInviter(user.sub, p, ps);
        const invitesWithCompany = await Promise.all(data.map(async (i) => {
            const company = await this.companies.findById(i.companyId);
            const recipient = await this.users.findByEmail(i.email.toString());
            const appCfg = this.configService.get<any>('app') || {};
            const frontendBase = appCfg?.frontendBaseUrl || process.env.FRONTEND_BASE_URL || "http://localhost:3000";
            const inviteUrl = `${frontendBase}/invite/${i.token}`;
            return {
                id: i.id,
                email: i.email.toString(),
                companyId: i.companyId,
                role: i.role,
                status: i.status,
                token: i.token,
                inviteUrl: inviteUrl,
                inviterId: i.inviterId || null,
                recipientName: recipient?.name || null,
                recipientEmail: i.email.toString(),
                createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : i.createdAt,
                expiresAt: i.expiresAt instanceof Date ? i.expiresAt.toISOString() : (i.expiresAt || null),
                name: company?.name || 'Unknown',
                description: company?.description || '',
                logoUrl: company?.logoUrl || null,
            };
        }));
        return {
            data: invitesWithCompany,
            total,
            page: p,
            pageSize: ps,
        };
    }

    @Get(":inviteCode")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Get invites info by code"})
    @ApiResponse({status: 200, description: "Invite found", type: InviteInfoResponse})
    @ApiResponse({status: 404, description: "Invite not found", type: ErrorResponse})
    async getByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) {
            this.logger.default(`Get invite failed: invite not found - code: ${inviteCode}, user: ${user.sub}`);
            throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
        }

        const company = await this.companies.findById(invite.companyId);
        const inviter = invite.inviterId ? await this.users.findById(invite.inviterId) : null;
        const currentUser = await this.users.findById(user.sub);

        const isInviter = invite.inviterId === user.sub;
        const isRecipient = currentUser && invite.email.toString().toLowerCase() === currentUser.email.toString().toLowerCase();

        return {
            id: invite.id,
            companyId: invite.companyId,
            companyName: company?.name || 'Unknown',
            companyLogo: company?.logoUrl || null,
            companyDescription: company?.description || null,
            email: invite.email.toString(),
            inviterEmail: inviter?.email?.toString() || null,
            inviterName: inviter?.name || null,
            status: invite.status,
            role: invite.role,
            createdAt: invite.createdAt.toISOString(),
            expiresAt: invite.expiresAt.toISOString(),
            inviterId: invite.inviterId || undefined,
            isInviter,
            isRecipient,
            canAccept: isRecipient && invite.status === InviteStatus.PENDING && !invite.isExpired(),
            canReject: isRecipient && invite.status === InviteStatus.PENDING && !invite.isExpired(),
        };
    }

    @Post(":inviteCode/accept")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Accept invites by code"})
    @ApiResponse({status: 200, description: "Accepted", type: SuccessResponse})
    @ApiResponse({status: 400, description: "Invalid or expired", type: ErrorResponse})
    async acceptByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) {
            this.logger.default(`Accept invite failed: invite not found - code: ${inviteCode}, user: ${user.sub}`);
            throw new ApplicationError("INVITE_NOT_FOUND");
        }
        if (!invite.isPending()) {
            this.logger.default(`Accept invite failed: invite already used - invite: ${invite.id}, user: ${user.sub}`);
            throw new ApplicationError("INVITE_ALREADY_USED");
        }
        if (invite.isExpired()) {
            await this.invites.markExpired(invite.id);
            this.logger.default(`Accept invite failed: invite expired - invite: ${invite.id}, user: ${user.sub}`);
            throw new ApplicationError("INVITE_EXPIRED");
        }

        const currentUser = await this.users.findById(user.sub);
        if (!currentUser) {
            this.logger.default(`Accept invite failed: user not found - user: ${user.sub}`);
            throw new ApplicationError("USER_NOT_FOUND");
        }
        if (invite.email.toString().toLowerCase() !== currentUser.email.toString().toLowerCase()) {
            this.logger.default(`Accept invite failed: invite not for user - invite: 
            ${invite.id}, invite email: ${invite.email}, user email: ${currentUser.email}, user: ${user.sub}`);
            throw new ApplicationError("INVITE_NOT_FOR_USER");
        }

        const existingMembership = await this.memberships.findByUserAndCompany(user.sub, invite.companyId);
        if (!existingMembership) {
            await this.memberships.create({
                userId: user.sub,
                companyId: invite.companyId,
                role: invite.role as Role,
            });
        }

        if (!currentUser.activeCompanyId) {
            await this.users.update({
                id: user.sub,
                activeCompanyId: invite.companyId,
            });
        }

        await this.invites.markAccepted(invite.id, user.sub);

        const eventPayload = await this.eventBuilder.build({
            eventId: "INVITE_ACCEPTED",
            senderId: user.sub,
            receiverId: invite.inviterId || null,
            companyId: invite.companyId,
            additionalData: {
                inviteId: invite.id,
                invitedUserId: user.sub,
                invitedEmail: invite.email.toString(),
            },
        });

        await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
        await this.rabbit.sendToQueue(
            "events.invites",
            Buffer.from(JSON.stringify(eventPayload)),
        );
        return {success: true, companyId: invite.companyId};
    }

    @Post(":inviteCode/reject")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Reject invites by code"})
    @ApiResponse({status: 200, description: "Rejected", type: SuccessResponse})
    @ApiResponse({status: 400, description: "Invalid or expired", type: ErrorResponse})
    async rejectByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) {
            this.logger.default(`Reject invite failed: invite not found - code: ${inviteCode}, user: ${user.sub}`);
            throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
        }
        if (!invite.isPending()) {
            this.logger.default(`Reject invite failed: invite already used - invite: ${invite.id}, user: ${user.sub}`);
            throw new ApplicationError(ErrorCode.INVITE_ALREADY_USED);
        }

        await this.invites.updateStatus(invite.id, InviteStatus.REJECTED);

        if (invite.inviterId) {
            const company = await this.companies.findById(invite.companyId);
            const rejectedUser = await this.users.findById(user.sub);
            const inviterUser = await this.users.findById(invite.inviterId);

            if (inviterUser) {
                await this.notifications.create({
                    companyId: invite.companyId,
                    senderUserId: user.sub,
                    recipientUserId: invite.inviterId,
                    title: "[INVITE_REJECTED]",
                    body: "INVITE_REJECTED:[your_company_invitation_has_been_rejected.]",
                    meta: {
                        kind: "invites.rejected",
                        channel: "company",
                        inviteId: invite.id,
                        rejectedBy: user.sub,
                        rejectedByName: rejectedUser?.name || null,
                        rejectedByEmail: rejectedUser?.email?.toString() || user.email || null,
                        companyName: company?.name || null,
                        companyId: invite.companyId,
                        inviteEmail: invite.email.toString(),
                        sender: {
                            id: rejectedUser?.id || user.sub,
                            name: rejectedUser?.name || null,
                            email: rejectedUser?.email?.toString() || user.email || null,
                        },
                        company: company ? {
                            id: company.id,
                            name: company.name,
                            description: company.description || null,
                            logoUrl: company.logoUrl || null,
                        } : null,
                    },
                });
            }
        }

        const eventPayload = await this.eventBuilder.build({
            eventId: "INVITE_REJECTED",
            senderId: user.sub,
            receiverId: invite.inviterId || null,
            companyId: invite.companyId,
            additionalData: {
                inviteId: invite.id,
                invitedEmail: invite.email.toString(),
            },
        });

        await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
        await this.rabbit.sendToQueue(
            "events.invites",
            Buffer.from(JSON.stringify(eventPayload)),
        );
        return {success: true};
    }

    @Delete(":inviteId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Delete an invites (sender) or reject/delete received invites"})
    @ApiResponse({status: 200, description: "Invite deleted"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Invite not found", type: ErrorResponse})
    async deleteInvite(@CurrentUser() user: any, @Param("inviteId") inviteId: string) {
        const invite = await this.invites.findById(inviteId);
        if (!invite) {
            this.logger.default(`Delete invite failed: invite not found - invite: ${inviteId}, user: ${user.sub}`);
            throw new ApplicationError("INVITE_NOT_FOUND");
        }

        const userEmail = user.email?.toLowerCase();
        const inviteEmail = invite.email.toString().toLowerCase();
        const isInviter = invite.inviterId === user.sub;
        const isRecipient = userEmail === inviteEmail;

        if (!isInviter && !isRecipient) {
            this.logger.default(`Delete invite failed: forbidden action - invite: ${inviteId}, user:
             ${user.sub}, is inviter: ${isInviter}, is recipient: ${isRecipient}`);
            throw new ApplicationError("FORBIDDEN_ACTION");
        }

        if (isRecipient && !isInviter && invite.isPending()) {
            await this.invites.updateStatus(invite.id, InviteStatus.REJECTED);
        }

        const receiverId = isInviter ? null : invite.inviterId || null;
        const receiverEmail = isInviter ? invite.email.toString() : null;

        const eventPayload = await this.eventBuilder.build({
            eventId: "INVITE_DELETED",
            senderId: user.sub,
            receiverId: receiverId,
            receiverEmail: receiverEmail,
            companyId: invite.companyId,
            additionalData: {
                inviteId: invite.id,
                invitedEmail: invite.email.toString(),
                deletedBy: user.sub,
                isInviter: isInviter,
                isRecipient: isRecipient,
            },
        });

        await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
        await this.rabbit.sendToQueue(
            "events.invites",
            Buffer.from(JSON.stringify(eventPayload)),
        );

        await this.invites.delete(inviteId);
        return {success: true};
    }

    @Delete()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Delete multiple invites"})
    @ApiBody({schema: {properties: {inviteIds: {type: 'array', items: {type: 'string'}}}}})
    @ApiResponse({status: 200, description: "Invites deleted"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    async deleteInvites(@CurrentUser() user: any, @Body() body: { inviteIds: string[] }) {
        const {inviteIds} = body;

        for (const inviteId of inviteIds) {
            const invite = await this.invites.findById(inviteId);
            if (!invite) continue;

            if (invite.inviterId !== user.sub) {
                this.logger.default(`Delete multiple invites failed: forbidden action - invite: ${inviteId}, user:
                 ${user.sub}, inviter: ${invite.inviterId}`);
                throw new ApplicationError("FORBIDDEN_ACTION");
            }
        }

        for (const inviteId of inviteIds) {
            await this.invites.delete(inviteId);
        }

        return {success: true, deletedCount: inviteIds.length};
    }
}
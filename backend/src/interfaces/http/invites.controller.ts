import {Body, Controller, Delete, Get, Inject, Param, Post, Query, UseGuards} from "@nestjs/common";
import {ApiBody, ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/error.response.dto";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {INVITE_REPOSITORY, InviteRepository} from "@domain/repositories/invite.repository";
import {NOTIFICATION_REPOSITORY, NotificationRepository} from "@domain/repositories/notification.repository";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/user.repository";
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from "@domain/repositories/membership.repository";
import {RabbitMQService} from "@infrastructure/messaging/rabbitmq.service";
import {InviteStatus} from "@domain/enums/invite-status.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {InviteInfoResponse, SuccessResponse} from "@application/dto/invite.dto";
import {COMPANY_REPOSITORY, CompanyRepository} from "@domain/repositories/company.repository";
import {ConfigService} from "@nestjs/config";
import {Role} from "@domain/enums/role.enum";

@ApiTags("invites")
@ApiCookieAuth()
@Controller("invites")
export class InvitesController {
    constructor(
        @Inject(INVITE_REPOSITORY) private readonly invites: InviteRepository,
        @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
        @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
        private readonly rabbit: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "List invites received by authenticated user"})
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
    @ApiOperation({summary: "List invites created by authenticated user"})
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
    @ApiOperation({summary: "Get invite info by code"})
    @ApiResponse({status: 200, description: "Invite found", type: InviteInfoResponse})
    @ApiResponse({status: 404, description: "Invite not found", type: ErrorResponse})
    async getByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
        
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
            createdAt: invite.createdAt instanceof Date ? invite.createdAt.toISOString() : invite.createdAt,
            expiresAt: invite.expiresAt instanceof Date ? invite.expiresAt.toISOString() : invite.expiresAt,
            inviterId: invite.inviterId || undefined,
            isInviter,
            isRecipient,
            canAccept: isRecipient && invite.status === InviteStatus.PENDING && !invite.isExpired(),
            canReject: isRecipient && invite.status === InviteStatus.PENDING && !invite.isExpired(),
        };
    }

    @Post(":inviteCode/accept")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Accept invite by code"})
    @ApiResponse({status: 200, description: "Accepted", type: SuccessResponse})
    @ApiResponse({status: 400, description: "Invalid or expired", type: ErrorResponse})
    async acceptByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) throw new ApplicationError("INVITE_NOT_FOUND");
        if (!invite.isPending()) throw new ApplicationError("INVITE_ALREADY_USED");
        if (invite.isExpired()) {
            await this.invites.markExpired(invite.id);
            throw new ApplicationError("INVITE_EXPIRED");
        }
        
        const currentUser = await this.users.findById(user.sub);
        if (!currentUser) throw new ApplicationError("USER_NOT_FOUND");
        if (invite.email.toString().toLowerCase() !== currentUser.email.toString().toLowerCase()) {
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
        
        await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
        await this.rabbit.sendToQueue(
            "events.invites",
            Buffer.from(
                JSON.stringify({
                    eventId: "INVITE_ACCEPTED",
                    inviteId: invite.id,
                    companyId: invite.companyId,
                    invitedUserId: user.sub,
                    invitedEmail: invite.email.toString(),
                    timestamp: new Date().toISOString(),
                }),
            ),
        );
        return {success: true, companyId: invite.companyId};
    }

    @Post(":inviteCode/reject")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Reject invite by code"})
    @ApiResponse({status: 200, description: "Rejected", type: SuccessResponse})
    @ApiResponse({status: 400, description: "Invalid or expired", type: ErrorResponse})
    async rejectByCode(@CurrentUser() user: any, @Param("inviteCode") inviteCode: string) {
        const invite = await this.invites.findByToken(inviteCode);
        if (!invite) throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
        if (!invite.isPending()) throw new ApplicationError(ErrorCode.INVITE_ALREADY_USED);
        
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
                    title: "INVITE_REJECTED",
                    body: "INVITE_REJECTED",
                    meta: {
                        kind: "invite.rejected",
                        inviteId: invite.id,
                        rejectedBy: user.sub,
                        rejectedByName: rejectedUser?.name || null,
                        rejectedByEmail: invite.email.toString(),
                        companyName: company?.name || null,
                        inviteEmail: invite.email.toString(),
                    },
                });
            }
        }
        
        await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
        await this.rabbit.sendToQueue(
            "events.invites",
            Buffer.from(
                JSON.stringify({
                    eventId: "INVITE_REJECTED",
                    inviteId: invite.id,
                    companyId: invite.companyId,
                    inviterId: invite.inviterId,
                    invitedEmail: invite.email.toString(),
                    invitedName: user.name ?? null,
                    timestamp: new Date().toISOString(),
                }),
            ),
        );
        return {success: true};
    }

    @Delete(":inviteId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Delete an invite (sender) or reject/delete received invite"})
    @ApiResponse({status: 200, description: "Invite deleted"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Invite not found", type: ErrorResponse})
    async deleteInvite(@CurrentUser() user: any, @Param("inviteId") inviteId: string) {
        const invite = await this.invites.findById(inviteId);
        if (!invite) throw new ApplicationError("INVITE_NOT_FOUND");

        const userEmail = user.email?.toLowerCase();
        const inviteEmail = invite.email.toString().toLowerCase();
        const isInviter = invite.inviterId === user.sub;
        const isRecipient = userEmail === inviteEmail;

        if (!isInviter && !isRecipient) {
            throw new ApplicationError("FORBIDDEN_ACTION");
        }

        if (isRecipient && !isInviter && invite.isPending()) {
            await this.invites.updateStatus(invite.id, InviteStatus.REJECTED);
        }

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
                throw new ApplicationError("FORBIDDEN_ACTION");
            }
        }

        for (const inviteId of inviteIds) {
            await this.invites.delete(inviteId);
        }

        return {success: true, deletedCount: inviteIds.length};
    }
}

import {Body, Controller, Delete, Get, Inject, Param, Patch, Post, UseGuards} from "@nestjs/common";
import {ApiCookieAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/error.response.dto";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {TenantGuard} from "@common/guards/tenant.guard";
import {RolesGuard} from "@common/guards/roles.guard";
import {Roles} from "@common/decorators/roles.decorator";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {Role} from "@domain/enums/role.enum";
import {RemoveMemberUseCase} from "@application/use-cases/remove-member.usecase";
import {ChangeMemberRoleUseCase} from "@application/use-cases/change-member-role.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/leave-company.usecase";
import {TransferOwnershipUseCase} from "@application/use-cases/transfer-ownership.usecase";
import {MEMBERSHIP_REPOSITORY, MembershipRepository,} from "@domain/repositories/membership.repository";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/user.repository";

@ApiTags("membership")
@ApiCookieAuth()
@Controller("company/:companyId/members")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MembershipController {
    constructor(
        private readonly removeMemberUseCase: RemoveMemberUseCase,
        private readonly changeMemberRoleUseCase: ChangeMemberRoleUseCase,
        private readonly leaveCompanyUseCase: LeaveCompanyUseCase,
        private readonly transferOwnershipUseCase: TransferOwnershipUseCase,
        @Inject(MEMBERSHIP_REPOSITORY)
        private readonly membershipRepository: MembershipRepository,
        @Inject(USER_REPOSITORY)
        private readonly userRepository: UserRepository,
    ) {
    }

    @Get()
    @ApiOperation({summary: "List members of company"})
    @ApiResponse({status: 200, description: "Members listed"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    async listMembers(@CurrentUser() user: any, @Param("companyId") companyId: string) {
        const members = await this.membershipRepository.listByCompany(companyId);
        const currentUserMembership = await this.membershipRepository.findByUserAndCompany(user.sub, companyId);
        const currentUserRole = currentUserMembership?.role ?? null;
        
        const membersWithDetails = await Promise.all(
            members.map(async (m) => {
                const userDetails = await this.userRepository.findById(m.userId);
                return {
                    id: m.id,
                    userId: m.userId,
                    role: m.role,
                    name: userDetails?.name ?? 'Unknown',
                    email: userDetails?.email?.toString() ?? '',
                    joinedAt: m.createdAt.toISOString(),
                };
            })
        );
        
        return {
            members: membersWithDetails,
            total: membersWithDetails.length,
            currentUserRole,
        };
    }

    @Get('role')
    @ApiOperation({summary: 'Get current user role within company'})
    @ApiResponse({status: 200, description: 'Role returned'})
    @ApiResponse({status: 403, description: 'Forbidden', type: ErrorResponse})
    async getMyRole(@CurrentUser() user: any, @Param('companyId') companyId: string) {
        const membership = await this.membershipRepository.findByUserAndCompany(user.sub, companyId);
        return {role: membership?.role ?? null};
    }

    @Delete(":userId")
    @Roles(Role.OWNER, Role.ADMIN)
    @ApiOperation({summary: "Remove a member from company"})
    @ApiResponse({status: 200, description: "Member removed"})
    @ApiResponse({status: 403, description: "Insufficient role or invariant violations", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Member not found", type: ErrorResponse})
    async removeMember(
        @CurrentUser() user: any,
        @Param("companyId") companyId: string,
        @Param("userId") userId: string,
    ) {
        try {
            return await this.removeMemberUseCase.execute({
                requesterId: user.sub,
                companyId,
                targetUserId: userId,
            });
        } catch (e: any) {
            throw e;
        }
    }

    @Patch(":userId/role")
    @Roles(Role.OWNER)
    @ApiOperation({summary: "Change a member role"})
    @ApiResponse({status: 200, description: "Role updated"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Member not found", type: ErrorResponse})
    async changeRole(
        @CurrentUser() user: any,
        @Param("companyId") companyId: string,
        @Param("userId") userId: string,
        @Body() body: { role: Role },
    ) {
        try {
            return await this.changeMemberRoleUseCase.execute({
                requesterId: user.sub,
                companyId,
                targetUserId: userId,
                newRole: body.role,
            });
        } catch (e: any) {
            throw e;
        }
    }

    @Post('transfer-ownership')
    @Roles(Role.OWNER)
    @ApiOperation({summary: 'Transfer company ownership to another member'})
    @ApiResponse({status: 200, description: 'Ownership transferred'})
    @ApiResponse({status: 403, description: 'Forbidden', type: ErrorResponse})
    @ApiResponse({status: 404, description: 'Member not found', type: ErrorResponse})
    async transferOwnership(
        @CurrentUser() user: any,
        @Param('companyId') companyId: string,
        @Body() body: { newOwnerId: string },
    ) {
        return await this.transferOwnershipUseCase.execute({
            requesterId: user.sub,
            companyId,
            newOwnerId: body.newOwnerId,
        });
    }

    @Get('primary-owner')
    @ApiOperation({summary: 'Get primary owner (creator) of company'})
    @ApiResponse({status: 200, description: 'Primary owner returned'})
    @ApiResponse({status: 403, description: 'Forbidden', type: ErrorResponse})
    async getPrimaryOwner(@Param('companyId') companyId: string) {
        const members = await this.membershipRepository.listByCompany(companyId);
        const ownerMemberships = members.filter(m => m.role === Role.OWNER);
        
        if (ownerMemberships.length === 0) {
            return { primaryOwnerId: null, primaryOwnerUserId: null };
        }
        
        ownerMemberships.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const primaryOwner = ownerMemberships[0];
        
        const primaryOwnerUser = await this.userRepository.findById(primaryOwner.userId);
        
        return {
            primaryOwnerId: primaryOwner.id,
            primaryOwnerUserId: primaryOwner.userId,
            primaryOwnerName: primaryOwnerUser?.name ?? 'Unknown',
            primaryOwnerEmail: primaryOwnerUser?.email?.toString() ?? '',
            createdAt: primaryOwner.createdAt.toISOString(),
        };
    }
}

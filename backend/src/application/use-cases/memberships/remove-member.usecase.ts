import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {CompanyPermissionService} from "@domain/services/company-permission.service";

export interface RemoveMemberInput {
    requesterId: string;
    companyId: string;
    targetUserId: string;
}

export class RemoveMemberUseCase {
    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly companyRepository: CompanyRepository,
        private readonly userRepository: UserRepository,
        private readonly domainEvents?: DomainEventsService,
    ) {
    }

    async execute(input: RemoveMemberInput) {
        const requesterMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.requesterId,
                input.companyId,
            );

        if (!requesterMembership) {
            throw new ApplicationError(ErrorCode.REQUESTER_NOT_MEMBER);
        }

        if (requesterMembership.role === Role.MEMBER) {
            throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
        }

        const targetMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.targetUserId,
                input.companyId,
            );

        if (!targetMembership) {
            throw new ApplicationError(ErrorCode.TARGET_NOT_MEMBER);
        }

        if (input.requesterId === input.targetUserId && targetMembership.role === Role.OWNER) {
            const ownerCount = await this.membershipRepository.countByCompanyAndRole(
                input.companyId,
                Role.OWNER,
            );
            if (ownerCount <= 1) {
                throw new ApplicationError(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
            }
        }

        if (input.requesterId === input.targetUserId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        if (targetMembership.role === Role.OWNER) {
            const ownerCount = await this.membershipRepository.countByCompanyAndRole(
                input.companyId,
                Role.OWNER,
            );
            if (ownerCount <= 1) {
                throw new ApplicationError(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
            }
        }

        const allowed = CompanyPermissionService.canModify(
            requesterMembership.role,
            targetMembership.role,
            "remove-member",
            false,
        );
        if (!allowed) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        const allMembers = await this.membershipRepository.listByCompany(input.companyId);
        const leadershipMembers = allMembers
            .filter((member) => (
                member.userId !== input.targetUserId &&
                (member.role === Role.OWNER || member.role === Role.ADMIN)
            ))
            .map((member) => member.userId);
        
        if ((requesterMembership.role === Role.OWNER || requesterMembership.role === Role.ADMIN) &&
            !leadershipMembers.includes(input.requesterId)) {
            leadershipMembers.push(input.requesterId);
        }

        await this.membershipRepository.remove(targetMembership.id);

        const targetUser = await this.userRepository.findById(input.targetUserId);
        if (targetUser && targetUser.activeCompanyId === input.companyId) {
            await this.userRepository.update({
                id: input.targetUserId,
                activeCompanyId: null,
            });
        }

        if (this.domainEvents) {

            await this.domainEvents.publish({
                name: "memberships.removed",
                payload: {
                    eventId: "USER_REMOVED",
                    companyId: input.companyId,
                    userId: input.targetUserId,
                    initiatorId: input.requesterId,
                    notifiedUserIds: leadershipMembers,
                    role: targetMembership.role,
                    timestamp: new Date().toISOString(),
                },
            });
        }

        return {success: true};
    }
}

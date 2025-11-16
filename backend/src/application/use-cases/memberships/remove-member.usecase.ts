import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {CompanyPermissionService} from "@domain/services/company-permission.service";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface RemoveMemberInput {
    requesterId: string;
    companyId: string;
    targetUserId: string;
}

export class RemoveMemberUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly companyRepository: CompanyRepository,
        private readonly userRepository: UserRepository,
        private readonly domainEvents?: DomainEventsService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(RemoveMemberUseCase.name, configService);
    }

    async execute(input: RemoveMemberInput) {
        const requesterMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.requesterId,
                input.companyId,
            );

        if (!requesterMembership) {
            this.logger.default(`Remove member failed: requester is not a member - requester: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.REQUESTER_NOT_MEMBER);
        }

        if (requesterMembership.role === Role.MEMBER) {
            this.logger.default(`Remove member failed: insufficient role - requester: ${input.requesterId}, company: ${input.companyId}, role: ${requesterMembership.role}`);
            throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
        }

        const targetMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.targetUserId,
                input.companyId,
            );

        if (!targetMembership) {
            this.logger.default(`Remove member failed: target is not a member - target: ${input.targetUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.TARGET_NOT_MEMBER);
        }

        if (input.requesterId === input.targetUserId) {
            this.logger.default(`Remove member failed: forbidden action - user cannot remove self - user: ${input.targetUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        const allMembers = await this.membershipRepository.listByCompany(input.companyId);
        const ownerMemberships = allMembers.filter(m => m.role === Role.OWNER);
        ownerMemberships.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const primaryOwner = ownerMemberships[0];
        const isRequesterPrimaryOwner = primaryOwner && primaryOwner.userId === input.requesterId;

        if (!isRequesterPrimaryOwner) {
            if (targetMembership.role === Role.OWNER) {
                const ownerCount = await this.membershipRepository.countByCompanyAndRole(
                    input.companyId,
                    Role.OWNER,
                );
                if (ownerCount <= 1) {
                    this.logger.default(`Remove member failed: last owner cannot be removed - owner: ${input.targetUserId}, company: ${input.companyId}`);
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
                this.logger.default(`Remove member failed: forbidden action - requester: ${input.requesterId}, target: ${input.targetUserId}, company: ${input.companyId}`);
                throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
            }
        }

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

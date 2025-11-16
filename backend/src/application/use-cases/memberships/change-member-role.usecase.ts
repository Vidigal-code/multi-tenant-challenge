import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {CompanyPermissionService} from "@domain/services/company-permission.service";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface ChangeMemberRoleInput {
    requesterId: string;
    companyId: string;
    targetUserId: string;
    newRole: Role;
}

export class ChangeMemberRoleUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(ChangeMemberRoleUseCase.name, configService);
    }

    async execute(input: ChangeMemberRoleInput) {
        const requesterMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.requesterId,
                input.companyId,
            );

        if (!requesterMembership) {
            this.logger.default(`Change member role failed: requester is not a member - requester: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.REQUESTER_NOT_MEMBER);
        }

        if (requesterMembership.role !== Role.OWNER) {
            this.logger.default(`Change member role failed: insufficient role - requester: ${input.requesterId}, company: ${input.companyId}, role: ${requesterMembership.role}`);
            throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
        }

        const targetMembership =
            await this.membershipRepository.findByUserAndCompany(
                input.targetUserId,
                input.companyId,
            );

        if (!targetMembership) {
            this.logger.default(`Change member role failed: target is not a member - target: ${input.targetUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.TARGET_NOT_MEMBER);
        }

        if (input.requesterId === input.targetUserId) {
            this.logger.default(`Change member role failed: cannot change own role - user: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        if (targetMembership.role === Role.OWNER && requesterMembership.role !== Role.OWNER) {
            this.logger.default(`Change member role failed: cannot modify owner - target: ${input.targetUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.CANNOT_MODIFY_OWNER);
        }

        const allowed = CompanyPermissionService.canModify(
            requesterMembership.role,
            targetMembership.role,
            'change-role',
            input.requesterId === input.targetUserId,
        );
        if (!allowed) {
            this.logger.default(`Change member role failed: forbidden action - requester: ${input.requesterId}, target: ${input.targetUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        if (input.newRole === Role.OWNER && requesterMembership.role !== Role.OWNER) {
            this.logger.default(`Change member role failed: only owner can invite owner - requester: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.ONLY_OWNER_CAN_INVITE_OWNER);
        }

        if (targetMembership.role === input.newRole) {
            return {success: true, unchanged: true};
        }

        if (targetMembership.role === Role.OWNER && input.newRole !== Role.OWNER) {
            const ownerCount = await this.membershipRepository.countByCompanyAndRole(
                input.companyId,
                Role.OWNER,
            );
            if (ownerCount <= 1) {
                this.logger.default(`Change member role failed: last owner cannot be removed - target: ${input.targetUserId}, company: ${input.companyId}`);
                throw new ApplicationError(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
            }
        }

        await (this.membershipRepository as any).updateRole?.(
            targetMembership.id,
            input.newRole,
        );

        await this.domainEvents.publish({
            name: "memberships.role.updated",
            payload: {
                eventId: "USER_STATUS_UPDATED",
                companyId: input.companyId,
                userId: input.targetUserId,
                oldRole: targetMembership.role,
                newRole: input.newRole,
                initiatorId: input.requesterId,
                timestamp: new Date().toISOString(),
            },
        });

        return {success: true};
    }
}

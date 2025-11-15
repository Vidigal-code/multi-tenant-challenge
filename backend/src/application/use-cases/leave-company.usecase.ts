import {MembershipRepository} from "@domain/repositories/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";

export interface LeaveCompanyInput {
    userId: string;
    companyId: string;
}

export class LeaveCompanyUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: LeaveCompanyInput) {
        const membership = await this.memberships.findByUserAndCompany(
            input.userId,
            input.companyId,
        );
        if (!membership) throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
        if (membership.role === Role.OWNER) {
            throw new ApplicationError(ErrorCode.OWNER_MUST_TRANSFER_BEFORE_LEAVE);
        }
        await this.memberships.remove(membership.id);

        const leadershipMembers = (await this.memberships.listByCompany(input.companyId))
            .filter((member) => (
                member.userId !== input.userId &&
                (member.role === Role.OWNER || member.role === Role.ADMIN)
            ))
            .map((member) => member.userId);

        await this.domainEvents.publish({
            name: "member.left",
            payload: {
                companyId: input.companyId,
                userId: input.userId,
                notifiedUserIds: leadershipMembers,
                role: membership.role,
                timestamp: new Date().toISOString(),
            },
        });
        return {left: true};
    }
}

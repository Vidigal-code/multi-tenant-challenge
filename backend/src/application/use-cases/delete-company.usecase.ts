import {ForbiddenException, Inject, NotFoundException} from '@nestjs/common';
import {COMPANY_REPOSITORY, CompanyRepository} from '@domain/repositories/company.repository';
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from '@domain/repositories/membership.repository';
import {Role} from '@domain/enums/role.enum';
import {USER_REPOSITORY, UserRepository} from '@domain/repositories/user.repository';

interface DeleteCompanyCommand {
    companyId: string;
    requesterId: string;
}

export class DeleteCompanyUseCase {
    constructor(
        @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    ) {
    }

    async execute(cmd: DeleteCompanyCommand) {
        const company = await this.companies.findById(cmd.companyId);
        if (!company) throw new NotFoundException('COMPANY_NOT_FOUND');
        const membership = await this.memberships.findByUserAndCompany(cmd.requesterId, cmd.companyId);
        if (!membership) throw new ForbiddenException('NOT_A_MEMBER');
        if (membership.role !== Role.OWNER) throw new ForbiddenException('ONLY_OWNER_CAN_DELETE');

        // Safety: ensure no other owners? (business rule optional)
        const owners = company.memberships.filter(m => m.role === Role.OWNER);
        if (owners.length > 1) {
            // Allow deletion only if single owner or all owners agree (simplified rule)
            // Here just proceed; real-world might require confirmation workflow.
        }

        await this.companies.delete(cmd.companyId);

        // Clear activeCompanyId for users who had this active

        for (const member of company.memberships) {
            const user = await this.users.findById(member.userId);
            if (user && user.activeCompanyId === company.id) {
                await this.users.update({id: user.id, activeCompanyId: null});
            }
        }
        return {success: true};
    }
}

import {BadRequestException, ForbiddenException, Inject, NotFoundException} from '@nestjs/common';
import {COMPANY_REPOSITORY, CompanyRepository} from '@domain/repositories/company.repository';
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from '@domain/repositories/membership.repository';
import {Role} from '@domain/enums/role.enum';

interface UpdateCompanyCommand {
    companyId: string;
    requesterId: string;
    name?: string;
    logoUrl?: string | null;
    description?: string | null;
    isPublic?: boolean;
}

export class UpdateCompanyUseCase {
    constructor(
        @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    ) {
    }

    async execute(cmd: UpdateCompanyCommand) {
        const company = await this.companies.findById(cmd.companyId);
        if (!company) throw new NotFoundException('COMPANY_NOT_FOUND');
        const membership = await this.memberships.findByUserAndCompany(cmd.requesterId, cmd.companyId);
        if (!membership) throw new ForbiddenException('NOT_A_MEMBER');
        if (membership.role !== Role.OWNER && membership.role !== Role.ADMIN) {
            throw new ForbiddenException('INSUFFICIENT_ROLE');
        }
        if (!cmd.name && cmd.logoUrl === undefined && cmd.description === undefined && cmd.isPublic === undefined) {
            throw new BadRequestException('NO_FIELDS_TO_UPDATE');
        }
        const updated = await this.companies.update({
            id: cmd.companyId, name: cmd.name,
            logoUrl: cmd.logoUrl, description: cmd.description, isPublic: cmd.isPublic
        });
        return {company: updated};
    }
}

import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

export interface GetCompanyInput {
    userId: string;
    companyId: string;
    activeCompanyId?: string | null;
}

export class GetCompanyUseCase {
    constructor(
        private readonly companyRepository: CompanyRepository,
        private readonly membershipRepository: MembershipRepository,
    ) {
    }

    async execute(input: GetCompanyInput) {
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw new ApplicationError(ErrorCode.COMPANY_NOT_FOUND);
        }

        if (!company.isPublic) {
            const membership = await this.membershipRepository.findByUserAndCompany(input.userId, input.companyId);
            if (!membership) {
                throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
            }
        }

        return {company};
    }
}

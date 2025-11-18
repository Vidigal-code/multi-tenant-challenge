import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface GetCompanyInput {
    userId: string;
    companyId: string;
    activeCompanyId?: string | null;
}

export class GetCompanyUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly companyRepository: CompanyRepository,
        private readonly membershipRepository: MembershipRepository,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(GetCompanyUseCase.name, configService);
    }

    async execute(input: GetCompanyInput) {
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            this.logger.default(`Get company failed: company not found - company: ${input.companyId}, user: ${input.userId}`);
            throw new ApplicationError(ErrorCode.COMPANY_NOT_FOUND);
        }

        if (!company.isPublic) {
            const membership = await this.membershipRepository.findByUserAndCompany(input.userId, input.companyId);
            if (!membership) {
                this.logger.default(`Get company failed: user is not a member - company: ${input.companyId}, user: ${input.userId}`);
                throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
            }
        }

        return {company};
    }
}

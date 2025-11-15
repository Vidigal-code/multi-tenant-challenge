import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";

export interface CreateCompanyInput {
    ownerId: string;
    name: string;
    logoUrl?: string | null;
    description?: string;
    is_public?: boolean;
}

export class CreateCompanyUseCase {
    constructor(
        private readonly companyRepository: CompanyRepository,
        private readonly userRepository: UserRepository,
        private readonly membershipRepository: MembershipRepository,
    ) {
    }

    async execute(input: CreateCompanyInput) {
        const owner = await this.userRepository.findById(input.ownerId);
        if (!owner) {
            throw new ApplicationError(ErrorCode.OWNER_NOT_FOUND);
        }

        const company = await this.companyRepository.create({
            name: input.name,
            logoUrl: input.logoUrl,
            description: input.description,
            isPublic: input.is_public ?? false,
            ownerId: owner.id,
        });

        await this.membershipRepository.create({
            userId: owner.id,
            companyId: company.id,
            role: Role.OWNER,
        });

        await this.userRepository.update({
            id: owner.id,
            activeCompanyId: company.id,
        });

        return {company};
    }
}

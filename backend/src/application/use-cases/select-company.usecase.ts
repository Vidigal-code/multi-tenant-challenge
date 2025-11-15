import {MembershipRepository} from "@domain/repositories/membership.repository";
import {UserRepository} from "@domain/repositories/user.repository";
import {ApplicationError} from "@application/errors/application-error";

export interface SelectCompanyInput {
    userId: string;
    companyId: string;
}

export class SelectCompanyUseCase {
    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly userRepository: UserRepository,
    ) {
    }

    async execute(input: SelectCompanyInput) {
        const membership = await this.membershipRepository.findByUserAndCompany(
            input.userId,
            input.companyId,
        );

        if (!membership) {
            throw new ApplicationError("NOT_A_MEMBER");
        }

        await this.userRepository.update({
            id: input.userId,
            activeCompanyId: input.companyId,
        });

        return {companyId: input.companyId};
    }
}

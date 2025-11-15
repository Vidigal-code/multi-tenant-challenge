import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

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
            throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
        }

        await this.userRepository.update({
            id: input.userId,
            activeCompanyId: input.companyId,
        });

        return {companyId: input.companyId};
    }
}

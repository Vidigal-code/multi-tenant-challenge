import {InviteRepository} from "@domain/repositories/invite.repository";
import {MembershipRepository} from "@domain/repositories/membership.repository";
import {UserRepository} from "@domain/repositories/user.repository";
import {HashingService} from "@application/ports/hashing.service";
import {ApplicationError} from "@application/errors/application-error";
import {Role} from "@domain/enums/role.enum";

export interface AcceptInviteInput {
    token: string;
    name?: string;
    password?: string;
}

export class AcceptInviteUseCase {
    constructor(
        private readonly inviteRepository: InviteRepository,
        private readonly membershipRepository: MembershipRepository,
        private readonly userRepository: UserRepository,
        private readonly hashingService: HashingService,
    ) {
    }

    async execute(input: AcceptInviteInput) {
        const invite = await this.inviteRepository.findByToken(input.token);

        if (!invite) {
            throw new ApplicationError("INVITE_NOT_FOUND");
        }

        if (!invite.isPending()) {
            throw new ApplicationError("INVITE_ALREADY_USED");
        }

        if (invite.isExpired(new Date())) {
            await this.inviteRepository.markExpired(invite.id);
            throw new ApplicationError("INVITE_EXPIRED");
        }

        const email = invite.email.toString();
        let user = await this.userRepository.findByEmail(email);

        if (!user) {
            if (!input.name || !input.password) {
                throw new ApplicationError("MISSING_USER_DATA");
            }

            const passwordHash = await this.hashingService.hash(input.password);
            user = await this.userRepository.create({
                email,
                name: input.name,
                passwordHash,
            });
        }

        const membership = await this.membershipRepository.findByUserAndCompany(
            user.id,
            invite.companyId,
        );
        if (!membership) {
            await this.membershipRepository.create({
                userId: user.id,
                companyId: invite.companyId,
                role: invite.role as Role,
            });
        }

        const updatedUser = await this.userRepository.update({
            id: user.id,
            activeCompanyId: user.activeCompanyId ?? invite.companyId,
        });

        await this.inviteRepository.markAccepted(invite.id, updatedUser.id);

        return {user: updatedUser, companyId: invite.companyId};
    }
}

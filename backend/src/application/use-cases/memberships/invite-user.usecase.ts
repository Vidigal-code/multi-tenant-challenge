import {InviteRepository} from "@domain/repositories/invites/invite.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {Invite} from "@domain/entities/invites/invite.entity";
import {Role} from "@domain/enums/role.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {InviteTokenService} from "@application/ports/invite-token.service";
import {EmailValidationService} from "@application/ports/email-validation.service";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {ConfigService} from "@nestjs/config";
import {InviteStatus} from "@domain/enums/invite-status.enum";

export interface InviteUserInput {
    inviterUserId: string;
    companyId: string;
    email: string;
    role: Role;
    expiresInDays: number;
}

export class InviteUserUseCase {
    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly inviteRepository: InviteRepository,
        private readonly userRepository: UserRepository,
        private readonly inviteTokenService: InviteTokenService,
        private readonly domainEvents: DomainEventsService,
        private readonly emailValidation: EmailValidationService,
        private readonly config?: ConfigService,
    ) {
    }

    async execute(input: InviteUserInput): Promise<{ invite: Invite }> {
        const membership = await this.membershipRepository.findByUserAndCompany(
            input.inviterUserId,
            input.companyId,
        );

        if (!membership) {
            throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
        }

        if (membership.role === Role.MEMBER) {
            throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
        }

        if (input.role === Role.OWNER && membership.role !== Role.OWNER) {
            throw new ApplicationError(ErrorCode.ONLY_OWNER_CAN_INVITE_OWNER);
        }

        const email = input.email.trim().toLowerCase();

        const inviterUser = await this.userRepository.findById(input.inviterUserId);
        if (inviterUser && inviterUser.email.toString().toLowerCase() === email) {
            throw new ApplicationError(ErrorCode.CANNOT_INVITE_SELF);
        }

        const requireExisting = (this.config?.get("app.invite.requireExistingUser") as boolean) ?? true;
        let invitedUser = null;
        if (requireExisting) {
            const exists = await this.emailValidation.exists(email);
            if (!exists) {
                throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
            }
            invitedUser = await this.userRepository.findByEmail(email);
        }

        if (invitedUser) {
            const existingMember = await this.membershipRepository.findByUserAndCompany(
                invitedUser.id,
                input.companyId,
            );
            if (existingMember) {
                throw new ApplicationError(ErrorCode.CANNOT_INVITE_MEMBER);
            }
        }


        const token = this.inviteTokenService.generate();
        const expiresAt = new Date(
            Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
        );

        const invite = await this.inviteRepository.createOrReuse({
            companyId: input.companyId,
            email,
            token,
            role: input.role,
            expiresAt,
            inviterId: input.inviterUserId,
        });

        await this.domainEvents.publish({
            name: "invites.created",
            payload: {
                inviteId: invite.id,
                companyId: invite.companyId,
                email: invite.email.toString(),
                role: invite.role,
                token: invite.token,
                expiresAt: invite.expiresAt,
            },
        });

        return {invite};
    }
}

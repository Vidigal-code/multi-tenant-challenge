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
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface InviteUserInput {
    inviterUserId: string;
    companyId: string;
    email: string;
    role: Role;
    expiresInDays: number;
}

export class InviteUserUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly membershipRepository: MembershipRepository,
        private readonly inviteRepository: InviteRepository,
        private readonly userRepository: UserRepository,
        private readonly inviteTokenService: InviteTokenService,
        private readonly domainEvents: DomainEventsService,
        private readonly emailValidation: EmailValidationService,
        private readonly config?: ConfigService,
    ) {
        this.logger = new LoggerService(InviteUserUseCase.name, config);
    }

    async execute(input: InviteUserInput): Promise<{ invite: Invite }> {
        const membership = await this.membershipRepository.findByUserAndCompany(
            input.inviterUserId,
            input.companyId,
        );

        if (!membership) {
            this.logger.default(`Invite failed: user is not a member - user:
             ${input.inviterUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
        }

        if (membership.role === Role.MEMBER) {
            this.logger.default(`Invite failed: insufficient role - user:
             ${input.inviterUserId}, company: ${input.companyId}, role: ${membership.role}`);
            throw new ApplicationError(ErrorCode.INSUFFICIENT_ROLE);
        }

        if (input.role === Role.OWNER && membership.role !== Role.OWNER) {
            this.logger.default(`Invite failed: only owner can invite owner - user:
             ${input.inviterUserId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.ONLY_OWNER_CAN_INVITE_OWNER);
        }

        const email = input.email.trim().toLowerCase();

        const inviterUser = await this.userRepository.findById(input.inviterUserId);
        if (inviterUser && inviterUser.email.toString().toLowerCase() === email) {
            this.logger.default(`Invite failed: cannot invite self - user: ${input.inviterUserId}, email: ${email}`);
            throw new ApplicationError(ErrorCode.CANNOT_INVITE_SELF);
        }

        const requireExisting = (this.config?.get("app.invite.requireExistingUser") as boolean) ?? true;
        let invitedUser = null;
        if (requireExisting) {
            const exists = await this.emailValidation.exists(email);
            if (!exists) {
                this.logger.default(`Invite failed: user not found - email: ${email}, company: ${input.companyId}`);
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
                this.logger.default(`Invite failed: user is already a member - user: ${invitedUser.id}, company: ${input.companyId}`);
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

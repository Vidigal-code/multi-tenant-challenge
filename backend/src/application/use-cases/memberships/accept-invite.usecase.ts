import { InviteRepository } from "@domain/repositories/invites/invite.repository";
import { MembershipRepository } from "@domain/repositories/memberships/membership.repository";
import { UserRepository } from "@domain/repositories/users/user.repository";
import { HashingService } from "@application/ports/hashing.service";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { Role } from "@domain/enums/role.enum";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

export interface AcceptInviteInput {
  token: string;
  name?: string;
  password?: string;
}

export class AcceptInviteUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly inviteRepository: InviteRepository,
    private readonly membershipRepository: MembershipRepository,
    private readonly userRepository: UserRepository,
    private readonly hashingService: HashingService,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(AcceptInviteUseCase.name, configService);
  }

  async execute(input: AcceptInviteInput) {
    const invite = await this.inviteRepository.findByToken(input.token);

    if (!invite) {
      this.logger.default(
        `Accept invite failed: invite not found - token: ${input.token}`,
      );
      throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
    }

    if (!invite.isPending()) {
      this.logger.default(
        `Accept invite failed: invite already used - invite: ${invite.id}, token: ${input.token}`,
      );
      throw new ApplicationError(ErrorCode.INVITE_ALREADY_USED);
    }

    if (invite.isExpired(new Date())) {
      await this.inviteRepository.markExpired(invite.id);
      this.logger.default(
        `Accept invite failed: invite expired - invite: ${invite.id}, token: ${input.token}`,
      );
      throw new ApplicationError(ErrorCode.INVITE_EXPIRED);
    }

    const email = invite.email.toString();
    let user = await this.userRepository.findByEmail(email);

    if (!user) {
      if (!input.name || !input.password) {
        this.logger.default(
          `Accept invite failed: missing user data - email: ${email}, token: ${input.token}`,
        );
        throw new ApplicationError(ErrorCode.MISSING_USER_DATA);
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

    return { user: updatedUser, companyId: invite.companyId };
  }
}

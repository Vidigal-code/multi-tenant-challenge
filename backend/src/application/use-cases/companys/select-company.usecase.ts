import { MembershipRepository } from "@domain/repositories/memberships/membership.repository";
import { UserRepository } from "@domain/repositories/users/user.repository";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

export interface SelectCompanyInput {
  userId: string;
  companyId: string;
}

export class SelectCompanyUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly membershipRepository: MembershipRepository,
    private readonly userRepository: UserRepository,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(SelectCompanyUseCase.name, configService);
  }

  async execute(input: SelectCompanyInput) {
    const membership = await this.membershipRepository.findByUserAndCompany(
      input.userId,
      input.companyId,
    );

    if (!membership) {
      this.logger.default(
        `Select company failed: user is not a member - user: ${input.userId}, company: ${input.companyId}`,
      );
      throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
    }

    await this.userRepository.update({
      id: input.userId,
      activeCompanyId: input.companyId,
    });

    return { companyId: input.companyId };
  }
}

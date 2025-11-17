import { UserRepository } from "@domain/repositories/users/user.repository";
import { HashingService } from "@application/ports/hashing.service";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

export interface LoginInput {
  email: string;
  password: string;
}

export class LoginUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly hashingService: HashingService,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(LoginUseCase.name, configService);
  }

  async execute(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      this.logger.default(`Login failed: user not found - email: ${email}`);
      throw new ApplicationError(ErrorCode.INVALID_CREDENTIALS);
    }

    const passwordMatches = await this.hashingService.compare(
      input.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      this.logger.default(
        `Login failed: invalid password - user: ${user.id}, email: ${email}`,
      );
      throw new ApplicationError(ErrorCode.INVALID_CREDENTIALS);
    }

    return { user };
  }
}

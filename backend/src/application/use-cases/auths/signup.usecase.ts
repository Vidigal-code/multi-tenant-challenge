import { UserRepository } from "@domain/repositories/users/user.repository";
import { HashingService } from "@application/ports/hashing.service";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

export interface SignupInput {
  email: string;
  name: string;
  password: string;
}

export class SignupUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly hashingService: HashingService,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(SignupUseCase.name, configService);
  }

  async execute(input: SignupInput) {
    const email = input.email.trim().toLowerCase();

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      this.logger.default(
        `Signup failed: email already in use - email: ${email}`,
      );
      throw new ApplicationError(ErrorCode.EMAIL_ALREADY_USED);
    }

    const passwordHash = await this.hashingService.hash(input.password);
    const user = await this.userRepository.create({
      email,
      name: input.name,
      passwordHash,
    });

    return { user };
  }
}

import {UserRepository} from "@domain/repositories/users/user.repository";
import {HashingService} from "@application/ports/hashing.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

export interface LoginInput {
    email: string;
    password: string;
}

export class LoginUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly hashingService: HashingService,
    ) {
    }

    async execute(input: LoginInput) {
        const email = input.email.trim().toLowerCase();
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new ApplicationError(ErrorCode.INVALID_CREDENTIALS);
        }

        const passwordMatches = await this.hashingService.compare(
            input.password,
            user.passwordHash,
        );
        if (!passwordMatches) {
            throw new ApplicationError(ErrorCode.INVALID_CREDENTIALS);
        }

        return {user};
    }
}

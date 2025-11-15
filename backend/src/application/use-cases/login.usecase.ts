import {UserRepository} from "@domain/repositories/user.repository";
import {HashingService} from "@application/ports/hashing.service";
import {ApplicationError} from "@application/errors/application-error";

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
            throw new ApplicationError("INVALID_CREDENTIALS");
        }

        const passwordMatches = await this.hashingService.compare(
            input.password,
            user.passwordHash,
        );
        if (!passwordMatches) {
            throw new ApplicationError("INVALID_CREDENTIALS");
        }

        return {user};
    }
}

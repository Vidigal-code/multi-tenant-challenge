import {UserRepository} from "@domain/repositories/user.repository";
import {HashingService} from "@application/ports/hashing.service";
import {ApplicationError} from "@application/errors/application-error";

export interface SignupInput {
    email: string;
    name: string;
    password: string;
}

export class SignupUseCase {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly hashingService: HashingService,
    ) {
    }

    async execute(input: SignupInput) {
        const email = input.email.trim().toLowerCase();

        const existing = await this.userRepository.findByEmail(email);
        if (existing) {
            throw new ApplicationError("EMAIL_ALREADY_USED");
        }

        const passwordHash = await this.hashingService.hash(input.password);
        const user = await this.userRepository.create({
            email,
            name: input.name,
            passwordHash,
        });

        return {user};
    }
}

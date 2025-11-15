import {Inject, Injectable} from '@nestjs/common';
import {USER_REPOSITORY, UserRepository} from '@domain/repositories/user.repository';

export interface SearchUsersInput {
    query: string;
    currentUserId: string;
}

export interface SearchUsersOutput {
    id: string;
    name: string;
    email: string;
}

@Injectable()
export class SearchUsersUseCase {
    constructor(@Inject(USER_REPOSITORY) private readonly userRepo: UserRepository) {
    }

    async execute(input: SearchUsersInput): Promise<SearchUsersOutput[]> {
        const users = await this.userRepo.searchByNameOrEmail(input.query, input.currentUserId);
        return users.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email.toString(),
        }));
    }
}
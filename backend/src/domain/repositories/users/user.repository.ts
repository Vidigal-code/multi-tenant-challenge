import {User} from "@domain/entities/users/user.entity";

export interface CreateUserInput {
    email: string;
    name: string;
    passwordHash: string;
}

export interface UpdateUserInput {
    id: string;
    activeCompanyId?: string | null;
    name?: string;
    email?: string;
    passwordHash?: string;
    notificationPreferences?: Record<string, any>;
}

export interface UserRepository {
    create(data: CreateUserInput): Promise<User>;

    findByEmail(email: string): Promise<User | null>;

    findById(id: string): Promise<User | null>;

    update(data: UpdateUserInput): Promise<User>;

    deleteById(id: string): Promise<void>;

    searchByNameOrEmail(query: string, excludeUserId: string): Promise<User[]>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");

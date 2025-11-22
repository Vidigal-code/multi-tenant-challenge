import {Injectable} from "@nestjs/common";
import {Prisma} from "@prisma/client";
import {PrismaService} from "../services/prisma.service";
import {CreateUserInput, UpdateUserInput, USER_REPOSITORY, UserRepository,} from "@domain/repositories/users/user.repository";
import {User} from "@domain/entities/users/user.entity";
import {Email} from "@domain/value-objects/email.vo";

@Injectable()
export class UserPrismaRepository implements UserRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async create(data: CreateUserInput): Promise<User> {
        const user = await this.prisma.user.create({
            data,
            include: {memberships: true},
        });
        return this.toDomain(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: {email},
            include: {memberships: true},
        });
        return user ? this.toDomain(user) : null;
    }

    async findById(id: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: {id},
            include: {memberships: true},
        });
        return user ? this.toDomain(user) : null;
    }

    async findManyByIds(ids: string[]): Promise<User[]> {
        if (!ids.length) {
            return [];
        }

        const uniqueIds = Array.from(new Set(ids));
        const users = await this.prisma.user.findMany({
            where: {id: {in: uniqueIds}},
            include: {memberships: true},
        });

        return users.map((user) => this.toDomain(user));
    }

    async update(data: UpdateUserInput): Promise<User> {
        const updateData: any = {};
        
        if (data.activeCompanyId !== undefined) {
            updateData.activeCompanyId = data.activeCompanyId;
        }
        if (data.name !== undefined) {
            updateData.name = data.name;
        }
        if (data.email !== undefined) {
            updateData.email = data.email;
        }
        if (data.passwordHash !== undefined) {
            updateData.passwordHash = data.passwordHash;
        }
        if (data.notificationPreferences !== undefined) {
            updateData.notificationPreferences = data.notificationPreferences;
        }

        const user = await this.prisma.user.update({
            where: {id: data.id},
            data: updateData,
            include: {memberships: true},
        });
        
        return this.toDomain(user);
    }

    async deleteById(id: string): Promise<void> {
        await this.prisma.user.delete({where: {id}});
    }

    async searchByNameOrEmail(query: string, excludeUserId: string): Promise<User[]> {
        const users = await this.prisma.user.findMany({
            where: {
                AND: [
                    {id: {not: excludeUserId}},
                    {
                        OR: [
                            {name: {contains: query, mode: 'insensitive'}},
                            {email: {contains: query, mode: 'insensitive'}},
                        ],
                    },
                ],
            },
            include: {memberships: true},
            take: 20,
        });
        return users.map(user => this.toDomain(user));
    }

    async searchByNameOrEmailCursor(query: string, excludeUserId: string, cursor: string | undefined, limit: number): Promise<User[]> {
        const findArgs: any = {
            where: {
                AND: [
                    {id: {not: excludeUserId}},
                    {
                        OR: [
                            {name: {contains: query, mode: 'insensitive'}},
                            {email: {contains: query, mode: 'insensitive'}},
                        ],
                    },
                ],
            },
            include: {memberships: true},
            take: limit,
            orderBy: {id: 'asc'},
        };

        if (cursor) {
            findArgs.cursor = {id: cursor};
            findArgs.skip = 1;
        }

        const users = await this.prisma.user.findMany(findArgs);
        return users.map(user => this.toDomain(user));
    }

    private toDomain(
        record: Prisma.UserGetPayload<{ include: { memberships: true } }> | (Prisma.UserGetPayload<any> & { memberships?: any[] }),
    ): User {
        return User.create({
            id: record.id,
            email: Email.create(record.email),
            name: record.name,
            passwordHash: record.passwordHash,
            activeCompanyId: record.activeCompanyId,
            notificationPreferences: (record as any).notificationPreferences ?? {},
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}

export const userRepositoryProvider = {
    provide: USER_REPOSITORY,
    useClass: UserPrismaRepository,
};

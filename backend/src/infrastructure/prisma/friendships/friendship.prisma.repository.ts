import {Injectable} from "@nestjs/common";
import {PrismaService} from "../services/prisma.service";
import {
    CreateFriendshipInput,
    FRIENDSHIP_REPOSITORY,
    FriendshipFilters,
    FriendshipListResult,
    FriendshipRepository,
} from "@domain/repositories/friendships/friendship.repository";
import {Friendship, FriendshipStatus} from "@domain/entities/friendships/friendship.entity";

@Injectable()
export class FriendshipPrismaRepository implements FriendshipRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async create(input: CreateFriendshipInput): Promise<Friendship> {
        const created = await this.prisma.friendship.create({
            data: {
                requesterId: input.requesterId,
                addresseeId: input.addresseeId,
                status: FriendshipStatus.PENDING,
            },
        });
        return this.toDomain(created);
    }

    async findById(id: string): Promise<Friendship | null> {
        const record = await this.prisma.friendship.findUnique({
            where: {id},
        });
        return record ? this.toDomain(record) : null;
    }

    async findByUsers(requesterId: string, addresseeId: string): Promise<Friendship | null> {
        const record = await this.prisma.friendship.findUnique({
            where: {
                requesterId_addresseeId: {
                    requesterId,
                    addresseeId,
                },
            },
        });
        return record ? this.toDomain(record) : null;
    }

    async listByUser(filters: FriendshipFilters): Promise<FriendshipListResult> {
        const {userId, status, page, pageSize} = filters;
        const skip = (page - 1) * pageSize;

        const where = {
            OR: [
                {requesterId: userId},
                {addresseeId: userId},
            ],
            ...(status && {status}),
        };

        const [records, total] = await this.prisma.$transaction([
            this.prisma.friendship.findMany({
                where,
                orderBy: {createdAt: "desc"},
                skip,
                take: pageSize,
                include: {
                    requester: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    addressee: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            }),
            this.prisma.friendship.count({where}),
        ]);

        return {
            data: records.map(r => this.toDomainWithUsers(r)),
            total,
            page,
            pageSize,
            recordsWithUsers: records,
        };
    }

    async listByUserCursor(params: { userId: string; status?: FriendshipStatus; cursor?: string; limit: number }): Promise<Friendship[]> {
        const {userId, status, cursor, limit} = params;
        const where: any = {
            OR: [
                {requesterId: userId},
                {addresseeId: userId},
            ],
        };
        if (status) {
            where.status = status;
        }

        const findArgs: any = {
            where,
            include: {
                requester: {
                    select: {id: true, name: true, email: true},
                },
                addressee: {
                    select: {id: true, name: true, email: true},
                },
            },
            orderBy: {id: "desc"},
            take: limit,
        };

        if (cursor) {
            findArgs.cursor = {id: cursor};
            findArgs.skip = 1;
        }

        const records = await this.prisma.friendship.findMany(findArgs);
        return records.map(r => this.toDomainWithUsers(r));
    }

    async updateStatus(id: string, status: FriendshipStatus): Promise<Friendship> {
        const updated = await this.prisma.friendship.update({
            where: {id},
            data: {status, updatedAt: new Date()},
        });
        return this.toDomain(updated);
    }

    async delete(id: string): Promise<void> {
        await this.prisma.friendship.delete({where: {id}});
    }

    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    {requesterId: userId1, addresseeId: userId2},
                    {requesterId: userId2, addresseeId: userId1},
                ],
                status: FriendshipStatus.ACCEPTED,
            },
        });
        return !!friendship;
    }

    private toDomain(record: any): Friendship {
        return Friendship.create({
            id: record.id,
            requesterId: record.requesterId,
            addresseeId: record.addresseeId,
            status: record.status,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }

    private toDomainWithUsers(record: any): Friendship {
        // This method attaches user data to the friendship object via a hack or extends the entity
        // For now, we'll return the standard entity, but the repository also returns raw records for controllers
        return this.toDomain(record);
    }
}

export const friendshipRepositoryProvider = {
    provide: FRIENDSHIP_REPOSITORY,
    useClass: FriendshipPrismaRepository,
};
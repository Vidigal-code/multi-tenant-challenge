import {Injectable} from "@nestjs/common";
import {PrismaService} from "./prisma.service";
import {
    CreateFriendshipInput,
    FRIENDSHIP_REPOSITORY,
    FriendshipFilters,
    FriendshipListResult,
    FriendshipRepository,
} from "@domain/repositories/friendship.repository";
import {Friendship, FriendshipStatus} from "@domain/entities/friendship.entity";

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
            data: records.map(r => this.toDomain(r)),
            total,
            page,
            pageSize,
            recordsWithUsers: records,
        };
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
}

export const friendshipRepositoryProvider = {
    provide: FRIENDSHIP_REPOSITORY,
    useClass: FriendshipPrismaRepository,
};
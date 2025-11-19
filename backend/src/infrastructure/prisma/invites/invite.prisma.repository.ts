import {Injectable} from "@nestjs/common";
import {PrismaService} from "../services/prisma.service";
import {
    CreateInviteInput,
    INVITE_REPOSITORY,
    InviteCursorPage,
    InviteListCursor,
    InviteRepository,
} from "@domain/repositories/invites/invite.repository";
import {Invite} from "@domain/entities/invites/invite.entity";
import {Role} from "@domain/enums/role.enum";
import {InviteStatus} from "@domain/enums/invite-status.enum";
import {Email} from "@domain/value-objects/email.vo";

@Injectable()
export class InvitePrismaRepository implements InviteRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async findById(id: string): Promise<Invite | null> {
        const record = await this.prisma.invite.findUnique({where: {id}});
        return record ? this.toDomain(record) : null;
    }

    async createOrReuse(data: CreateInviteInput): Promise<Invite> {
        const existing = await this.prisma.invite.findFirst({
            where: {
                companyId: data.companyId,
                email: data.email,
                status: InviteStatus.PENDING,
            },
            orderBy: {createdAt: "desc"},
        });

        if (existing && existing.expiresAt > new Date()) {
            return this.toDomain(existing);
        }

        if (existing) {
            await this.prisma.invite.updateMany({
                where: {
                    companyId: data.companyId,
                    email: data.email,
                    status: InviteStatus.PENDING,
                },
                data: {status: InviteStatus.CANCELED},
            });
        }

        const createData: any = {
            companyId: data.companyId,
            email: data.email,
            token: data.token,
            role: data.role,
            expiresAt: data.expiresAt,
        };
        if (data.inviterId) createData.inviterId = data.inviterId;
        const invite = await this.prisma.invite.create({
            data: createData,
        });

        return this.toDomain(invite);
    }

    async findByToken(token: string): Promise<Invite | null> {
        const invite = await this.prisma.invite.findUnique({
            where: {token},
        });
        return invite ? this.toDomain(invite) : null;
    }

    async markAccepted(inviteId: string, userId: string): Promise<void> {
        await this.prisma.invite.update({
            where: {id: inviteId},
            data: {
                status: InviteStatus.ACCEPTED,
                acceptedById: userId,
            },
        });
    }

    async markExpired(inviteId: string): Promise<void> {
        await this.prisma.invite.update({
            where: {id: inviteId},
            data: {
                status: InviteStatus.EXPIRED,
            },
        });
    }

    async updateStatus(inviteId: string, status: InviteStatus): Promise<void> {
        await this.prisma.invite.update({
            where: {id: inviteId},
            data: {status: status as any},
        });
    }

    async expireInvitesForEmail(companyId: string, email: string): Promise<void> {
        await this.prisma.invite.updateMany({
            where: {
                companyId,
                email,
                status: InviteStatus.PENDING,
            },
            data: {
                status: InviteStatus.CANCELED,
            },
        });
    }

    async listByEmail(email: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }> {
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.invite.findMany({
                where: {email},
                orderBy: {createdAt: "desc"},
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.invite.count({where: {email}}),
        ]);
        return {data: rows.map((r) => this.toDomain(r)), total};
    }

    async listByInviter(inviterId: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }> {
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.invite.findMany({
                where: {inviterId},
                orderBy: {createdAt: "desc"},
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.invite.count({where: {inviterId}}),
        ]);
        return {data: rows.map((r) => this.toDomain(r)), total};
    }

    async listByEmailCursor(params: { email: string; cursor?: InviteListCursor; limit: number }): Promise<InviteCursorPage> {
        const {email, cursor, limit} = params;
        const rows = await this.prisma.invite.findMany({
            where: {email},
            orderBy: [{createdAt: "desc"}, {id: "desc"}],
            take: limit + 1,
            ...(cursor ? {cursor: {id: cursor.id}, skip: 1} : {}),
        });
        return this.buildCursorResponse(rows, limit);
    }

    async listByInviterCursor(params: { inviterId: string; cursor?: InviteListCursor; limit: number }): Promise<InviteCursorPage> {
        const {inviterId, cursor, limit} = params;
        const rows = await this.prisma.invite.findMany({
            where: {inviterId},
            orderBy: [{createdAt: "desc"}, {id: "desc"}],
            take: limit + 1,
            ...(cursor ? {cursor: {id: cursor.id}, skip: 1} : {}),
        });
        return this.buildCursorResponse(rows, limit);
    }

    async delete(inviteId: string): Promise<void> {
        await this.prisma.invite.delete({where: {id: inviteId}});
    }

    async deleteMany(inviteIds: string[]): Promise<number> {
        if (!inviteIds.length) return 0;
        const result = await this.prisma.invite.deleteMany({
            where: {id: {in: inviteIds}},
        });
        return result.count;
    }

    async updateStatusBulk(inviteIds: string[], status: InviteStatus): Promise<number> {
        if (!inviteIds.length) return 0;
        const result = await this.prisma.invite.updateMany({
            where: {id: {in: inviteIds}},
            data: {status},
        });
        return result.count;
    }

    private buildCursorResponse(records: any[], limit: number): InviteCursorPage {
        if (!records.length) {
            return {data: []};
        }
        const hasMore = records.length > limit;
        const slice = hasMore ? records.slice(0, limit) : records;
        const nextCursor = hasMore ? {id: slice[slice.length - 1].id} : undefined;
        return {
            data: slice.map((r) => this.toDomain(r)),
            nextCursor,
        };
    }

    private toDomain(record: any): Invite {
        return Invite.create({
            id: record.id,
            companyId: record.companyId,
            email: Email.create(record.email),
            token: record.token,
            role: record.role as Role,
            status: record.status as InviteStatus,
            expiresAt: record.expiresAt,
            createdAt: record.createdAt,
            acceptedById: record.acceptedById,
            inviterId: record.inviterId,
        });
    }
}

export const inviteRepositoryProvider = {
    provide: INVITE_REPOSITORY,
    useClass: InvitePrismaRepository,
};

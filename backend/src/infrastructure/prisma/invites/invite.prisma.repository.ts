import { Injectable } from "@nestjs/common";
import { PrismaService } from "../services/prisma.service";
import {
  CreateInviteInput,
  INVITE_REPOSITORY,
  InviteRepository,
} from "@domain/repositories/invites/invite.repository";
import { Invite } from "@domain/entities/invites/invite.entity";
import { Role } from "@domain/enums/role.enum";
import { InviteStatus } from "@domain/enums/invite-status.enum";
import { Email } from "@domain/value-objects/email.vo";

@Injectable()
export class InvitePrismaRepository implements InviteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Invite | null> {
    const record = await this.prisma.invite.findUnique({ where: { id } });
    return record ? this.toDomain(record) : null;
  }

  async createOrReuse(data: CreateInviteInput): Promise<Invite> {
    const existing = await this.prisma.invite.findFirst({
      where: {
        companyId: data.companyId,
        email: data.email,
        status: InviteStatus.PENDING,
      },
      orderBy: { createdAt: "desc" },
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
        data: { status: InviteStatus.CANCELED },
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
      where: { token },
    });
    return invite ? this.toDomain(invite) : null;
  }

  async markAccepted(inviteId: string, userId: string): Promise<void> {
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: {
        status: InviteStatus.ACCEPTED,
        acceptedById: userId,
      },
    });
  }

  async markExpired(inviteId: string): Promise<void> {
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: {
        status: InviteStatus.EXPIRED,
      },
    });
  }

  async updateStatus(inviteId: string, status: InviteStatus): Promise<void> {
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: status as any },
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

  async listByEmail(
    email: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: Invite[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invite.findMany({
        where: { email },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invite.count({ where: { email } }),
    ]);
    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async listByInviter(
    inviterId: string,
    page: number,
    pageSize: number,
  ): Promise<{ data: Invite[]; total: number }> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invite.findMany({
        where: { inviterId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.invite.count({ where: { inviterId } }),
    ]);
    return { data: rows.map((r) => this.toDomain(r)), total };
  }

  async delete(inviteId: string): Promise<void> {
    await this.prisma.invite.delete({ where: { id: inviteId } });
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

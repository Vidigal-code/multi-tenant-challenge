import { Injectable } from "@nestjs/common";
import { PrismaService } from "../services/prisma.service";
import {
  CreateMembershipInput,
  MEMBERSHIP_REPOSITORY,
  MembershipRepository,
} from "@domain/repositories/memberships/membership.repository";
import { Membership } from "@domain/entities/memberships/membership.entity";
import { Role } from "@domain/enums/role.enum";

@Injectable()
export class MembershipPrismaRepository implements MembershipRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMembershipInput): Promise<Membership> {
    const membership = await this.prisma.membership.create({
      data,
    });
    return this.toDomain(membership);
  }

  async findByUserAndCompany(
    userId: string,
    companyId: string,
  ): Promise<Membership | null> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return membership ? this.toDomain(membership) : null;
  }

  async listByCompany(companyId: string): Promise<Membership[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((membership: any) => this.toDomain(membership));
  }

  async listByUser(userId: string): Promise<Membership[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m: any) => this.toDomain(m));
  }

  async countByCompanyAndRole(companyId: string, role: Role): Promise<number> {
    return this.prisma.membership.count({
      where: { companyId, role },
    });
  }

  async updateRole(id: string, role: Role): Promise<void> {
    await this.prisma.membership.update({
      where: { id },
      data: { role },
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.membership.delete({
      where: { id },
    });
  }

  private toDomain(record: any): Membership {
    return Membership.create({
      id: record.id,
      userId: record.userId,
      companyId: record.companyId,
      role: record.role as Role,
      createdAt: record.createdAt,
    });
  }
}

export const membershipRepositoryProvider = {
  provide: MEMBERSHIP_REPOSITORY,
  useClass: MembershipPrismaRepository,
};

import { MembershipRepository } from "@domain/repositories/memberships/membership.repository";
import { CompanyRepository } from "@domain/repositories/companys/company.repository";
import { UserRepository } from "@domain/repositories/users/user.repository";
import { Role } from "@domain/enums/role.enum";

export interface ListPrimaryOwnerCompaniesInput {
  userId: string;
  page: number;
  pageSize: number;
}

export interface PrimaryOwnerCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  isPublic: boolean;
  createdAt: Date;
  memberCount: number;
  primaryOwnerName: string;
  primaryOwnerEmail: string;
}

export interface ListPrimaryOwnerCompaniesResult {
  data: PrimaryOwnerCompany[];
  total: number;
  page: number;
  pageSize: number;
}

export class ListPrimaryOwnerCompaniesUseCase {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly companies: CompanyRepository,
    private readonly users: UserRepository,
  ) {}

  async execute(
    input: ListPrimaryOwnerCompaniesInput,
  ): Promise<ListPrimaryOwnerCompaniesResult> {
    const userMemberships = await this.memberships.listByUser(input.userId);
    const ownerMemberships = userMemberships.filter(
      (m) => m.role === Role.OWNER,
    );

    const primaryOwnerCompanies: PrimaryOwnerCompany[] = [];

    for (const membership of ownerMemberships) {
      const allMemberships = await this.memberships.listByCompany(
        membership.companyId,
      );
      const ownerMembershipsForCompany = allMemberships.filter(
        (m) => m.role === Role.OWNER,
      );

      ownerMembershipsForCompany.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );

      const primaryOwner = ownerMembershipsForCompany[0];
      if (primaryOwner && primaryOwner.userId === input.userId) {
        const company = await this.companies.findById(membership.companyId);
        if (company) {
          const memberCount = allMemberships.length;
          const primaryOwnerUser = await this.users.findById(
            primaryOwner.userId,
          );

          primaryOwnerCompanies.push({
            id: company.id,
            name: company.name,
            logoUrl: company.logoUrl,
            description: company.description,
            isPublic: company.isPublic,
            createdAt: primaryOwner.createdAt,
            memberCount,
            primaryOwnerName: primaryOwnerUser?.name ?? "N/A",
            primaryOwnerEmail: primaryOwnerUser?.email?.toString() ?? "N/A",
          });
        }
      }
    }

    primaryOwnerCompanies.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const skip = (input.page - 1) * input.pageSize;
    const paginatedData = primaryOwnerCompanies.slice(
      skip,
      skip + input.pageSize,
    );

    return {
      data: paginatedData,
      total: primaryOwnerCompanies.length,
      page: input.page,
      pageSize: input.pageSize,
    };
  }
}

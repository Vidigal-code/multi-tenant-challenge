import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {Role} from "@domain/enums/role.enum";
import {Membership} from "@domain/entities/memberships/membership.entity";

export interface ListMemberCompaniesInput {
    userId: string;
    page: number;
    pageSize: number;
}

export interface MemberCompany {
    id: string;
    name: string;
    logoUrl?: string | null;
    description?: string | null;
    isPublic: boolean;
    createdAt: Date;
    memberCount: number;
    userRole: Role;
    primaryOwnerName: string;
    primaryOwnerEmail: string;
}

export interface ListMemberCompaniesResult {
    data: MemberCompany[];
    total: number;
    page: number;
    pageSize: number;
}

export class ListMemberCompaniesUseCase {
    constructor(
        private readonly memberships: MembershipRepository,
        private readonly companies: CompanyRepository,
        private readonly users: UserRepository,
    ) {
    }

    async execute(input: ListMemberCompaniesInput): Promise<ListMemberCompaniesResult> {
        const userMemberships = await this.memberships.listByUser(input.userId);
        if (!userMemberships.length) {
            return {
                data: [],
                total: 0,
                page: input.page,
                pageSize: input.pageSize,
            };
        }

        const companyIds = Array.from(new Set(userMemberships.map((membership) => membership.companyId)));
        const companies = await this.companies.findManyByIds(companyIds);
        const companyMap = new Map(companies.map((company) => [company.id, company]));

        const primaryOwnerMap = new Map<string, Membership>();
        const primaryOwnerIds = new Set<string>();

        for (const company of companies) {
            const ownerMemberships = [...company.owners()].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );

            if (!ownerMemberships.length) {
                continue;
            }

            const primaryOwner = ownerMemberships[0];
            primaryOwnerMap.set(company.id, primaryOwner);
            primaryOwnerIds.add(primaryOwner.userId);
        }

        const primaryOwnerUsers = await this.users.findManyByIds(Array.from(primaryOwnerIds));
        const primaryOwnerUserMap = new Map(primaryOwnerUsers.map((user) => [user.id, user]));

        const primaryOwnerCompanyIds = new Set(
            Array.from(primaryOwnerMap.entries())
                .filter(([, membership]) => membership.userId === input.userId)
                .map(([companyId]) => companyId),
        );

        const memberCompanies: MemberCompany[] = [];

        for (const membership of userMemberships) {
            if (primaryOwnerCompanyIds.has(membership.companyId)) {
                continue;
            }

            const company = companyMap.get(membership.companyId);
            if (!company) {
                continue;
            }

            const primaryOwnerMembership = primaryOwnerMap.get(company.id);
            const primaryOwnerUser = primaryOwnerMembership
                ? primaryOwnerUserMap.get(primaryOwnerMembership.userId)
                : undefined;

            memberCompanies.push({
                id: company.id,
                name: company.name,
                logoUrl: company.logoUrl,
                description: company.description,
                isPublic: company.isPublic,
                createdAt: company.createdAt,
                memberCount: company.memberships.length,
                userRole: membership.role,
                primaryOwnerName: primaryOwnerUser?.name ?? "N/A",
                primaryOwnerEmail: primaryOwnerUser?.email?.toString() ?? "N/A",
            });
        }

        memberCompanies.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

        const skip = (input.page - 1) * input.pageSize;
        const paginatedData = memberCompanies.slice(skip, skip + input.pageSize);

        return {
            data: paginatedData,
            total: memberCompanies.length,
            page: input.page,
            pageSize: input.pageSize,
        };
    }
}


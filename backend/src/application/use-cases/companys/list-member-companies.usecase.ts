import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {UserRepository} from "@domain/repositories/users/user.repository";
import {Role} from "@domain/enums/role.enum";

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
        
        // Get all companies where user is member (excluding primary owner companies)
        const memberCompanies: MemberCompany[] = [];
        const primaryOwnerCompanyIds = new Set<string>();

        // First, identify primary owner companies
        const ownerMemberships = userMemberships.filter(m => m.role === Role.OWNER);
        for (const membership of ownerMemberships) {
            const allMemberships = await this.memberships.listByCompany(membership.companyId);
            const ownerMembershipsForCompany = allMemberships.filter(m => m.role === Role.OWNER);
            
            ownerMembershipsForCompany.sort((a, b) =>
                a.createdAt.getTime() - b.createdAt.getTime()
            );

            const primaryOwner = ownerMembershipsForCompany[0];
            if (primaryOwner && primaryOwner.userId === input.userId) {
                primaryOwnerCompanyIds.add(membership.companyId);
            }
        }

        // Now get member companies (excluding primary owner companies)
        for (const membership of userMemberships) {
            if (primaryOwnerCompanyIds.has(membership.companyId)) {
                continue; // Skip primary owner companies
            }

            const company = await this.companies.findById(membership.companyId);
            if (company) {
                const allMemberships = await this.memberships.listByCompany(membership.companyId);
                const memberCount = allMemberships.length;
                
                // Get primary owner info
                const ownerMembershipsForCompany = allMemberships.filter(m => m.role === Role.OWNER);
                ownerMembershipsForCompany.sort((a, b) =>
                    a.createdAt.getTime() - b.createdAt.getTime()
                );
                const primaryOwner = ownerMembershipsForCompany[0];
                const primaryOwnerUser = primaryOwner ? await this.users.findById(primaryOwner.userId) : null;
                
                memberCompanies.push({
                    id: company.id,
                    name: company.name,
                    logoUrl: company.logoUrl,
                    description: company.description,
                    isPublic: company.isPublic,
                    createdAt: company.createdAt instanceof Date ? company.createdAt : new Date(company.createdAt),
                    memberCount,
                    userRole: membership.role,
                    primaryOwnerName: primaryOwnerUser?.name ?? 'N/A',
                    primaryOwnerEmail: primaryOwnerUser?.email?.toString() ?? 'N/A',
                });
            }
        }

        memberCompanies.sort((a, b) =>
            a.createdAt.getTime() - b.createdAt.getTime()
        );

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


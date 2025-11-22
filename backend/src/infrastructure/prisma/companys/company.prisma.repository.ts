import {Injectable} from "@nestjs/common";
import {PrismaService} from "../services/prisma.service";
import {
    COMPANY_REPOSITORY,
    CompanyRepository,
    CreateCompanyInput,
    ListCompaniesFilters,
    ListPublicCompaniesFilters,
    PaginatedCompanies,
    UpdateCompanyInput,
} from "@domain/repositories/companys/company.repository";
import {Company} from "@domain/entities/companys/company.entity";
import {Membership} from "@domain/entities/memberships/membership.entity";
import {Role} from "@domain/enums/role.enum";

@Injectable()
export class CompanyPrismaRepository implements CompanyRepository {
    constructor(private readonly prisma: PrismaService) {
    }

    async create(data: CreateCompanyInput): Promise<Company> {
        const company = await this.prisma.company.create({
            data: {
                name: data.name,
                logoUrl: data.logoUrl,
                description: data.description,
                isPublic: data.isPublic ?? false,
            },
        });
        return this.toDomain(company);
    }

    async findById(id: string): Promise<Company | null> {
        const company = await this.prisma.company.findUnique({
            where: {id},
            include: {memberships: true},
        });
        return company ? this.toDomain(company) : null;
    }

    async findManyByIds(ids: string[]): Promise<Company[]> {
        if (!ids.length) {
            return [];
        }

        const uniqueIds = Array.from(new Set(ids));
        const companies = await this.prisma.company.findMany({
            where: {id: {in: uniqueIds}},
            include: {memberships: true},
        });

        return companies.map((company: any) => this.toDomain(company));
    }

    async listByUser(filters: ListCompaniesFilters): Promise<PaginatedCompanies> {
        const {page, pageSize, userId} = filters;
        const skip = (page - 1) * pageSize;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.company.findMany({
                skip,
                take: pageSize,
                where: {
                    memberships: {
                        some: {
                            userId,
                        },
                    },
                },
                orderBy: {createdAt: "desc"},
                include: {memberships: true},
            }),
            this.prisma.company.count({
                where: {
                    memberships: {
                        some: {userId},
                    },
                },
            }),
        ]);

        return {
            data: data.map((company: any) => this.toDomain(company)),
            total,
            page,
            pageSize,
        };
    }

    async listPublic(filters: ListPublicCompaniesFilters): Promise<PaginatedCompanies> {
        const {page, pageSize} = filters;
        const skip = (page - 1) * pageSize;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.company.findMany({
                skip,
                take: pageSize,
                where: {
                    isPublic: true,
                },
                orderBy: {createdAt: "desc"},
                include: {memberships: true},
            }),
            this.prisma.company.count({
                where: {
                    isPublic: true,
                },
            }),
        ]);

        return {
            data: data.map((company: any) => this.toDomain(company)),
            total,
            page,
            pageSize,
        };
    }

    async update(data: UpdateCompanyInput): Promise<Company> {
        const updateData: any = {};
        if (data.name !== undefined) {
            updateData.name = data.name;
        }
        if (data.logoUrl !== undefined) {
            updateData.logoUrl = data.logoUrl;
        }
        if (data.description !== undefined) {
            updateData.description = data.description;
        }
        if (data.isPublic !== undefined) {
            updateData.isPublic = data.isPublic;
        }
        
        const updated = await this.prisma.company.update({
            where: {id: data.id},
            data: updateData,
            include: {memberships: true},
        });
        return this.toDomain(updated);
    }

    async delete(id: string): Promise<void> {
        await this.prisma.company.delete({where: {id}});
    }

    private membershipToDomain(record: {
        id: string;
        userId: string;
        companyId: string;
        role: Role;
        createdAt: Date;
    }): Membership {
        return Membership.create({
            id: record.id,
            userId: record.userId,
            companyId: record.companyId,
            role: record.role as Role,
            createdAt: record.createdAt,
        });
    }

    private toDomain(record: any): Company {
        return Company.create({
            id: record.id,
            name: record.name,
            logoUrl: record.logoUrl,
            description: record.description,
            isPublic: record.isPublic,
            memberships: (record.memberships ?? []).map((membership: any) =>
                this.membershipToDomain(membership),
            ),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}

export const companyRepositoryProvider = {
    provide: COMPANY_REPOSITORY,
    useClass: CompanyPrismaRepository,
};

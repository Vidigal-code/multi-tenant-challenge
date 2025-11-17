import { Company } from "@domain/entities/companys/company.entity";

export interface CreateCompanyInput {
  name: string;
  logoUrl?: string | null;
  ownerId: string;
  description?: string | null;
  isPublic?: boolean;
}

export interface ListCompaniesFilters {
  userId: string;
  page: number;
  pageSize: number;
}

export interface PaginatedCompanies {
  data: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export interface UpdateCompanyInput {
  id: string;
  name?: string;
  logoUrl?: string | null;
  description?: string | null;
  isPublic?: boolean;
}

export interface ListPublicCompaniesFilters {
  page: number;
  pageSize: number;
}

export interface CompanyRepository {
  create(data: CreateCompanyInput): Promise<Company>;

  findById(id: string): Promise<Company | null>;

  listByUser(filters: ListCompaniesFilters): Promise<PaginatedCompanies>;

  listPublic(filters: ListPublicCompaniesFilters): Promise<PaginatedCompanies>;

  update(data: UpdateCompanyInput): Promise<Company>;

  delete(id: string): Promise<void>;
}

export const COMPANY_REPOSITORY = Symbol("COMPANY_REPOSITORY");

import { CompanyRepository } from "@domain/repositories/companys/company.repository";

export interface ListCompaniesInput {
  userId: string;
  page: number;
  pageSize: number;
}

export class ListCompaniesUseCase {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async execute(input: ListCompaniesInput) {
    const memberCompanies = await this.companyRepository.listByUser({
      userId: input.userId,
      page: input.page,
      pageSize: input.pageSize,
    });

    return {
      data: memberCompanies.data,
      total: memberCompanies.total,
      page: memberCompanies.page,
      pageSize: memberCompanies.pageSize,
    };
  }
}

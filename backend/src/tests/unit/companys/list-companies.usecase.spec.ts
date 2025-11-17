import { ListCompaniesUseCase } from "@application/use-cases/companys/list-companies.usecase";
import { InMemoryCompanyRepository } from "../../support/in-memory-repositories";

describe("ListCompaniesUseCase", () => {
  it("paginates companies for users", async () => {
    const companies = new InMemoryCompanyRepository();
    for (let i = 0; i < 15; i++) {
      await companies.create({
        ownerId: "owner-1",
        name: `Company-${i + 1}`,
        logoUrl: null,
      });
    }
    const usecase = new ListCompaniesUseCase(companies as any);
    const page1 = await usecase.execute({
      userId: "owner-1",
      page: 1,
      pageSize: 10,
    });
    const page2 = await usecase.execute({
      userId: "owner-1",
      page: 2,
      pageSize: 10,
    });

    expect(page1.data.length).toBe(10);
    expect(page1.total).toBe(15);
    expect(page2.data.length).toBe(5);
    expect(page2.page).toBe(2);
  });
});

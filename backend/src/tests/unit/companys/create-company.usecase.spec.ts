import { CreateCompanyUseCase } from "@application/use-cases/companys/create-company.usecase";
import {
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "../../support/in-memory-repositories";

describe("CreateCompanyUseCase", () => {
  it("creates companys and assigns owner memberships", async () => {
    const companyRepo = new InMemoryCompanyRepository();
    const userRepo = new InMemoryUserRepository();
    const membershipRepo = new InMemoryMembershipRepository();
    const owner = await userRepo.create({
      email: "o@a.com",
      name: "Owner",
      passwordHash: "hashed:x",
    });
    const usecase = new CreateCompanyUseCase(
      companyRepo as any,
      userRepo as any,
      membershipRepo as any,
    );
    const { company } = await usecase.execute({
      ownerId: owner.id,
      name: "MyCo",
      logoUrl: null,
    });
    expect(company.memberships.length).toBe(1);
    expect(company.memberships[0].userId).toBe(owner.id);
  });
});

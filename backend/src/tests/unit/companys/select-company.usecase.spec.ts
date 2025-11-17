import { SelectCompanyUseCase } from "@application/use-cases/companys/select-company.usecase";
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
} from "../../support/in-memory-repositories";
import { Role } from "@domain/enums/role.enum";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";

describe("SelectCompanyUseCase", () => {
  it("sets active companys when memberships exists", async () => {
    const memberships = new InMemoryMembershipRepository();
    const users = new InMemoryUserRepository();
    const user = await users.create({
      email: "u@a.com",
      name: "User",
      passwordHash: "h:u",
    });
    await memberships.create({
      userId: user.id,
      companyId: "c1",
      role: Role.MEMBER,
    });
    const usecase = new SelectCompanyUseCase(memberships as any, users as any);
    const res = await usecase.execute({ userId: user.id, companyId: "c1" });
    expect(res.companyId).toBe("c1");
  });

  it("throws when not member", async () => {
    const memberships = new InMemoryMembershipRepository();
    const users = new InMemoryUserRepository();
    const user = await users.create({
      email: "u@a.com",
      name: "User",
      passwordHash: "h:u",
    });
    const usecase = new SelectCompanyUseCase(memberships as any, users as any);
    const error = await usecase
      .execute({ userId: user.id, companyId: "c1" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe(ErrorCode.NOT_A_MEMBER);
  });
});

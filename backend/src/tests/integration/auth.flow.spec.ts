import {SelectCompanyUseCase} from "@application/use-cases/select-company.usecase";
import {InMemoryMembershipRepository, InMemoryUserRepository,} from "../support/in-memory-repositories";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

describe("Auth/Select Company Flow (integration pseudo)", () => {
    it("returns NOT_A_MEMBER when selecting company without membership", async () => {
        const memberships = new InMemoryMembershipRepository();
        const users = new InMemoryUserRepository();
        const user = await users.create({
            email: "user@test.com",
            name: "User",
            passwordHash: "h:pwd",
        });
        const usecase = new SelectCompanyUseCase(memberships as any, users as any);
        const error = await usecase.execute({userId: user.id, companyId: "non-member-company"}).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.NOT_A_MEMBER);
    });
});

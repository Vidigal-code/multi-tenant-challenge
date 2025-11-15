import {RemoveMemberUseCase} from "@application/use-cases/memberships/remove-member.usecase";
import {SelectCompanyUseCase} from "@application/use-cases/companys/select-company.usecase";
import {
    InMemoryCompanyRepository,
    InMemoryMembershipRepository,
    InMemoryUserRepository,
} from "../../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";

describe("Active companys cleanup", () => {
    it("clears activeCompanyId when a member with that active companys is removed", async () => {
        const memberships = new InMemoryMembershipRepository();
        const companies = new InMemoryCompanyRepository();
        const users = new InMemoryUserRepository();
        const owner = await users.create({
            email: "owner@a.com",
            name: "Owner",
            passwordHash: "h:owner",
        });
        const member = await users.create({
            email: "member@a.com",
            name: "Member",
            passwordHash: "h:member",
        });
        const company = await companies.create({
            ownerId: owner.id,
            name: "Co",
            logoUrl: null,
        });
        await memberships.create({userId: owner.id, companyId: company.id, role: Role.OWNER});
        await memberships.create({userId: member.id, companyId: company.id, role: Role.MEMBER});

        const selectUseCase = new SelectCompanyUseCase(memberships as any, users as any);
        await selectUseCase.execute({userId: member.id, companyId: company.id});
        const before = await users.findById(member.id);
        expect(before?.activeCompanyId).toBe(company.id);

        const removeUseCase = new RemoveMemberUseCase(memberships as any, companies as any, users as any);
        await removeUseCase.execute({requesterId: owner.id, companyId: company.id, targetUserId: member.id});
        const after = await users.findById(member.id);
        expect(after?.activeCompanyId).toBeNull();
    });
});

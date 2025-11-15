import {InviteUserUseCase} from "@application/use-cases/invite-user.usecase";
import {
    AlwaysTrueEmailValidationService,
    FakeDomainEventsService,
    FixedInviteTokenService,
    InMemoryInviteRepository,
    InMemoryMembershipRepository,
    InMemoryUserRepository,
} from "../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

describe("InviteUserUseCase", () => {
    it("OWNER can invite MEMBER and reuse pending invite", async () => {
        const invites = new InMemoryInviteRepository();
        const memberships = new InMemoryMembershipRepository();
        const users = new InMemoryUserRepository();
        const tokenSvc = new FixedInviteTokenService();
        const usecase = new InviteUserUseCase(
            memberships as any,
            invites as any,
            users as any,
            tokenSvc as any,
            new FakeDomainEventsService() as any,
            new AlwaysTrueEmailValidationService() as any,
        );

        await memberships.create({
            userId: "owner",
            companyId: "c1",
            role: Role.OWNER,
        });

        const first = await usecase.execute({
            inviterUserId: "owner",
            companyId: "c1",
            email: "x@y.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        });
        const second = await usecase.execute({
            inviterUserId: "owner",
            companyId: "c1",
            email: "x@y.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        });

        expect(first.invite.id).toBe(second.invite.id);
    });

    it("MEMBER cannot invite", async () => {
        const invites = new InMemoryInviteRepository();
        const memberships = new InMemoryMembershipRepository();
        const users = new InMemoryUserRepository();
        const tokenSvc = new FixedInviteTokenService();
        const usecase = new InviteUserUseCase(
            memberships as any,
            invites as any,
            users as any,
            tokenSvc as any,
            new FakeDomainEventsService() as any,
            new AlwaysTrueEmailValidationService() as any,
        );
        await memberships.create({
            userId: "member1",
            companyId: "c1",
            role: Role.MEMBER,
        });
        const error = await usecase.execute({
            inviterUserId: "member1",
            companyId: "c1",
            email: "x@y.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        }).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.INSUFFICIENT_ROLE);
    });
});

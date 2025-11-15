import {AcceptInviteUseCase} from "@application/use-cases/memberships/accept-invite.usecase";
import {
    FakeHashingService,
    InMemoryInviteRepository,
    InMemoryMembershipRepository,
    InMemoryUserRepository,
} from "../../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

describe("AcceptInviteUseCase", () => {
    it("throws INVITE_EXPIRED and marks invites expired when invites is past expiry", async () => {
        const invites = new InMemoryInviteRepository();
        const memberships = new InMemoryMembershipRepository();
        const users = new InMemoryUserRepository();
        const hashing = new FakeHashingService();
        const usecase = new AcceptInviteUseCase(
            invites as any,
            memberships as any,
            users as any,
            hashing as any,
        );

        const expiredDate = new Date(Date.now() - 60_000);
        const invite = await invites.createOrReuse({
            companyId: "c1",
            email: "new@users.com",
            token: "expired-token",
            role: Role.MEMBER,
            expiresAt: expiredDate,
            inviterId: "owner-1",
        });

        expect(invite.isExpired()).toBe(true);

        const error = await usecase.execute({
            token: "expired-token",
            name: "New User",
            password: "secret",
        }).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.INVITE_EXPIRED);

        const stored = await invites.findByToken("expired-token");
        expect(stored?.status).toBe("EXPIRED");
    });
});

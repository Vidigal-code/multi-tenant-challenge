import {SignupUseCase} from "@application/use-cases/signup.usecase";
import {CreateCompanyUseCase} from "@application/use-cases/create-company.usecase";
import {InviteUserUseCase} from "@application/use-cases/invite-user.usecase";
import {AcceptInviteUseCase} from "@application/use-cases/accept-invite.usecase";
import {RejectInviteUseCase} from "@application/use-cases/reject-invite.usecase";
import {
    InMemoryCompanyRepository,
    InMemoryInviteRepository,
    InMemoryMembershipRepository,
    InMemoryUserRepository,
    FakeHashingService,
    FixedInviteTokenService,
    FakeDomainEventsService,
    AlwaysTrueEmailValidationService,
} from "../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";
import {InviteStatus} from "@domain/enums/invite-status.enum";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

describe("Invite Flow Integration", () => {
    let userRepo: InMemoryUserRepository;
    let companyRepo: InMemoryCompanyRepository;
    let membershipRepo: InMemoryMembershipRepository;
    let inviteRepo: InMemoryInviteRepository;
    let hashing: FakeHashingService;
    let tokenService: FixedInviteTokenService;
    let domainEvents: FakeDomainEventsService;
    let emailValidation: AlwaysTrueEmailValidationService;

    beforeEach(() => {
        userRepo = new InMemoryUserRepository();
        companyRepo = new InMemoryCompanyRepository();
        membershipRepo = new InMemoryMembershipRepository();
        inviteRepo = new InMemoryInviteRepository();
        hashing = new FakeHashingService();
        tokenService = new FixedInviteTokenService();
        domainEvents = new FakeDomainEventsService();
        emailValidation = new AlwaysTrueEmailValidationService();
    });

    it("complete flow: signup -> create company -> invite -> accept", async () => {
        const signup = new SignupUseCase(userRepo as any, hashing as any);
        const {user: owner} = await signup.execute({
            email: "owner@test.com",
            name: "Owner",
            password: "password123",
        });

        expect(owner.email.toString()).toBe("owner@test.com");

        const createCompany = new CreateCompanyUseCase(
            companyRepo as any,
            userRepo as any,
            membershipRepo as any,
        );

        const {company} = await createCompany.execute({
            ownerId: owner.id,
            name: "Test Company",
        });

        const inviteUser = new InviteUserUseCase(
            membershipRepo as any,
            inviteRepo as any,
            userRepo as any,
            tokenService as any,
            domainEvents as any,
            emailValidation as any,
        );

        const {invite} = await inviteUser.execute({
            inviterUserId: owner.id,
            companyId: company.id,
            email: "newuser@test.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        });

        expect(invite.status).toBe(InviteStatus.PENDING);
        expect(invite.email.toString()).toBe("newuser@test.com");

        const acceptInvite = new AcceptInviteUseCase(
            inviteRepo as any,
            membershipRepo as any,
            userRepo as any,
            hashing as any,
        );

        const result = await acceptInvite.execute({
            token: invite.token,
            name: "New User",
            password: "password123",
        });

        expect(result.user.name).toBe("New User");
        expect(result.user.email.toString()).toBe("newuser@test.com");

        const membership = await membershipRepo.findByUserAndCompany(result.user.id, company.id);
        expect(membership).toBeDefined();
        expect(membership?.role).toBe(Role.MEMBER);

        const acceptedInvite = await inviteRepo.findByToken(invite.token);
        expect(acceptedInvite?.status).toBe(InviteStatus.ACCEPTED);
        expect((acceptedInvite as any).props.acceptedById).toBe(result.user.id);
    });

    it("invite -> reject flow", async () => {
        const owner = await userRepo.create({
            email: "owner@test.com",
            name: "Owner",
            passwordHash: await hashing.hash("password123"),
        });

        const createCompany = new CreateCompanyUseCase(
            companyRepo as any,
            userRepo as any,
            membershipRepo as any,
        );

        const {company} = await createCompany.execute({
            ownerId: owner.id,
            name: "Test Company",
        });

        const recipient = await userRepo.create({
            email: "recipient@test.com",
            name: "Recipient",
            passwordHash: await hashing.hash("password123"),
        });

        const inviteUser = new InviteUserUseCase(
            membershipRepo as any,
            inviteRepo as any,
            userRepo as any,
            tokenService as any,
            domainEvents as any,
            emailValidation as any,
        );

        const {invite} = await inviteUser.execute({
            inviterUserId: owner.id,
            companyId: company.id,
            email: recipient.email.toString(),
            role: Role.MEMBER,
            expiresInDays: 7,
        });

        const rejectInvite = new RejectInviteUseCase(
            inviteRepo as any,
            domainEvents as any,
        );

        await rejectInvite.execute({
            inviteId: invite.token,
            userId: recipient.id,
        });

        const rejectedInvite = await inviteRepo.findByToken(invite.token);
        expect(rejectedInvite?.status).toBe(InviteStatus.REJECTED);

        const membership = await membershipRepo.findByUserAndCompany(recipient.id, company.id);
        expect(membership).toBeNull();
    });

    it("cannot invite existing member", async () => {
        const owner = await userRepo.create({
            email: "owner@test.com",
            name: "Owner",
            passwordHash: await hashing.hash("password123"),
        });

        const createCompany = new CreateCompanyUseCase(
            companyRepo as any,
            userRepo as any,
            membershipRepo as any,
        );

        const {company} = await createCompany.execute({
            ownerId: owner.id,
            name: "Test Company",
        });

        const member = await userRepo.create({
            email: "member@test.com",
            name: "Member",
            passwordHash: await hashing.hash("password123"),
        });

        await membershipRepo.create({
            userId: member.id,
            companyId: company.id,
            role: Role.MEMBER,
        });

        const inviteUser = new InviteUserUseCase(
            membershipRepo as any,
            inviteRepo as any,
            userRepo as any,
            tokenService as any,
            domainEvents as any,
            emailValidation as any,
        );

        const error = await inviteUser
            .execute({
                inviterUserId: owner.id,
                companyId: company.id,
                email: member.email.toString(),
                role: Role.MEMBER,
                expiresInDays: 7,
            })
            .catch((e) => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.CANNOT_INVITE_MEMBER);
    });

    it("reuses pending invite for same email and company", async () => {
        const owner = await userRepo.create({
            email: "owner@test.com",
            name: "Owner",
            passwordHash: await hashing.hash("password123"),
        });

        const createCompany = new CreateCompanyUseCase(
            companyRepo as any,
            userRepo as any,
            membershipRepo as any,
        );

        const {company} = await createCompany.execute({
            ownerId: owner.id,
            name: "Test Company",
        });

        const inviteUser = new InviteUserUseCase(
            membershipRepo as any,
            inviteRepo as any,
            userRepo as any,
            tokenService as any,
            domainEvents as any,
            emailValidation as any,
        );

        const {invite: firstInvite} = await inviteUser.execute({
            inviterUserId: owner.id,
            companyId: company.id,
            email: "user@test.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        });

        const {invite: secondInvite} = await inviteUser.execute({
            inviterUserId: owner.id,
            companyId: company.id,
            email: "user@test.com",
            role: Role.MEMBER,
            expiresInDays: 7,
        });

        expect(firstInvite.id).toBe(secondInvite.id);
    });
});


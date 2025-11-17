import { CreateCompanyUseCase } from "@application/use-cases/companys/create-company.usecase";
import { InviteUserUseCase } from "@application/use-cases/memberships/invite-user.usecase";
import { AcceptInviteUseCase } from "@application/use-cases/memberships/accept-invite.usecase";
import { SelectCompanyUseCase } from "@application/use-cases/companys/select-company.usecase";
import { ListCompaniesUseCase } from "@application/use-cases/companys/list-companies.usecase";
import { UpdateCompanyUseCase } from "@application/use-cases/companys/update-company.usecase";
import { ChangeMemberRoleUseCase } from "@application/use-cases/memberships/change-member-role.usecase";
import { RemoveMemberUseCase } from "@application/use-cases/memberships/remove-member.usecase";
import {
  InMemoryCompanyRepository,
  InMemoryInviteRepository,
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  FakeHashingService,
  FixedInviteTokenService,
  FakeDomainEventsService,
  AlwaysTrueEmailValidationService,
} from "../../support/in-memory-repositories";
import { Role } from "@domain/enums/role.enum";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";

describe("Company Lifecycle Integration", () => {
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
    companyRepo.setMembershipRepo(membershipRepo);
    inviteRepo = new InMemoryInviteRepository();
    hashing = new FakeHashingService();
    tokenService = new FixedInviteTokenService();
    domainEvents = new FakeDomainEventsService();
    emailValidation = new AlwaysTrueEmailValidationService();
  });

  it("complete flow: create companys -> invites member -> accept -> manage", async () => {
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

    const { company } = await createCompany.execute({
      ownerId: owner.id,
      name: "Test Company",
      logoUrl: "https://example.com/logo.png",
    });

    expect(company.name).toBe("Test Company");
    expect(company.id).toBeDefined();

    const ownerMembership = await membershipRepo.findByUserAndCompany(
      owner.id,
      company.id,
    );
    expect(ownerMembership).toBeDefined();
    expect(ownerMembership?.role).toBe(Role.OWNER);

    const member = await userRepo.create({
      email: "member@test.com",
      name: "Member",
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

    const { invite } = await inviteUser.execute({
      inviterUserId: owner.id,
      companyId: company.id,
      email: member.email.toString(),
      role: Role.MEMBER,
      expiresInDays: 7,
    });

    expect(invite.token).toBe("fixed-token");
    expect(invite.email.toString()).toBe("member@test.com");

    const acceptInvite = new AcceptInviteUseCase(
      inviteRepo as any,
      membershipRepo as any,
      userRepo as any,
      hashing as any,
    );

    const result = await acceptInvite.execute({
      token: invite.token,
      name: member.name,
      password: "password123",
    });

    expect(result.user.id).toBe(member.id);
    expect(result.companyId).toBe(company.id);

    const memberMembership = await membershipRepo.findByUserAndCompany(
      member.id,
      company.id,
    );
    expect(memberMembership).toBeDefined();
    expect(memberMembership?.role).toBe(Role.MEMBER);

    const listCompanies = new ListCompaniesUseCase(companyRepo as any);
    const companies = await listCompanies.execute({
      userId: member.id,
      page: 1,
      pageSize: 10,
    });

    expect(companies.data.length).toBe(1);
    expect(companies.data[0].id).toBe(company.id);

    const selectCompany = new SelectCompanyUseCase(
      membershipRepo as any,
      userRepo as any,
    );
    await selectCompany.execute({
      userId: member.id,
      companyId: company.id,
    });

    const updatedMember = await userRepo.findById(member.id);
    expect(updatedMember?.activeCompanyId).toBe(company.id);

    const eventBuilder = {
      async build(input: any): Promise<any> {
        return {
          eventId: input.eventId,
          timestamp: new Date().toISOString(),
          sender: null,
          receiver: null,
          ...input.additionalData,
        };
      },
    } as any;

    const changeRole = new ChangeMemberRoleUseCase(
      membershipRepo as any,
      domainEvents as any,
      eventBuilder,
    );

    await changeRole.execute({
      requesterId: owner.id,
      companyId: company.id,
      targetUserId: member.id,
      newRole: Role.ADMIN,
    });

    const updatedMembership = await membershipRepo.findByUserAndCompany(
      member.id,
      company.id,
    );
    expect(updatedMembership?.role).toBe(Role.ADMIN);

    const updateCompany = new UpdateCompanyUseCase(
      companyRepo as any,
      membershipRepo as any,
    );

    await updateCompany.execute({
      requesterId: owner.id,
      companyId: company.id,
      name: "Updated Company Name",
    });

    const updatedCompany = await companyRepo.findById(company.id);
    expect(updatedCompany?.name).toBe("Updated Company Name");
  });

  it("owner cannot remove themselves", async () => {
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

    const { company } = await createCompany.execute({
      ownerId: owner.id,
      name: "Test Company",
    });

    const eventBuilder = {
      async build(input: any): Promise<any> {
        return {
          eventId: input.eventId,
          timestamp: new Date().toISOString(),
          sender: null,
          receiver: null,
          ...input.additionalData,
        };
      },
    } as any;

    const removeMember = new RemoveMemberUseCase(
      membershipRepo as any,
      companyRepo as any,
      userRepo as any,
      domainEvents as any,
      eventBuilder,
    );

    const error = await removeMember
      .execute({
        requesterId: owner.id,
        companyId: company.id,
        targetUserId: owner.id,
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
  });
});

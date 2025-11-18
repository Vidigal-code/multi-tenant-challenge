import {RemoveMemberUseCase} from "@application/use-cases/memberships/remove-member.usecase";
import {
    InMemoryCompanyRepository,
    InMemoryMembershipRepository,
    InMemoryUserRepository,
} from "../../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";
import {DomainEvent, DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

class RecordingDomainEventsService implements DomainEventsService {
    events: DomainEvent<any>[] = [];

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        this.events.push(event);
    }
}

describe("RemoveMemberUseCase", () => {
    it("ADMIN cannot remove OWNER", async () => {
        const memberships = new InMemoryMembershipRepository();
        const companies = new InMemoryCompanyRepository();
        const users = new InMemoryUserRepository();
        const owner1 = await users.create({
            email: "o1@a.com",
            name: "Owner1",
            passwordHash: "h:o1",
        });
        const owner2 = await users.create({
            email: "o2@a.com",
            name: "Owner2",
            passwordHash: "h:o2",
        });
        const admin = await users.create({
            email: "a@a.com",
            name: "Admin",
            passwordHash: "h:a",
        });
        const company = await companies.create({
            ownerId: owner1.id,
            name: "MyCo",
            logoUrl: null,
        });
        await memberships.create({
            userId: owner1.id,
            companyId: company.id,
            role: Role.OWNER,
        });
        await memberships.create({
            userId: owner2.id,
            companyId: company.id,
            role: Role.OWNER,
        });
        await memberships.create({
            userId: admin.id,
            companyId: company.id,
            role: Role.ADMIN,
        });
        const usecase = new RemoveMemberUseCase(
            memberships as any,
            companies as any,
            users as any,
        );
        const error = await usecase.execute({
            requesterId: admin.id,
            companyId: company.id,
            targetUserId: owner1.id,
        }).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.FORBIDDEN_ACTION);
    });

    it("does not allow removing the last OWNER", async () => {
        const memberships = new InMemoryMembershipRepository();
        const companies = new InMemoryCompanyRepository();
        const users = new InMemoryUserRepository();
        const owner = await users.create({
            email: "o2@a.com",
            name: "Owner2",
            passwordHash: "h:o2",
        });
        const company = await companies.create({
            ownerId: owner.id,
            name: "SoloCo",
            logoUrl: null,
        });
        await memberships.create({
            userId: owner.id,
            companyId: company.id,
            role: Role.OWNER,
        });
        const usecase = new RemoveMemberUseCase(
            memberships as any,
            companies as any,
            users as any,
        );
        const error = await usecase.execute({
            requesterId: owner.id,
            companyId: company.id,
            targetUserId: owner.id,
        }).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED);
    });

    it("emits removal event with notified owners and admins", async () => {
        const memberships = new InMemoryMembershipRepository();
        const companies = new InMemoryCompanyRepository();
        const users = new InMemoryUserRepository();
        const events = new RecordingDomainEventsService();

        const owner = await users.create({
            email: "owner@a.com",
            name: "Owner",
            passwordHash: "hash",
        });
        const admin = await users.create({
            email: "admin@a.com",
            name: "Admin",
            passwordHash: "hash",
        });
        const member = await users.create({
            email: "member@a.com",
            name: "Member",
            passwordHash: "hash",
        });

        const company = await companies.create({
            ownerId: owner.id,
            name: "NotifyCo",
            logoUrl: null,
        });

        await memberships.create({userId: owner.id, companyId: company.id, role: Role.OWNER});
        await memberships.create({userId: admin.id, companyId: company.id, role: Role.ADMIN});
        await memberships.create({userId: member.id, companyId: company.id, role: Role.MEMBER});

        const usecase = new RemoveMemberUseCase(
            memberships as any,
            companies as any,
            users as any,
            events,
        );

        await usecase.execute({
            requesterId: owner.id,
            companyId: company.id,
            targetUserId: member.id,
        });

        expect(await memberships.findByUserAndCompany(member.id, company.id)).toBeNull();
        expect(events.events).toHaveLength(1);
        const payload: any = events.events[0].payload;
        expect(payload).toMatchObject({
            companyId: company.id,
            userId: member.id,
            initiatorId: owner.id,
            role: Role.MEMBER,
        });
        expect(payload.notifiedUserIds.sort()).toEqual([admin.id, owner.id]);
    });
});

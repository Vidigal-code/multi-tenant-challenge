import {LeaveCompanyUseCase} from "@application/use-cases/memberships/leave-company.usecase";
import {InMemoryMembershipRepository} from "../../support/in-memory-repositories";
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

describe("LeaveCompanyUseCase", () => {
    it("notifies owners and admins when a member leaves", async () => {
        const memberships = new InMemoryMembershipRepository();
        const events = new RecordingDomainEventsService();

        await memberships.create({userId: "owner-1", companyId: "companys-1", role: Role.OWNER});
        await memberships.create({userId: "admin-1", companyId: "companys-1", role: Role.ADMIN});
        await memberships.create({userId: "member-1", companyId: "companys-1", role: Role.MEMBER});

        const useCase = new LeaveCompanyUseCase(memberships as any, events);

        const result = await useCase.execute({userId: "member-1", companyId: "companys-1"});

        expect(result).toEqual({left: true});
        expect(events.events).toHaveLength(1);
        const payload: any = events.events[0].payload;
        expect(payload).toMatchObject({
            companyId: "companys-1",
            userId: "member-1",
            role: Role.MEMBER,
        });
        expect(payload.notifiedUserIds.sort()).toEqual(["admin-1", "owner-1"]);
        expect(typeof payload.timestamp).toBe("string");
        expect(await memberships.findByUserAndCompany("member-1", "companys-1")).toBeNull();
    });

    it("prevents owners from leaving without transferring ownership", async () => {
        const memberships = new InMemoryMembershipRepository();
        const events = new RecordingDomainEventsService();

        await memberships.create({userId: "owner-1", companyId: "companys-1", role: Role.OWNER});

        const useCase = new LeaveCompanyUseCase(memberships as any, events);

        const error = await useCase.execute({userId: "owner-1", companyId: "companys-1"}).catch(e => e);
        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.OWNER_MUST_TRANSFER_BEFORE_LEAVE);
        expect(events.events).toHaveLength(0);
    });
});


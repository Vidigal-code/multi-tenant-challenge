import {SendNotificationUseCase} from "@application/use-cases/notifications/send-notification.usecase";
import {SuccessCode} from "@application/success/success-code";
import {InMemoryMembershipRepository, InMemoryUserRepository, FakeEventPayloadBuilderService,} from "../../support/in-memory-repositories";
import {Role} from "@domain/enums/role.enum";
import {
    ListNotificationsFilters,
    NotificationRepository,
    PaginatedNotifications
} from "@domain/repositories/notifications/notification.repository";
import {Notification} from "@domain/entities/notifications/notification.entity";
import {DomainEvent, DomainEventsService} from "@domain/services/domain-events.service";
import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";

class InMemoryNotificationRepository implements NotificationRepository {
    items: Notification[] = [];
    private sequence = 1;

    async create(data: any): Promise<Notification> {
        const notification = Notification.create({
            id: String(this.sequence++),
            companyId: data.companyId,
            senderUserId: data.senderUserId,
            recipientUserId: data.recipientUserId ?? null,
            recipientsEmails: data.recipientsEmails ?? [],
            title: data.title,
            body: data.body,
            createdAt: new Date(),
            read: false,
            meta: data.meta ?? {},
        });
        this.items.push(notification);
        return notification;
    }

    async listByUser(_: ListNotificationsFilters): Promise<PaginatedNotifications> {
        throw new Error("Not implemented");
    }

    async markRead(): Promise<void> {
        throw new Error("Not implemented");
    }

    async findById(): Promise<Notification | null> {
        throw new Error("Not implemented");
    }

    async delete(): Promise<void> {
        throw new Error("Not implemented");
    }
}

class RecordingDomainEventsService implements DomainEventsService {
    events: DomainEvent<any>[] = [];

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        this.events.push(event);
    }
}

class StubFriendshipRepository implements FriendshipRepository {
    friendships: Array<{ requesterId: string; addresseeId: string; status: FriendshipStatus }> = [];

    async create(): Promise<any> {
        throw new Error("Not implemented");
    }

    async findById(): Promise<any> {
        throw new Error("Not implemented");
    }

    async findByUsers(requesterId: string, addresseeId: string): Promise<any> {
        return this.friendships.find(
            (f) =>
                (f.requesterId === requesterId && f.addresseeId === addresseeId) ||
                (f.requesterId === addresseeId && f.addresseeId === requesterId),
        ) || null;
    }

    async listByUser(): Promise<any> {
        throw new Error("Not implemented");
    }

    async updateStatus(): Promise<any> {
        throw new Error("Not implemented");
    }

    async delete(): Promise<void> {
        throw new Error("Not implemented");
    }

    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        return !!this.friendships.find(
            (f) =>
                f.status === FriendshipStatus.ACCEPTED &&
                ((f.requesterId === userId1 && f.addresseeId === userId2) ||
                    (f.requesterId === userId2 && f.addresseeId === userId1)),
        );
    }
}

describe("SendNotificationUseCase", () => {
    it("broadcasts to all companys members when no contacts are provided", async () => {
        const memberships = new InMemoryMembershipRepository();
        const notifications = new InMemoryNotificationRepository();
        const users = new InMemoryUserRepository();
        const friendships = new StubFriendshipRepository();
        const events = new RecordingDomainEventsService();
        const builder = new FakeEventPayloadBuilderService();

        const owner = await users.create({email: "owner@test.com", name: "Owner", passwordHash: "x"});
        const admin = await users.create({email: "admin@test.com", name: "Admin", passwordHash: "x"});
        const member = await users.create({email: "member@test.com", name: "Member", passwordHash: "x"});

        await memberships.create({userId: owner.id, companyId: "companys-1", role: Role.OWNER});
        await memberships.create({userId: admin.id, companyId: "companys-1", role: Role.ADMIN});
        await memberships.create({userId: member.id, companyId: "companys-1", role: Role.MEMBER});

        const useCase = new SendNotificationUseCase(
            memberships as any,
            notifications as any,
            users as any,
            friendships as any,
            events,
            builder as any,
        );

        const result = await useCase.execute({
            companyId: "companys-1",
            senderUserId: owner.id,
            title: "Announcement",
            body: "All hands meeting",
        });

        expect(result.notifications).toHaveLength(2);
        expect(result.notifications.map((n) => n.recipientUserId)).toEqual([admin.id, member.id]);
        expect(result.validationResults[0]).toMatchObject({
            status: "sent",
            code: SuccessCode.NOTIFICATION_SENT_TO_ALL_MEMBERS,
            count: 2,
        });

        expect(notifications.items).toHaveLength(2);
        expect(events.events).toHaveLength(2);
        expect(events.events[0].name).toBe("notifications.sent");
        expect(events.events[0].payload).toMatchObject({
            companyId: "companys-1",
            recipientUserId: admin.id,
            senderUserId: owner.id,
        });
    });

    it("validates contact list and only sends to friends or members", async () => {
        const memberships = new InMemoryMembershipRepository();
        const notifications = new InMemoryNotificationRepository();
        const users = new InMemoryUserRepository();
        const friendships = new StubFriendshipRepository();
        const events = new RecordingDomainEventsService();
        const builder = new FakeEventPayloadBuilderService();

        const owner = await users.create({email: "owner@test.com", name: "Owner", passwordHash: "x"});
        const admin = await users.create({email: "admin@test.com", name: "Admin", passwordHash: "x"});
        const friend = await users.create({email: "friend@test.com", name: "Friend", passwordHash: "x"});

        await memberships.create({userId: owner.id, companyId: "companys-1", role: Role.OWNER});
        await memberships.create({userId: admin.id, companyId: "companys-1", role: Role.ADMIN});

        friendships.friendships.push({
            requesterId: owner.id,
            addresseeId: friend.id,
            status: FriendshipStatus.ACCEPTED,
        });

        const useCase = new SendNotificationUseCase(
            memberships as any,
            notifications as any,
            users as any,
            friendships as any,
            events,
            builder as any,
        );

        const result = await useCase.execute({
            companyId: "companys-1",
            senderUserId: owner.id,
            recipientsEmails: ["friend@test.com", "unknown@test.com", "owner@test.com"],
            title: "Direct update",
            body: "Custom note",
        });

        expect(result.notifications).toHaveLength(1);
        expect(result.notifications[0].recipientUserId).toBe(friend.id);

        const statuses = result.validationResults.reduce<Record<string, string>>
        ((map, entry) => {
            map[entry.email] = entry.status;
            return map;
        }, {});

        expect(statuses["friend@test.com"]).toBe("sent");
        expect(statuses["unknown@test.com"]).toBe("failed");
        expect(statuses["owner@test.com"]).toBe("failed");

        expect(events.events).toHaveLength(1);
        expect(events.events[0].payload).toMatchObject({
            recipientUserId: friend.id,
            senderUserId: owner.id,
        });
    });
});


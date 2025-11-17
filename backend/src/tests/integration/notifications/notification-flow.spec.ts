import { CreateCompanyUseCase } from "@application/use-cases/companys/create-company.usecase";
import { SendNotificationUseCase } from "@application/use-cases/notifications/send-notification.usecase";
import { ListNotificationsUseCase } from "@application/use-cases/notifications/list-notifications.usecase";
import { MarkNotificationReadUseCase } from "@application/use-cases/notifications/mark-notification-read.usecase";
import { ReplyToNotificationUseCase } from "@application/use-cases/notifications/reply-to-notification.usecase";
import { DeleteNotificationUseCase } from "@application/use-cases/notifications/delete-notification.usecase";
import {
  InMemoryUserRepository,
  InMemoryCompanyRepository,
  InMemoryMembershipRepository,
  FakeHashingService,
  FakeDomainEventsService,
} from "../../support/in-memory-repositories";
import { Role } from "@domain/enums/role.enum";

class InMemoryNotificationRepositoryFull {
  items: any[] = [];
  private sequence = 1;

  async create(data: any): Promise<any> {
    const notification = {
      id: String(this.sequence++),
      companyId: data.companyId ?? null,
      senderUserId: data.senderUserId ?? null,
      recipientUserId: data.recipientUserId ?? null,
      recipientsEmails: data.recipientsEmails ?? [],
      title: data.title,
      body: data.body,
      createdAt: new Date(),
      read: false,
      meta: data.meta ?? {},
    };
    this.items.push(notification);
    return notification;
  }

  async listByUser(filters: {
    userId: string;
    page: number;
    pageSize: number;
    read?: boolean;
  }): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
    const filtered = this.items.filter((n) => {
      if (filters.read !== undefined) {
        return (
          (n.recipientUserId === filters.userId ||
            n.senderUserId === filters.userId) &&
          n.read === filters.read
        );
      }
      return (
        n.recipientUserId === filters.userId ||
        n.senderUserId === filters.userId
      );
    });

    const total = filtered.length;
    const start = (filters.page - 1) * filters.pageSize;
    const data = filtered.slice(start, start + filters.pageSize);

    return { data, total, page: filters.page, pageSize: filters.pageSize };
  }

  async markRead(id: string | number): Promise<void> {
    const n = this.items.find((nn) => nn.id === String(id));
    if (n) n.read = true;
  }

  async findById(id: string | number): Promise<any | null> {
    return this.items.find((n) => n.id === String(id)) || null;
  }

  async delete(id: string | number): Promise<void> {
    this.items = this.items.filter((n) => n.id !== String(id));
  }
}

class InMemoryFriendshipRepositoryFull {
  items: any[] = [];

  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    return this.items.some(
      (f) =>
        ((f.requesterId === userId1 && f.addresseeId === userId2) ||
          (f.requesterId === userId2 && f.addresseeId === userId1)) &&
        f.status === "ACCEPTED",
    );
  }

  async findByUsers(_: string, __: string): Promise<any | null> {
    return null;
  }
}

describe("Notification Flow Integration", () => {
  let userRepo: InMemoryUserRepository;
  let companyRepo: InMemoryCompanyRepository;
  let membershipRepo: InMemoryMembershipRepository;
  let notificationRepo: InMemoryNotificationRepositoryFull;
  let friendshipRepo: InMemoryFriendshipRepositoryFull;
  let hashing: FakeHashingService;
  let domainEvents: FakeDomainEventsService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    companyRepo = new InMemoryCompanyRepository();
    membershipRepo = new InMemoryMembershipRepository();
    notificationRepo = new InMemoryNotificationRepositoryFull();
    friendshipRepo = new InMemoryFriendshipRepositoryFull();
    hashing = new FakeHashingService();
    domainEvents = new FakeDomainEventsService();
  });

  it("complete flow: create companys -> send notifications -> list -> read -> reply -> delete", async () => {
    const owner = await userRepo.create({
      email: "owner@test.com",
      name: "Owner",
      passwordHash: await hashing.hash("password123"),
    });

    const member = await userRepo.create({
      email: "member@test.com",
      name: "Member",
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

    await membershipRepo.create({
      userId: member.id,
      companyId: company.id,
      role: Role.MEMBER,
    });

    const ownerInRepo = await userRepo.findById(owner.id);
    expect(ownerInRepo).toBeDefined();

    const eventBuilder = {
      async build(input: any): Promise<any> {
        return {
          eventId: input.eventId,
          timestamp: new Date().toISOString(),
          sender: null,
          receiver: null,
          companyId: input.companyId || input.additionalData?.companyId,
          ...input.additionalData,
        };
      },
    } as any;

    const sendNotification = new SendNotificationUseCase(
      membershipRepo as any,
      notificationRepo as any,
      userRepo as any,
      friendshipRepo as any,
      domainEvents as any,
      eventBuilder,
    );

    const result = await sendNotification.execute({
      senderUserId: owner.id,
      companyId: company.id,
      title: "Welcome!",
      body: "Welcome to the companys",
      recipientsEmails: [member.email.toString()],
    });

    expect(result.notifications.length).toBe(1);
    expect(result.notifications[0].title).toBe("Welcome!");

    const listNotifications = new ListNotificationsUseCase(
      notificationRepo as any,
    );

    const notifications = await listNotifications.execute({
      userId: member.id,
      page: 1,
      pageSize: 10,
    });

    expect(notifications.data.length).toBe(1);
    expect(notifications.data[0].title).toBe("Welcome!");
    expect(notifications.data[0].read).toBe(false);

    const markRead = new MarkNotificationReadUseCase(
      notificationRepo as any,
      domainEvents as any,
    );

    await markRead.execute({
      userId: member.id,
      notificationId: String(notifications.data[0].id),
    });

    const readNotification = await notificationRepo.findById(
      String(notifications.data[0].id),
    );
    expect(readNotification?.read).toBe(true);

    const replyToNotification = new ReplyToNotificationUseCase(
      notificationRepo as any,
      domainEvents as any,
      userRepo as any,
    );

    const reply = await replyToNotification.execute({
      userId: member.id,
      notificationId: String(notifications.data[0].id),
      replyBody: "Thank you!",
    });

    expect(reply.replyNotification).toBeDefined();
    expect(reply.replyNotification.body).toBe("Thank you!");

    const unreadNotifications = await listNotifications.execute({
      userId: member.id,
      page: 1,
      pageSize: 10,
    });

    expect(unreadNotifications.data.length).toBeGreaterThan(0);

    const deleteNotification = new DeleteNotificationUseCase(
      notificationRepo as any,
    );

    await deleteNotification.execute({
      userId: member.id,
      notificationId: String(notifications.data[0].id),
    });

    const deletedNotification = await notificationRepo.findById(
      String(notifications.data[0].id),
    );
    expect(deletedNotification).toBeNull();
  });

  it("send notifications to all companys members", async () => {
    const owner = await userRepo.create({
      email: "owner@test.com",
      name: "Owner",
      passwordHash: await hashing.hash("password123"),
    });

    const member1 = await userRepo.create({
      email: "member1@test.com",
      name: "Member 1",
      passwordHash: await hashing.hash("password123"),
    });

    const member2 = await userRepo.create({
      email: "member2@test.com",
      name: "Member 2",
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

    await membershipRepo.create({
      userId: member1.id,
      companyId: company.id,
      role: Role.MEMBER,
    });

    await membershipRepo.create({
      userId: member2.id,
      companyId: company.id,
      role: Role.MEMBER,
    });

    const ownerInRepo = await userRepo.findById(owner.id);
    expect(ownerInRepo).toBeDefined();

    const eventBuilder = {
      async build(input: any): Promise<any> {
        return {
          eventId: input.eventId,
          timestamp: new Date().toISOString(),
          sender: null,
          receiver: null,
          companyId: input.companyId || input.additionalData?.companyId,
          ...input.additionalData,
        };
      },
    } as any;

    const sendNotification = new SendNotificationUseCase(
      membershipRepo as any,
      notificationRepo as any,
      userRepo as any,
      friendshipRepo as any,
      domainEvents as any,
      eventBuilder,
    );

    const result = await sendNotification.execute({
      senderUserId: owner.id,
      companyId: company.id,
      title: "Announcement",
      body: "Important announcement",
    });

    expect(result.notifications.length).toBe(2);
  });
});

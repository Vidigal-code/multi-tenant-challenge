import { InvitesController } from "@interfaces/http/invites/invites.controller";
import { InviteRepository } from "@domain/repositories/invites/invite.repository";
import { CompanyRepository } from "@domain/repositories/companys/company.repository";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { QueryProducer } from "@infrastructure/messaging/producers/query.producer";
import { BatchOperationsProducer } from "@infrastructure/messaging/producers/batch-operations.producer";

describe("InvitesController", () => {
  const inviteRepo: jest.Mocked<InviteRepository> = {
    createOrReuse: jest.fn(),
    findByToken: jest.fn(),
    markAccepted: jest.fn(),
    markExpired: jest.fn(),
    expireInvitesForEmail: jest.fn(),
    listByEmail: jest.fn(),
  } as any;

  const companyRepo: jest.Mocked<CompanyRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByOwner: jest.fn(),
    listByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findByUser: jest.fn(),
  } as any;

  const rabbitMQService = { publish: jest.fn() } as any;
  const configService = { get: jest.fn() } as any;
  const eventBuilder = { build: jest.fn() } as any;
  const notificationsRepo = {
    create: jest.fn(),
    listByUser: jest.fn(),
    markRead: jest.fn(),
    findById: jest.fn(),
    delete: jest.fn(),
  } as any;
  const usersRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
  } as any;
  const membershipsRepo = {
    listByUser: jest.fn(),
  } as any;
  const cache = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn(),
    invalidate: jest.fn(),
    waitForCache: jest.fn().mockResolvedValue(null),
  } as any as RedisQueryCacheService;
  const queryProducer = {
    queueQuery: jest.fn(),
  } as any as QueryProducer;
  const batchOperationsProducer = {
    queueDeleteAllInvites: jest.fn(),
    queueRejectAllInvites: jest.fn(),
  } as any as BatchOperationsProducer;

  const controller = new (InvitesController as any)(
    inviteRepo,
    companyRepo,
    notificationsRepo,
    usersRepo,
    membershipsRepo,
    rabbitMQService,
    configService,
    eventBuilder,
    cache,
    queryProducer,
    batchOperationsProducer,
  );
  const user = { email: "me@example.com" };

  it("lists invites with pagination defaults", async () => {
    inviteRepo.listByEmail.mockResolvedValue({ data: [], total: 0 });
    const out = await controller.list(user, undefined as any, undefined as any);
    expect(inviteRepo.listByEmail).toHaveBeenCalledWith(
      "me@example.com",
      1,
      10,
    );
    expect(out).toEqual({ data: [], total: 0, page: 1, pageSize: 10 });
  });

  it("coerces and caps page/pageSize and maps fields", async () => {
    const now = new Date();
    inviteRepo.listByEmail.mockResolvedValue({
      total: 2,
      data: [
        {
          id: "i1",
          email: { toString: () => "me@example.com" },
          companyId: "c1",
          role: "MEMBER" as any,
          status: "PENDING" as any,
          token: "t1",
          createdAt: now,
          expiresAt: now,
        } as any,
        {
          id: "i2",
          email: { toString: () => "me@example.com" },
          companyId: "c2",
          role: "ADMIN" as any,
          status: "PENDING" as any,
          token: "t2",
          createdAt: now,
          expiresAt: now,
        } as any,
      ],
    });
    companyRepo.findById.mockImplementation(async (id) => {
      if (id === "c1")
        return { id: "c1", name: "Company One", description: "Desc 1" } as any;
      if (id === "c2")
        return { id: "c2", name: "Company Two", description: "Desc 2" } as any;
      return null;
    });
    const out = await controller.list(user, "-5" as any, "1000" as any);
    expect(inviteRepo.listByEmail).toHaveBeenCalledWith(
      "me@example.com",
      1,
      50,
    );
    expect(out.data.length).toBe(2);
    expect(out.data[0]).toMatchObject({
      id: "i1",
      email: "me@example.com",
      companyId: "c1",
      token: "t1",
      name: "Company One",
      description: "Desc 1",
    });
    expect(out.page).toBe(1);
    expect(out.pageSize).toBe(50);
  });
});

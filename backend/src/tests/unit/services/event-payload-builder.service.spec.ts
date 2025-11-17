import { EventPayloadBuilderService } from "@application/services/event-payload-builder.service";
import {
  InMemoryUserRepository,
  InMemoryCompanyRepository,
} from "../../support/in-memory-repositories";
import { Role } from "@domain/enums/role.enum";
import { ConfigService } from "@nestjs/config";

/**
 * EN -
 * Unit tests for EventPayloadBuilderService following TDD principles.
 *
 * Tests cover:
 * - Building payload with sender information
 * - Building payload with receiver information
 * - Building payload with company information
 * - Building payload with additional data
 * - Building payload without optional fields
 * - Enriching payload with user details
 *
 * PT -
 * Testes unitários para EventPayloadBuilderService seguindo princípios TDD.
 *
 * Testes cobrem:
 * - Construção de payload com informações do remetente
 * - Construção de payload com informações do destinatário
 * - Construção de payload com informações da empresa
 * - Construção de payload com dados adicionais
 * - Construção de payload sem campos opcionais
 * - Enriquecimento de payload com detalhes do usuário
 */
describe("EventPayloadBuilderService", () => {
  let service: EventPayloadBuilderService;
  let userRepo: InMemoryUserRepository;
  let companyRepo: InMemoryCompanyRepository;
  let configService: ConfigService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    companyRepo = new InMemoryCompanyRepository();
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => defaultValue),
    } as any;
    service = new EventPayloadBuilderService(
      userRepo as any,
      companyRepo as any,
      configService,
    );
  });

  /**
   * EN -
   * Tests building payload with sender information.
   * Verifies that sender details are included in payload.
   *
   * PT -
   * Testa construção de payload com informações do remetente.
   * Verifica que detalhes do remetente são incluídos no payload.
   */
  it("should build payload with sender information", async () => {
    const sender = await userRepo.create({
      email: "sender@example.com",
      name: "Sender User",
      passwordHash: "hash1",
    });

    const payload = await service.build({
      eventId: "TEST_EVENT",
      senderId: sender.id,
      additionalData: {},
    });

    expect(payload.sender).toBeDefined();
    expect(payload.sender?.id).toBe(sender.id);
    expect(payload.sender?.name).toBe("Sender User");
    expect(payload.sender?.email).toBe("sender@example.com");
    expect(payload.eventId).toBe("TEST_EVENT");
  });

  /**
   * EN -
   * Tests building payload with receiver information.
   * Verifies that receiver details are included in payload.
   *
   * PT -
   * Testa construção de payload com informações do destinatário.
   * Verifica que detalhes do destinatário são incluídos no payload.
   */
  it("should build payload with receiver information", async () => {
    const receiver = await userRepo.create({
      email: "receiver@example.com",
      name: "Receiver User",
      passwordHash: "hash2",
    });

    const payload = await service.build({
      eventId: "TEST_EVENT",
      receiverId: receiver.id,
      additionalData: {},
    });

    expect(payload.receiver).toBeDefined();
    expect(payload.receiver?.id).toBe(receiver.id);
    expect(payload.receiver?.name).toBe("Receiver User");
    expect(payload.receiver?.email).toBe("receiver@example.com");
  });

  /**
   * EN -
   * Tests building payload with company information.
   * Verifies that company details are included in payload.
   *
   * PT -
   * Testa construção de payload com informações da empresa.
   * Verifica que detalhes da empresa são incluídos no payload.
   */
  it("should build payload with company information", async () => {
    const owner = await userRepo.create({
      email: "owner@example.com",
      name: "Owner",
      passwordHash: "hash1",
    });

    const company = await companyRepo.create({
      ownerId: owner.id,
      name: "Test Company",
      logoUrl: null,
    });

    const payload = await service.build({
      eventId: "TEST_EVENT",
      companyId: company.id,
      additionalData: {},
    });

    expect(payload.company).toBeDefined();
    expect(payload.company?.id).toBe(company.id);
    expect(payload.company?.name).toBe("Test Company");
    expect(payload.companyId).toBe(company.id);
  });

  /**
   * EN -
   * Tests building payload with additional data.
   * Verifies that additional data is merged into payload.
   *
   * PT -
   * Testa construção de payload com dados adicionais.
   * Verifica que dados adicionais são mesclados no payload.
   */
  it("should build payload with additional data", async () => {
    const payload = await service.build({
      eventId: "TEST_EVENT",
      additionalData: {
        customField: "customValue",
        numberField: 123,
      },
    });

    expect((payload as any).customField).toBe("customValue");
    expect((payload as any).numberField).toBe(123);
  });

  /**
   * EN -
   * Tests building payload without optional fields.
   * Verifies that payload is built successfully with only required fields.
   *
   * PT -
   * Testa construção de payload sem campos opcionais.
   * Verifica que payload é construído com sucesso apenas com campos obrigatórios.
   */
  it("should build payload without optional fields", async () => {
    const payload = await service.build({
      eventId: "TEST_EVENT",
      additionalData: {},
    });

    expect(payload.eventId).toBe("TEST_EVENT");
    expect(payload.timestamp).toBeDefined();
    expect(payload.sender).toBeNull();
    expect(payload.receiver).toBeNull();
  });

  /**
   * EN -
   * Tests enriching payload with user details by email.
   * Verifies that receiver is found by email when receiverId not provided.
   *
   * PT -
   * Testa enriquecimento de payload com detalhes do usuário por email.
   * Verifica que destinatário é encontrado por email quando receiverId não fornecido.
   */
  it("should enrich payload with receiver by email", async () => {
    const receiver = await userRepo.create({
      email: "receiver@example.com",
      name: "Receiver User",
      passwordHash: "hash2",
    });

    const payload = await service.build({
      eventId: "TEST_EVENT",
      receiverEmail: "receiver@example.com",
      additionalData: {},
    });

    expect(payload.receiver).toBeDefined();
    expect(payload.receiver?.id).toBe(receiver.id);
    expect(payload.receiverId).toBe(receiver.id);
  });

  /**
   * EN -
   * Tests payload includes timestamp.
   * Verifies that timestamp is automatically added to payload.
   *
   * PT -
   * Testa que payload inclui timestamp.
   * Verifica que timestamp é automaticamente adicionado ao payload.
   */
  it("should include timestamp in payload", async () => {
    const before = new Date().toISOString();
    const payload = await service.build({
      eventId: "TEST_EVENT",
      additionalData: {},
    });
    const after = new Date().toISOString();

    expect(payload.timestamp).toBeDefined();
    expect(payload.timestamp >= before).toBe(true);
    expect(payload.timestamp <= after).toBe(true);
  });
});

import {SendFriendRequestUseCase} from "@application/use-cases/friendships/send-friend-request.usecase";
import {
    InMemoryUserRepository,
    InMemoryFriendshipRepository,
    FakeDomainEventsService,
} from "../../support/in-memory-repositories";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {EventPayloadBuilderService} from "@application/services/event-payload-builder.service";
import {FakeHashingService} from "../../support/in-memory-repositories";

/**
 * EN -
 * Unit tests for SendFriendRequestUseCase following TDD principles.
 * 
 * Tests cover:
 * - Successful friend request creation
 * - Rejection when requester not found
 * - Rejection when addressee not found
 * - Rejection when trying to add yourself
 * - Rejection when already friends
 * - Rejection when request already sent
 * - Rejection when user is blocked
 * - Event publication on successful request
 * 
 * PT -
 * Testes unitários para SendFriendRequestUseCase seguindo princípios TDD.
 * 
 * Testes cobrem:
 * - Criação bem-sucedida de solicitação de amizade
 * - Rejeição quando solicitante não encontrado
 * - Rejeição quando destinatário não encontrado
 * - Rejeição ao tentar adicionar a si mesmo
 * - Rejeição quando já são amigos
 * - Rejeição quando solicitação já foi enviada
 * - Rejeição quando usuário está bloqueado
 * - Publicação de evento em solicitação bem-sucedida
 */
describe("SendFriendRequestUseCase", () => {
    let userRepo: InMemoryUserRepository;
    let friendshipRepo: InMemoryFriendshipRepository;
    let eventsService: FakeDomainEventsService;
    let eventBuilder: EventPayloadBuilderService;
    let usecase: SendFriendRequestUseCase;
    let publishedEvents: any[];

    beforeEach(() => {
        userRepo = new InMemoryUserRepository();
        friendshipRepo = new InMemoryFriendshipRepository();
        publishedEvents = [];
        eventsService = {
            async publish(event: any) {
                publishedEvents.push(event);
            },
        } as any;
        eventBuilder = new EventPayloadBuilderService(
            userRepo as any,
            {} as any,
            {get: jest.fn()} as any,
        );
        usecase = new SendFriendRequestUseCase(
            userRepo as any,
            friendshipRepo as any,
            eventsService as any,
            eventBuilder,
        );
    });

    /**
     * EN -
     * Tests successful friend request creation.
     * Verifies that friendship is created and event is published.
     * 
     * PT -
     * Testa criação bem-sucedida de solicitação de amizade.
     * Verifica que amizade é criada e evento é publicado.
     */
    it("should create friend request successfully", async () => {
        const requester = await userRepo.create({
            email: "requester@example.com",
            name: "Requester",
            passwordHash: "hash1",
        });

        const addressee = await userRepo.create({
            email: "addressee@example.com",
            name: "Addressee",
            passwordHash: "hash2",
        });

        const result = await usecase.execute({
            requesterId: requester.id,
            addresseeEmail: "addressee@example.com",
        });

        expect(result.friendship).toBeDefined();
        expect(result.friendship.requesterId).toBe(requester.id);
        expect(result.friendship.addresseeId).toBe(addressee.id);
        expect(result.friendship.status).toBe(FriendshipStatus.PENDING);
        expect(publishedEvents.length).toBe(1);
        expect(publishedEvents[0].name).toBe("friend.request.sent");
    });

    /**
     * EN -
     * Tests rejection when requester does not exist.
     * Verifies that USER_NOT_FOUND error is thrown.
     * 
     * PT -
     * Testa rejeição quando solicitante não existe.
     * Verifica que erro USER_NOT_FOUND é lançado.
     */
    it("should reject when requester not found", async () => {
        const error = await usecase.execute({
            requesterId: "nonexistent-id",
            addresseeEmail: "addressee@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.USER_NOT_FOUND);
    });

    /**
     * EN -
     * Tests rejection when addressee does not exist.
     * Verifies that USER_NOT_FOUND error is thrown.
     * 
     * PT -
     * Testa rejeição quando destinatário não existe.
     * Verifica que erro USER_NOT_FOUND é lançado.
     */
    it("should reject when addressee not found", async () => {
        const requester = await userRepo.create({
            email: "requester@example.com",
            name: "Requester",
            passwordHash: "hash1",
        });

        const error = await usecase.execute({
            requesterId: requester.id,
            addresseeEmail: "nonexistent@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.USER_NOT_FOUND);
    });

    /**
     * EN -
     * Tests rejection when trying to add yourself.
     * Verifies that CANNOT_ADD_YOURSELF error is thrown.
     * 
     * PT -
     * Testa rejeição ao tentar adicionar a si mesmo.
     * Verifica que erro CANNOT_ADD_YOURSELF é lançado.
     */
    it("should reject when trying to add yourself", async () => {
        const user = await userRepo.create({
            email: "user@example.com",
            name: "User",
            passwordHash: "hash1",
        });

        const error = await usecase.execute({
            requesterId: user.id,
            addresseeEmail: "user@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.CANNOT_ADD_YOURSELF);
    });

    /**
     * EN -
     * Tests rejection when users are already friends.
     * Verifies that ALREADY_FRIENDS error is thrown.
     * 
     * PT -
     * Testa rejeição quando usuários já são amigos.
     * Verifica que erro ALREADY_FRIENDS é lançado.
     */
    it("should reject when already friends", async () => {
        const requester = await userRepo.create({
            email: "requester@example.com",
            name: "Requester",
            passwordHash: "hash1",
        });

        const addressee = await userRepo.create({
            email: "addressee@example.com",
            name: "Addressee",
            passwordHash: "hash2",
        });

        const existingFriendship = await friendshipRepo.create({
            requesterId: requester.id,
            addresseeId: addressee.id,
        });
        await friendshipRepo.updateStatus(existingFriendship.id, FriendshipStatus.ACCEPTED);

        const error = await usecase.execute({
            requesterId: requester.id,
            addresseeEmail: "addressee@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.ALREADY_FRIENDS);
    });

    /**
     * EN -
     * Tests rejection when request already sent.
     * Verifies that FRIEND_REQUEST_ALREADY_SENT error is thrown.
     * 
     * PT -
     * Testa rejeição quando solicitação já foi enviada.
     * Verifica que erro FRIEND_REQUEST_ALREADY_SENT é lançado.
     */
    it("should reject when request already sent", async () => {
        const requester = await userRepo.create({
            email: "requester@example.com",
            name: "Requester",
            passwordHash: "hash1",
        });

        const addressee = await userRepo.create({
            email: "addressee@example.com",
            name: "Addressee",
            passwordHash: "hash2",
        });

        await friendshipRepo.create({
            requesterId: requester.id,
            addresseeId: addressee.id,
        });

        const error = await usecase.execute({
            requesterId: requester.id,
            addresseeEmail: "addressee@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
    });

    /**
     * EN -
     * Tests rejection when user is blocked.
     * Verifies that USER_BLOCKED error is thrown.
     * 
     * PT -
     * Testa rejeição quando usuário está bloqueado.
     * Verifica que erro USER_BLOCKED é lançado.
     */
    it("should reject when user is blocked", async () => {
        const requester = await userRepo.create({
            email: "requester@example.com",
            name: "Requester",
            passwordHash: "hash1",
        });

        const addressee = await userRepo.create({
            email: "addressee@example.com",
            name: "Addressee",
            passwordHash: "hash2",
        });

        const existingFriendship = await friendshipRepo.create({
            requesterId: requester.id,
            addresseeId: addressee.id,
        });
        await friendshipRepo.updateStatus(existingFriendship.id, FriendshipStatus.BLOCKED);

        const error = await usecase.execute({
            requesterId: requester.id,
            addresseeEmail: "addressee@example.com",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.USER_BLOCKED);
    });
});


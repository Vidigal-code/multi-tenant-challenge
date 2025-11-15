import {SignupUseCase} from "@application/use-cases/auths/signup.usecase";
import {SendFriendRequestUseCase} from "@application/use-cases/friendships/send-friend-request.usecase";
import {AcceptFriendRequestUseCase} from "@application/use-cases/friendships/accept-friend-request.usecase";
import {RejectFriendRequestUseCase} from "@application/use-cases/friendships/reject-friend-request.usecase";
import {ListFriendshipsUseCase} from "@application/use-cases/friendships/list-friendships.usecase";
import {SendFriendMessageUseCase} from "@application/use-cases/friendships/send-friend-message.usecase";
import {DeleteFriendshipUseCase} from "@application/use-cases/friendships/delete-friendship.usecase";
import {
    InMemoryUserRepository,
    FakeHashingService,
    FakeDomainEventsService,
} from "../../support/in-memory-repositories";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

class InMemoryFriendshipRepository {
    items: any[] = [];

    async create(data: {requesterId: string; addresseeId: string}): Promise<any> {
        const friendship = {
            id: Math.random().toString(36).slice(2),
            requesterId: data.requesterId,
            addresseeId: data.addresseeId,
            status: FriendshipStatus.PENDING,
            createdAt: new Date(),
        };
        this.items.push(friendship);
        return friendship;
    }

    async findByUsers(userId1: string, userId2: string): Promise<any | null> {
        return (
            this.items.find(
                (f) =>
                    (f.requesterId === userId1 && f.addresseeId === userId2) ||
                    (f.requesterId === userId2 && f.addresseeId === userId1),
            ) || null
        );
    }

    async findById(id: string): Promise<any | null> {
        return this.items.find((f) => f.id === id) || null;
    }

    async listByUser(filters: {userId: string; page: number; pageSize: number; status?: FriendshipStatus}): Promise<{data: any[]; total: number; page: number; pageSize: number}> {
        let filtered = this.items.filter(
            (f) => f.requesterId === filters.userId || f.addresseeId === filters.userId,
        );
        if (filters.status) {
            filtered = filtered.filter((f) => f.status === filters.status);
        }
        const total = filtered.length;
        const start = (filters.page - 1) * filters.pageSize;
        const data = filtered.slice(start, start + filters.pageSize);
        return {data, total, page: filters.page, pageSize: filters.pageSize};
    }

    async updateStatus(id: string, status: FriendshipStatus): Promise<any> {
        const f = this.items.find((ff) => ff.id === id);
        if (f) {
            f.status = status;
            return f;
        }
        throw new Error("NOT_FOUND");
    }


    async delete(id: string): Promise<void> {
        this.items = this.items.filter((f) => f.id !== id);
    }

    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const friendship = await this.findByUsers(userId1, userId2);
        return friendship?.status === FriendshipStatus.ACCEPTED;
    }
}

class InMemoryNotificationRepository {
    items: any[] = [];

    async create(data: any): Promise<any> {
        const notification = {
            id: Math.random().toString(36).slice(2),
            ...data,
            createdAt: new Date(),
            read: false,
        };
        this.items.push(notification);
        return notification;
    }

    async listByUser(_: any): Promise<{data: any[]; total: number}> {
        return {data: this.items, total: this.items.length};
    }

    async markRead(_: string): Promise<void> {}
    async findById(_: string): Promise<any | null> {
        return null;
    }
    async delete(_: string): Promise<void> {}
}

describe("Friendship Flow Integration", () => {
    let userRepo: InMemoryUserRepository;
    let friendshipRepo: InMemoryFriendshipRepository;
    let notificationRepo: InMemoryNotificationRepository;
    let hashing: FakeHashingService;
    let domainEvents: FakeDomainEventsService;

    beforeEach(() => {
        userRepo = new InMemoryUserRepository();
        friendshipRepo = new InMemoryFriendshipRepository();
        notificationRepo = new InMemoryNotificationRepository();
        hashing = new FakeHashingService();
        domainEvents = new FakeDomainEventsService();
    });

    it("complete flow: signup -> send request -> accept -> send message -> delete", async () => {
        const signup = new SignupUseCase(userRepo as any, hashing as any);

        const {user: user1} = await signup.execute({
            email: "user1@test.com",
            name: "User 1",
            password: "password123",
        });

        const {user: user2} = await signup.execute({
            email: "user2@test.com",
            name: "User 2",
            password: "password123",
        });

        const sendRequest = new SendFriendRequestUseCase(
            userRepo as any,
            friendshipRepo as any,
            domainEvents as any,
        );

        const {friendship: request} = await sendRequest.execute({
            requesterId: user1.id,
            addresseeEmail: user2.email.toString(),
        });

        expect(request.status).toBe(FriendshipStatus.PENDING);
        expect(request.requesterId).toBe(user1.id);
        expect(request.addresseeId).toBe(user2.id);

        const listFriendships = new ListFriendshipsUseCase(friendshipRepo as any);

        const user2Friendships = await listFriendships.execute({
            userId: user2.id,
            page: 1,
            pageSize: 10,
        });

        expect(user2Friendships.data.length).toBe(1);
        expect(user2Friendships.data[0].status).toBe(FriendshipStatus.PENDING);

        const acceptRequest = new AcceptFriendRequestUseCase(
            friendshipRepo as any,
            domainEvents as any,
        );

        await acceptRequest.execute({
            friendshipId: request.id,
            userId: user2.id,
        });

        const acceptedFriendship = await friendshipRepo.findByUsers(user1.id, user2.id);
        expect(acceptedFriendship?.status).toBe(FriendshipStatus.ACCEPTED);

        const areFriends = await friendshipRepo.areFriends(user1.id, user2.id);
        expect(areFriends).toBe(true);

        const sendMessage = new SendFriendMessageUseCase(
            notificationRepo as any,
            userRepo as any,
            friendshipRepo as any,
            domainEvents as any,
        );

        const result = await sendMessage.execute({
            senderUserId: user1.id,
            friendEmail: user2.email.toString(),
            title: "Hello!",
            body: "How are you?",
        });

        expect(result.notification).toBeDefined();
        expect(result.notification.title).toBe("Hello!");

        const user1Friends = await listFriendships.execute({
            userId: user1.id,
            page: 1,
            pageSize: 10,
        });

        expect(user1Friends.data.length).toBe(1);
        expect(user1Friends.data[0].status).toBe(FriendshipStatus.ACCEPTED);

        const deleteFriendship = new DeleteFriendshipUseCase(
            friendshipRepo as any,
            domainEvents as any,
        );

        await deleteFriendship.execute({
            userId: user1.id,
            friendshipId: acceptedFriendship.id,
        });

        const deletedFriendship = await friendshipRepo.findByUsers(user1.id, user2.id);
        expect(deletedFriendship).toBeNull();
    });

    it("send request -> reject flow", async () => {
        const signup = new SignupUseCase(userRepo as any, hashing as any);

        const {user: user1} = await signup.execute({
            email: "user1@test.com",
            name: "User 1",
            password: "password123",
        });

        const {user: user2} = await signup.execute({
            email: "user2@test.com",
            name: "User 2",
            password: "password123",
        });

        const sendRequest = new SendFriendRequestUseCase(
            userRepo as any,
            friendshipRepo as any,
            domainEvents as any,
        );

        const {friendship: request} = await sendRequest.execute({
            requesterId: user1.id,
            addresseeEmail: user2.email.toString(),
        });

        const rejectRequest = new RejectFriendRequestUseCase(
            friendshipRepo as any,
            domainEvents as any,
        );

        await rejectRequest.execute({
            friendshipId: request.id,
            userId: user2.id,
        });

        const rejectedFriendship = await friendshipRepo.findByUsers(user1.id, user2.id);
        expect(rejectedFriendship).toBeNull(); 
    });

    it("cannot send request to yourself", async () => {
        const signup = new SignupUseCase(userRepo as any, hashing as any);

        const {user} = await signup.execute({
            email: "users@test.com",
            name: "User",
            password: "password123",
        });

        const sendRequest = new SendFriendRequestUseCase(
            userRepo as any,
            friendshipRepo as any,
            domainEvents as any,
        );

        const error = await sendRequest
            .execute({
                requesterId: user.id,
                addresseeEmail: user.email.toString(),
            })
            .catch((e) => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.CANNOT_ADD_YOURSELF);
    });

    it("cannot send duplicate request", async () => {
        const signup = new SignupUseCase(userRepo as any, hashing as any);

        const {user: user1} = await signup.execute({
            email: "user1@test.com",
            name: "User 1",
            password: "password123",
        });

        const {user: user2} = await signup.execute({
            email: "user2@test.com",
            name: "User 2",
            password: "password123",
        });

        const sendRequest = new SendFriendRequestUseCase(
            userRepo as any,
            friendshipRepo as any,
            domainEvents as any,
        );

        await sendRequest.execute({
            requesterId: user1.id,
            addresseeEmail: user2.email.toString(),
        });

        const error = await sendRequest
            .execute({
                requesterId: user1.id,
                addresseeEmail: user2.email.toString(),
            })
            .catch((e) => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
    });
});


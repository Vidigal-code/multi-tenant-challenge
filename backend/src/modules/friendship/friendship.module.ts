import {Module} from "@nestjs/common";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {FriendshipController} from "@interfaces/http/friendship.controller";
import {SendFriendRequestUseCase} from "@application/use-cases/send-friend-request.usecase";
import {AcceptFriendRequestUseCase} from "@application/use-cases/accept-friend-request.usecase";
import {RejectFriendRequestUseCase} from "@application/use-cases/reject-friend-request.usecase";
import {DeleteFriendshipUseCase} from "@application/use-cases/delete-friendship.usecase";
import {ListFriendshipsUseCase} from "@application/use-cases/list-friendships.usecase";
import {SearchUsersUseCase} from "@application/use-cases/search-users.usecase";
import {USER_REPOSITORY} from "@domain/repositories/user.repository";
import {FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendship.repository";

@Module({
    imports: [InfrastructureModule],
    controllers: [FriendshipController],
    providers: [
        {
            provide: SendFriendRequestUseCase,
            useFactory: (users, friendships, domainEvents) =>
                new SendFriendRequestUseCase(users, friendships, domainEvents),
            inject: [USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: AcceptFriendRequestUseCase,
            useFactory: (friendships, domainEvents) =>
                new AcceptFriendRequestUseCase(friendships, domainEvents),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: RejectFriendRequestUseCase,
            useFactory: (friendships, domainEvents) =>
                new RejectFriendRequestUseCase(friendships, domainEvents),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: DeleteFriendshipUseCase,
            useFactory: (friendships, domainEvents) =>
                new DeleteFriendshipUseCase(friendships, domainEvents),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: ListFriendshipsUseCase,
            useFactory: (friendships) => new ListFriendshipsUseCase(friendships),
            inject: [FRIENDSHIP_REPOSITORY],
        },
        {
            provide: SearchUsersUseCase,
            useFactory: (users) => new SearchUsersUseCase(users),
            inject: [USER_REPOSITORY],
        },
    ],
})
export class FriendshipModule {
}
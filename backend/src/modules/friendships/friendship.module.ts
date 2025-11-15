import {Module} from "@nestjs/common";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {FriendshipController} from "@interfaces/http/friendships/friendship.controller";
import {SendFriendRequestUseCase} from "@application/use-cases/friendships/send-friend-request.usecase";
import {AcceptFriendRequestUseCase} from "@application/use-cases/friendships/accept-friend-request.usecase";
import {RejectFriendRequestUseCase} from "@application/use-cases/friendships/reject-friend-request.usecase";
import {DeleteFriendshipUseCase} from "@application/use-cases/friendships/delete-friendship.usecase";
import {ListFriendshipsUseCase} from "@application/use-cases/friendships/list-friendships.usecase";
import {SearchUsersUseCase} from "@application/use-cases/users/search-users.usecase";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendships/friendship.repository";

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
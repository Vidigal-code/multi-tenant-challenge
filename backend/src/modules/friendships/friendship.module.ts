import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RealtimeModule} from "@modules/realtime/realtime.module";
import {RabbitMQModule} from "@infrastructure/messaging/modules/rabbitmq.module";
import {FriendshipController} from "@interfaces/http/friendships/friendship.controller";
import {SendFriendRequestUseCase} from "@application/use-cases/friendships/send-friend-request.usecase";
import {AcceptFriendRequestUseCase} from "@application/use-cases/friendships/accept-friend-request.usecase";
import {RejectFriendRequestUseCase} from "@application/use-cases/friendships/reject-friend-request.usecase";
import {DeleteFriendshipUseCase} from "@application/use-cases/friendships/delete-friendship.usecase";
import {ListFriendshipsUseCase} from "@application/use-cases/friendships/list-friendships.usecase";
import {SearchUsersUseCase} from "@application/use-cases/users/search-users.usecase";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendships/friendship.repository";
import {FriendshipListingJobsService} from "@application/services/friendship-listing-jobs.service";
import {UserSearchJobsService} from "@application/services/user-search-jobs.service";

@Module({
    imports: [ConfigModule, InfrastructureModule, RealtimeModule, RabbitMQModule],
    controllers: [FriendshipController],
    providers: [
        FriendshipListingJobsService,
        UserSearchJobsService,
        {
            provide: SendFriendRequestUseCase,
            useFactory: (users, friendships, domainEvents, eventBuilder, configService) =>
                new SendFriendRequestUseCase(users, friendships, domainEvents, eventBuilder, configService),
            inject: [USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService", ConfigService],
        },
        {
            provide: AcceptFriendRequestUseCase,
            useFactory: (friendships, domainEvents, eventBuilder) =>
                new AcceptFriendRequestUseCase(friendships, domainEvents, eventBuilder),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService"],
        },
        {
            provide: RejectFriendRequestUseCase,
            useFactory: (friendships, domainEvents, eventBuilder) =>
                new RejectFriendRequestUseCase(friendships, domainEvents, eventBuilder),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService"],
        },
        {
            provide: DeleteFriendshipUseCase,
            useFactory: (friendships, domainEvents, eventBuilder) =>
                new DeleteFriendshipUseCase(friendships, domainEvents, eventBuilder),
            inject: [FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService"],
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
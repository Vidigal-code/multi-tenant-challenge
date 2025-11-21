import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {PrismaService} from "./prisma/services/prisma.service";
import {userRepositoryProvider} from "@infrastructure/prisma/users/user.prisma.repository";
import {companyRepositoryProvider} from "@infrastructure/prisma/companys/company.prisma.repository";
import {membershipRepositoryProvider} from "@infrastructure/prisma/memberships/membership.prisma.repository";
import {inviteRepositoryProvider} from "@infrastructure/prisma/invites/invite.prisma.repository";
import {RabbitMQModule} from "./messaging/modules/rabbitmq.module";
import {emailValidationProvider} from "./cache/redis-email-validation.service";
import {inviteListCacheProvider} from "./cache/invite-list-cache.service";
import {companyListCacheProvider} from "./cache/company-list-cache.service";
import {inviteBulkCacheProvider} from "./cache/invite-bulk-cache.service";
import {notificationListCacheProvider} from "./cache/notification-list-cache.service";
import {notificationDeletionCacheProvider} from "./cache/notification-deletion-cache.service";
import {notificationBroadcastCacheProvider} from "./cache/notification-broadcast-cache.service";
import {notificationFriendBroadcastCacheProvider} from "./cache/notification-friend-broadcast-cache.service";
import {notificationRepositoryProvider} from "@infrastructure/prisma/notifications/notification.prisma.repository";
import {friendshipRepositoryProvider} from "@infrastructure/prisma/friendships/friendship.prisma.repository";
import {friendshipListCacheProvider} from "./cache/friendship-list-cache.service";
import {userSearchCacheProvider} from "./cache/user-search-cache.service";
import {userDeletionCacheProvider} from "./cache/user-deletion-cache.service";

const repositoryProviders = [
    userRepositoryProvider,
    companyRepositoryProvider,
    membershipRepositoryProvider,
    inviteRepositoryProvider,
    notificationRepositoryProvider,
    friendshipRepositoryProvider,
];

@Module({
    imports: [ConfigModule, RabbitMQModule],
    providers: [
        {
            provide: PrismaService,
            useFactory: (configService: ConfigService) => {
                return new PrismaService(configService);
            },
            inject: [ConfigService],
        },
        ...repositoryProviders,
        emailValidationProvider,
        inviteListCacheProvider,
        companyListCacheProvider,
        inviteBulkCacheProvider,
        notificationListCacheProvider,
        notificationDeletionCacheProvider,
        friendshipListCacheProvider,
        userSearchCacheProvider,
        userDeletionCacheProvider,
        notificationBroadcastCacheProvider,
        notificationFriendBroadcastCacheProvider,
    ],
    exports: [
        PrismaService,
        RabbitMQModule,
        ...repositoryProviders,
        emailValidationProvider,
        inviteListCacheProvider,
        companyListCacheProvider,
        inviteBulkCacheProvider,
        notificationListCacheProvider,
        notificationDeletionCacheProvider,
        friendshipListCacheProvider,
        userSearchCacheProvider,
        userDeletionCacheProvider,
        notificationBroadcastCacheProvider,
        notificationFriendBroadcastCacheProvider,
    ],
})
export class InfrastructureModule {
}

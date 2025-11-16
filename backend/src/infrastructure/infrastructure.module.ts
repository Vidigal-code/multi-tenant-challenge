import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {PrismaService} from "./prisma/services/prisma.service";
import {userRepositoryProvider} from "@infrastructure/prisma/users/user.prisma.repository";
import {companyRepositoryProvider} from "@infrastructure/prisma/companys/company.prisma.repository";
import {membershipRepositoryProvider} from "@infrastructure/prisma/memberships/membership.prisma.repository";
import {inviteRepositoryProvider} from "@infrastructure/prisma/invites/invite.prisma.repository";
import {RabbitMQModule} from "./messaging/modules/rabbitmq.module";
import {emailValidationProvider} from "./cache/redis-email-validation.service";
import {notificationRepositoryProvider} from "@infrastructure/prisma/notifications/notification.prisma.repository";
import {friendshipRepositoryProvider} from "@infrastructure/prisma/friendships/friendship.prisma.repository";

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
    ],
    exports: [PrismaService, RabbitMQModule, ...repositoryProviders, emailValidationProvider],
})
export class InfrastructureModule {
}

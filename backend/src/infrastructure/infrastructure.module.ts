import {Module} from "@nestjs/common";
import {PrismaService} from "./prisma/prisma.service";
import {userRepositoryProvider} from "./prisma/user.prisma.repository";
import {companyRepositoryProvider} from "./prisma/company.prisma.repository";
import {membershipRepositoryProvider} from "./prisma/membership.prisma.repository";
import {inviteRepositoryProvider} from "./prisma/invite.prisma.repository";
import {RabbitMQModule} from "./messaging/rabbitmq.module";
import {emailValidationProvider} from "./cache/redis-email-validation.service";
import {notificationRepositoryProvider} from "./prisma/notification.prisma.repository";
import {friendshipRepositoryProvider} from "./prisma/friendship.prisma.repository";

const repositoryProviders = [
    userRepositoryProvider,
    companyRepositoryProvider,
    membershipRepositoryProvider,
    inviteRepositoryProvider,
    notificationRepositoryProvider,
    friendshipRepositoryProvider,
];

@Module({
    imports: [RabbitMQModule],
    providers: [PrismaService, ...repositoryProviders, emailValidationProvider],
    exports: [PrismaService, RabbitMQModule, ...repositoryProviders, emailValidationProvider],
})
export class InfrastructureModule {
}

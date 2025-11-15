import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RabbitMQModule} from "@infrastructure/messaging/rabbitmq.module";
import {AuthInfraModule} from "@infrastructure/auth/auth-infra.module";
import {InviteController} from "@interfaces/http/invite.controller";
import {MembershipController} from "@interfaces/http/membership.controller";
import {NotificationsController} from "@interfaces/http/notifications.controller";
import {InviteUserUseCase} from "@application/use-cases/invite-user.usecase";
import {RemoveMemberUseCase} from "@application/use-cases/remove-member.usecase";
import {ChangeMemberRoleUseCase} from "@application/use-cases/change-member-role.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/leave-company.usecase";
import {TransferOwnershipUseCase} from "@application/use-cases/transfer-ownership.usecase";
import {SendNotificationUseCase} from "@application/use-cases/send-notification.usecase";
import {SendFriendMessageUseCase} from "@application/use-cases/send-friend-message.usecase";
import {ListNotificationsUseCase} from "@application/use-cases/list-notifications.usecase";
import {MarkNotificationReadUseCase} from "@application/use-cases/mark-notification-read.usecase";
import {DeleteNotificationUseCase} from "@application/use-cases/delete-notification.usecase";
import {ReplyToNotificationUseCase} from "@application/use-cases/reply-to-notification.usecase";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/membership.repository";
import {INVITE_REPOSITORY} from "@domain/repositories/invite.repository";
import {COMPANY_REPOSITORY} from "@domain/repositories/company.repository";
import {USER_REPOSITORY} from "@domain/repositories/user.repository";
import {NOTIFICATION_REPOSITORY} from "@domain/repositories/notification.repository";
import {FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendship.repository";
import {INVITE_TOKEN_SERVICE} from "@application/ports/invite-token.service";
import {EMAIL_VALIDATION_SERVICE} from "@application/ports/email-validation.service";

@Module({
    imports: [ConfigModule, InfrastructureModule, AuthInfraModule, RabbitMQModule],
    controllers: [InviteController, MembershipController, NotificationsController],
    providers: [
        {
            provide: InviteUserUseCase,
            useFactory: (
                membershipRepo,
                inviteRepo,
                userRepo,
                inviteTokenService,
                domainEvents,
                emailValidation,
                configService,
            ) =>
                new InviteUserUseCase(
                    membershipRepo,
                    inviteRepo,
                    userRepo,
                    inviteTokenService,
                    domainEvents,
                    emailValidation,
                    configService,
                ),
            inject: [
                MEMBERSHIP_REPOSITORY,
                INVITE_REPOSITORY,
                USER_REPOSITORY,
                INVITE_TOKEN_SERVICE,
                "DOMAIN_EVENTS_SERVICE",
                EMAIL_VALIDATION_SERVICE,
                ConfigService,
            ],
        },
        {
            provide: RemoveMemberUseCase,
            useFactory: (membershipRepo, companyRepo, userRepo, domainEvents) =>
                new RemoveMemberUseCase(
                    membershipRepo,
                    companyRepo,
                    userRepo,
                    domainEvents,
                ),
            inject: [
                MEMBERSHIP_REPOSITORY,
                COMPANY_REPOSITORY,
                USER_REPOSITORY,
                "DOMAIN_EVENTS_SERVICE",
            ],
        },
        {
            provide: ChangeMemberRoleUseCase,
            useFactory: (membershipRepo, domainEvents) =>
                new ChangeMemberRoleUseCase(membershipRepo, domainEvents),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: LeaveCompanyUseCase,
            useFactory: (membershipRepo, domainEvents) =>
                new LeaveCompanyUseCase(membershipRepo, domainEvents),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: TransferOwnershipUseCase,
            useFactory: (membershipRepo, domainEvents) =>
                new TransferOwnershipUseCase(membershipRepo, domainEvents),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: SendNotificationUseCase,
            useFactory: (membershipRepo, notificationRepo, userRepo, friendshipRepo, domainEvents) =>
                new SendNotificationUseCase(membershipRepo, notificationRepo, userRepo, friendshipRepo, domainEvents),
            inject: [MEMBERSHIP_REPOSITORY, NOTIFICATION_REPOSITORY, USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: ListNotificationsUseCase,
            useFactory: (notificationRepo) => new ListNotificationsUseCase(notificationRepo),
            inject: [NOTIFICATION_REPOSITORY],
        },
        {
            provide: MarkNotificationReadUseCase,
            useFactory: (notificationRepo, domainEvents) => new MarkNotificationReadUseCase(notificationRepo, domainEvents),
            inject: [NOTIFICATION_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
        {
            provide: DeleteNotificationUseCase,
            useFactory: (notificationRepo) => new DeleteNotificationUseCase(notificationRepo),
            inject: [NOTIFICATION_REPOSITORY],
        },
        {
            provide: ReplyToNotificationUseCase,
            useFactory: (notificationRepo, domainEvents, userRepo) => new ReplyToNotificationUseCase(notificationRepo, domainEvents, userRepo),
            inject: [NOTIFICATION_REPOSITORY, "DOMAIN_EVENTS_SERVICE", USER_REPOSITORY],
        },
        {
            provide: SendFriendMessageUseCase,
            useFactory: (notificationRepo, userRepo, friendshipRepo, domainEvents) => new SendFriendMessageUseCase(notificationRepo, userRepo, friendshipRepo, domainEvents),
            inject: [NOTIFICATION_REPOSITORY, USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE"],
        },
    ],
})
export class MembershipModule {
}

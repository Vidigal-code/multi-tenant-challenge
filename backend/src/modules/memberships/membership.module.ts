import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RabbitMQModule} from "@infrastructure/messaging/modules/rabbitmq.module";
import {AuthInfraModule} from "@infrastructure/auth/modules/auth-infra.module";
import {RealtimeModule} from "@modules/realtime/realtime.module";
import {InviteController} from "@interfaces/http/invites/invite.controller";
import {MembershipController} from "@interfaces/http/memberships/membership.controller";
import {NotificationsController} from "@interfaces/http/notifications/notifications.controller";
import {InviteUserUseCase} from "@application/use-cases/memberships/invite-user.usecase";
import {RemoveMemberUseCase} from "@application/use-cases/memberships/remove-member.usecase";
import {ChangeMemberRoleUseCase} from "@application/use-cases/memberships/change-member-role.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/memberships/leave-company.usecase";
import {TransferOwnershipUseCase} from "@application/use-cases/companys/transfer-ownership.usecase";
import {SendNotificationUseCase} from "@application/use-cases/notifications/send-notification.usecase";
import {SendFriendMessageUseCase} from "@application/use-cases/friendships/send-friend-message.usecase";
import {ListNotificationsUseCase} from "@application/use-cases/notifications/list-notifications.usecase";
import {MarkNotificationReadUseCase} from "@application/use-cases/notifications/mark-notification-read.usecase";
import {DeleteNotificationUseCase} from "@application/use-cases/notifications/delete-notification.usecase";
import {DeleteNotificationsUseCase} from "@application/use-cases/notifications/delete-notifications.usecase";
import {ReplyToNotificationUseCase} from "@application/use-cases/notifications/reply-to-notification.usecase";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/memberships/membership.repository";
import {INVITE_REPOSITORY} from "@domain/repositories/invites/invite.repository";
import {COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {NOTIFICATION_REPOSITORY} from "@domain/repositories/notifications/notification.repository";
import {FRIENDSHIP_REPOSITORY} from "@domain/repositories/friendships/friendship.repository";
import {INVITE_TOKEN_SERVICE} from "@application/ports/invite-token.service";
import {EMAIL_VALIDATION_SERVICE} from "@application/ports/email-validation.service";
import {NotificationListingJobsService} from "@application/services/notification-listing-jobs.service";
import {NotificationDeletionJobsService} from "@application/services/notification-deletion-jobs.service";
import {NotificationDeletionConsumer} from "@interfaces/consumers/notifications/notification-deletion.consumer";
import {NotificationListCacheService} from "@infrastructure/cache/notification-list-cache.service";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";

@Module({
    imports: [ConfigModule, InfrastructureModule, AuthInfraModule, RabbitMQModule, RealtimeModule],
    controllers: [InviteController, MembershipController, NotificationsController],
    providers: [
        NotificationListingJobsService,
        NotificationDeletionJobsService,
        NotificationDeletionConsumer,
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
            useFactory: (membershipRepo, companyRepo, userRepo, domainEvents, eventBuilder) =>
                new RemoveMemberUseCase(
                    membershipRepo,
                    companyRepo,
                    userRepo,
                    domainEvents,
                    eventBuilder,
                ),
            inject: [
                MEMBERSHIP_REPOSITORY,
                COMPANY_REPOSITORY,
                USER_REPOSITORY,
                "DOMAIN_EVENTS_SERVICE",
                "EventPayloadBuilderService",
            ],
        },
        {
            provide: ChangeMemberRoleUseCase,
            useFactory: (membershipRepo, domainEvents, eventBuilder, configService) =>
                new ChangeMemberRoleUseCase(membershipRepo, domainEvents, eventBuilder, configService),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService", ConfigService],
        },
        {
            provide: LeaveCompanyUseCase,
            useFactory: (membershipRepo, domainEvents, configService) =>
                new LeaveCompanyUseCase(membershipRepo, domainEvents, configService),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", ConfigService],
        },
        {
            provide: TransferOwnershipUseCase,
            useFactory: (membershipRepo, domainEvents, configService) =>
                new TransferOwnershipUseCase(membershipRepo, domainEvents, configService),
            inject: [MEMBERSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", ConfigService],
        },
        {
            provide: SendNotificationUseCase,
            useFactory: (membershipRepo, notificationRepo, userRepo, friendshipRepo, domainEvents, eventBuilder, configService) =>
                new SendNotificationUseCase(membershipRepo, notificationRepo, userRepo, friendshipRepo, domainEvents, eventBuilder, configService),
            inject: [MEMBERSHIP_REPOSITORY, NOTIFICATION_REPOSITORY, USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService", ConfigService],
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
            provide: DeleteNotificationsUseCase,
            useFactory: (notificationRepo) => new DeleteNotificationsUseCase(notificationRepo),
            inject: [NOTIFICATION_REPOSITORY],
        },
        {
            provide: ReplyToNotificationUseCase,
            useFactory: (notificationRepo, domainEvents, userRepo) => new ReplyToNotificationUseCase(notificationRepo, domainEvents, userRepo),
            inject: [NOTIFICATION_REPOSITORY, "DOMAIN_EVENTS_SERVICE", USER_REPOSITORY],
        },
        {
            provide: SendFriendMessageUseCase,
            useFactory: (notificationRepo, userRepo, friendshipRepo, domainEvents, eventBuilder, configService) => new SendFriendMessageUseCase(notificationRepo, userRepo, friendshipRepo, domainEvents, eventBuilder, configService),
            inject: [NOTIFICATION_REPOSITORY, USER_REPOSITORY, FRIENDSHIP_REPOSITORY, "DOMAIN_EVENTS_SERVICE", "EventPayloadBuilderService", ConfigService],
        },
    ],
})
export class MembershipModule {
}

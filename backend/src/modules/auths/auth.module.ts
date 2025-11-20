import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {AuthInfraModule} from "@infrastructure/auth/modules/auth-infra.module";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RealtimeModule} from "@modules/realtime/realtime.module";
import {AuthController} from "@interfaces/http/auths/auth.controller";
import {InvitesController} from "@interfaces/http/invites/invites.controller";
import {SignupUseCase} from "@application/use-cases/auths/signup.usecase";
import {LoginUseCase} from "@application/use-cases/auths/login.usecase";
import {AcceptInviteUseCase} from "@application/use-cases/memberships/accept-invite.usecase";
import {DeleteAccountUseCase} from "@application/use-cases/users/delete-account.usecase";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/companys/list-primary-owner-companies.usecase";
import {ListMemberCompaniesUseCase} from "@application/use-cases/companys/list-member-companies.usecase";
import {InviteListingJobsService} from "@application/services/invite-listing-jobs.service";
import {InviteBulkJobsService} from "@application/services/invite-bulk-jobs.service";
import {CompanyListingJobsService} from "@application/services/company-listing-jobs.service";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {INVITE_REPOSITORY} from "@domain/repositories/invites/invite.repository";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/memberships/membership.repository";
import {HASHING_SERVICE} from "@application/ports/hashing.service";
import {COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";

@Module({
    imports: [ConfigModule, AuthInfraModule, InfrastructureModule, RealtimeModule],
    controllers: [AuthController, InvitesController],
    providers: [
        InviteListingJobsService,
        InviteBulkJobsService,
        CompanyListingJobsService,
        {
            provide: SignupUseCase,
            useFactory: (userRepo, hashingService) =>
                new SignupUseCase(userRepo, hashingService),
            inject: [USER_REPOSITORY, HASHING_SERVICE],
        },
        {
            provide: LoginUseCase,
            useFactory: (userRepo, hashingService) =>
                new LoginUseCase(userRepo, hashingService),
            inject: [USER_REPOSITORY, HASHING_SERVICE],
        },
        {
            provide: AcceptInviteUseCase,
            useFactory: (inviteRepo, membershipRepo, userRepo, hashingService, configService) =>
                new AcceptInviteUseCase(
                    inviteRepo,
                    membershipRepo,
                    userRepo,
                    hashingService,
                    configService,
                ),
            inject: [
                INVITE_REPOSITORY,
                MEMBERSHIP_REPOSITORY,
                USER_REPOSITORY,
                HASHING_SERVICE,
                ConfigService,
            ],
        },
        {
            provide: ListPrimaryOwnerCompaniesUseCase,
            useFactory: (membershipRepo, companyRepo, userRepo) =>
                new ListPrimaryOwnerCompaniesUseCase(membershipRepo, companyRepo, userRepo),
            inject: [MEMBERSHIP_REPOSITORY, COMPANY_REPOSITORY, USER_REPOSITORY],
        },
        {
            provide: ListMemberCompaniesUseCase,
            useFactory: (membershipRepo, companyRepo, userRepo) =>
                new ListMemberCompaniesUseCase(membershipRepo, companyRepo, userRepo),
            inject: [MEMBERSHIP_REPOSITORY, COMPANY_REPOSITORY, USER_REPOSITORY],
        },
        {
            provide: DeleteAccountUseCase,
            useFactory: (
                userRepo,
                companyRepo,
                membershipRepo,
                domainEvents,
                listPrimaryOwnerCompanies,
                prisma,
                configService,
            ) =>
                new DeleteAccountUseCase(
                    userRepo,
                    companyRepo,
                    membershipRepo,
                    domainEvents,
                    listPrimaryOwnerCompanies,
                    prisma,
                    configService,
                ),
            inject: [
                USER_REPOSITORY,
                COMPANY_REPOSITORY,
                MEMBERSHIP_REPOSITORY,
                "DOMAIN_EVENTS_SERVICE",
                ListPrimaryOwnerCompaniesUseCase,
                PrismaService,
                ConfigService,
            ],
        },
    ],
    exports: [SignupUseCase, LoginUseCase, AcceptInviteUseCase, DeleteAccountUseCase, ListPrimaryOwnerCompaniesUseCase, ListMemberCompaniesUseCase],
})
export class AuthModule {
}

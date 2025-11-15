import {Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {AuthInfraModule} from "@infrastructure/auth/auth-infra.module";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {AuthController} from "@interfaces/http/auth.controller";
import {InvitesController} from "@interfaces/http/invites.controller";
import {SignupUseCase} from "@application/use-cases/signup.usecase";
import {LoginUseCase} from "@application/use-cases/login.usecase";
import {AcceptInviteUseCase} from "@application/use-cases/accept-invite.usecase";
import {DeleteAccountUseCase} from "@application/use-cases/delete-account.usecase";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/list-primary-owner-companies.usecase";
import {USER_REPOSITORY} from "@domain/repositories/user.repository";
import {INVITE_REPOSITORY} from "@domain/repositories/invite.repository";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/membership.repository";
import {HASHING_SERVICE} from "@application/ports/hashing.service";
import {COMPANY_REPOSITORY} from "@domain/repositories/company.repository";

@Module({
    imports: [ConfigModule, AuthInfraModule, InfrastructureModule],
    controllers: [AuthController, InvitesController],
    providers: [
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
            useFactory: (inviteRepo, membershipRepo, userRepo, hashingService) =>
                new AcceptInviteUseCase(
                    inviteRepo,
                    membershipRepo,
                    userRepo,
                    hashingService,
                ),
            inject: [
                INVITE_REPOSITORY,
                MEMBERSHIP_REPOSITORY,
                USER_REPOSITORY,
                HASHING_SERVICE,
            ],
        },
        {
            provide: ListPrimaryOwnerCompaniesUseCase,
            useFactory: (membershipRepo, companyRepo) =>
                new ListPrimaryOwnerCompaniesUseCase(membershipRepo, companyRepo),
            inject: [MEMBERSHIP_REPOSITORY, COMPANY_REPOSITORY],
        },
        {
            provide: DeleteAccountUseCase,
            useFactory: (
                userRepo,
                companyRepo,
                membershipRepo,
                domainEvents,
                listPrimaryOwnerCompanies,
            ) =>
                new DeleteAccountUseCase(
                    userRepo,
                    companyRepo,
                    membershipRepo,
                    domainEvents,
                    listPrimaryOwnerCompanies,
                ),
            inject: [
                USER_REPOSITORY,
                COMPANY_REPOSITORY,
                MEMBERSHIP_REPOSITORY,
                "DOMAIN_EVENTS_SERVICE",
                ListPrimaryOwnerCompaniesUseCase,
            ],
        },
    ],
    exports: [SignupUseCase, LoginUseCase, AcceptInviteUseCase, DeleteAccountUseCase, ListPrimaryOwnerCompaniesUseCase],
})
export class AuthModule {
}

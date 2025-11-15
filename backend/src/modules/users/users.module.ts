import {Module} from '@nestjs/common';
import {InfrastructureModule} from '@infrastructure/infrastructure.module';
import {UsersController} from '@interfaces/http/users/users.controller';
import {SearchUsersUseCase} from '@application/use-cases/users/search-users.usecase';
import {DeleteAccountUseCase} from '@application/use-cases/users/delete-account.usecase';
import {ListPrimaryOwnerCompaniesUseCase} from '@application/use-cases/companys/list-primary-owner-companies.usecase';
import {USER_REPOSITORY} from '@domain/repositories/users/user.repository';
import {COMPANY_REPOSITORY} from '@domain/repositories/companys/company.repository';
import {MEMBERSHIP_REPOSITORY} from '@domain/repositories/memberships/membership.repository';

@Module({
    imports: [InfrastructureModule],
    controllers: [UsersController],
    providers: [
        {
            provide: SearchUsersUseCase,
            useFactory: (userRepo) => new SearchUsersUseCase(userRepo),
            inject: [USER_REPOSITORY],
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
                users,
                companies,
                memberships,
                domainEvents,
                listPrimaryOwnerCompanies,
            ) =>
                new DeleteAccountUseCase(
                    users,
                    companies,
                    memberships,
                    domainEvents,
                    listPrimaryOwnerCompanies,
                ),
            inject: [
                USER_REPOSITORY,
                COMPANY_REPOSITORY,
                MEMBERSHIP_REPOSITORY,
                'DOMAIN_EVENTS_SERVICE',
                ListPrimaryOwnerCompaniesUseCase,
            ],
        },
    ],
    exports: [SearchUsersUseCase],
})
export class UsersModule {
}
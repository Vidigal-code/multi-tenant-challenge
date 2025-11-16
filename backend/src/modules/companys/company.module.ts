import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {AuthInfraModule} from "@infrastructure/auth/modules/auth-infra.module";
import {CompanyController} from "@interfaces/http/companys/company.controller";
import {CompaniesController} from "@interfaces/http/companys/companies.controller";
import {UpdateCompanyUseCase} from "@application/use-cases/companys/update-company.usecase";
import {DeleteCompanyUseCase} from "@application/use-cases/companys/delete-company.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/memberships/leave-company.usecase";
import {CreateCompanyUseCase} from "@application/use-cases/companys/create-company.usecase";
import {ListCompaniesUseCase} from "@application/use-cases/companys/list-companies.usecase";
import {SelectCompanyUseCase} from "@application/use-cases/companys/select-company.usecase";
import {GetCompanyUseCase} from "@application/use-cases/companys/get-company.usecase";
import {USER_REPOSITORY} from "@domain/repositories/users/user.repository";
import {COMPANY_REPOSITORY} from "@domain/repositories/companys/company.repository";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/memberships/membership.repository";

@Module({
    imports: [ConfigModule, InfrastructureModule, AuthInfraModule],
    controllers: [CompanyController, CompaniesController],
    providers: [
        {
            provide: CreateCompanyUseCase,
            useFactory: (companyRepo, userRepo, membershipRepo, configService) =>
                new CreateCompanyUseCase(companyRepo, userRepo, membershipRepo, configService),
            inject: [COMPANY_REPOSITORY, USER_REPOSITORY, MEMBERSHIP_REPOSITORY, ConfigService],
        },
        {
            provide: ListCompaniesUseCase,
            useFactory: (companyRepo) => new ListCompaniesUseCase(companyRepo),
            inject: [COMPANY_REPOSITORY],
        },
        {
            provide: SelectCompanyUseCase,
            useFactory: (membershipRepo, userRepo, configService) =>
                new SelectCompanyUseCase(membershipRepo, userRepo, configService),
            inject: [MEMBERSHIP_REPOSITORY, USER_REPOSITORY, ConfigService],
        },
        {
            provide: GetCompanyUseCase,
            useFactory: (companyRepo, membershipRepo) => new GetCompanyUseCase(companyRepo, membershipRepo),
            inject: [COMPANY_REPOSITORY, MEMBERSHIP_REPOSITORY],
        },
        {
            provide: UpdateCompanyUseCase,
            useFactory: (companyRepo, membershipRepo) => new UpdateCompanyUseCase(companyRepo, membershipRepo),
            inject: [COMPANY_REPOSITORY, MEMBERSHIP_REPOSITORY],
        },
        {
            provide: DeleteCompanyUseCase,
            useFactory: (companyRepo, membershipRepo, userRepo) => new DeleteCompanyUseCase(companyRepo, membershipRepo, userRepo),
            inject: [COMPANY_REPOSITORY, MEMBERSHIP_REPOSITORY, USER_REPOSITORY],
        },
        {
            provide: LeaveCompanyUseCase,
            useFactory: (membershipRepo, domainEvents, configService) => new LeaveCompanyUseCase(membershipRepo, domainEvents, configService),
            inject: [MEMBERSHIP_REPOSITORY, 'DOMAIN_EVENTS_SERVICE', ConfigService],
        },
    ],
})
export class CompanyModule {
}

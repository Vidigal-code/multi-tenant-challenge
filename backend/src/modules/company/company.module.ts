import {Module} from "@nestjs/common";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {AuthInfraModule} from "@infrastructure/auth/auth-infra.module";
import {CompanyController} from "@interfaces/http/company.controller";
import {CompaniesController} from "@interfaces/http/companies.controller";
import {UpdateCompanyUseCase} from "@application/use-cases/update-company.usecase";
import {DeleteCompanyUseCase} from "@application/use-cases/delete-company.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/leave-company.usecase";
import {CreateCompanyUseCase} from "@application/use-cases/create-company.usecase";
import {ListCompaniesUseCase} from "@application/use-cases/list-companies.usecase";
import {SelectCompanyUseCase} from "@application/use-cases/select-company.usecase";
import {GetCompanyUseCase} from "@application/use-cases/get-company.usecase";
import {USER_REPOSITORY} from "@domain/repositories/user.repository";
import {COMPANY_REPOSITORY} from "@domain/repositories/company.repository";
import {MEMBERSHIP_REPOSITORY} from "@domain/repositories/membership.repository";

@Module({
    imports: [InfrastructureModule, AuthInfraModule],
    controllers: [CompanyController, CompaniesController],
    providers: [
        {
            provide: CreateCompanyUseCase,
            useFactory: (companyRepo, userRepo, membershipRepo) =>
                new CreateCompanyUseCase(companyRepo, userRepo, membershipRepo),
            inject: [COMPANY_REPOSITORY, USER_REPOSITORY, MEMBERSHIP_REPOSITORY],
        },
        {
            provide: ListCompaniesUseCase,
            useFactory: (companyRepo) => new ListCompaniesUseCase(companyRepo),
            inject: [COMPANY_REPOSITORY],
        },
        {
            provide: SelectCompanyUseCase,
            useFactory: (membershipRepo, userRepo) =>
                new SelectCompanyUseCase(membershipRepo, userRepo),
            inject: [MEMBERSHIP_REPOSITORY, USER_REPOSITORY],
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
            useFactory: (membershipRepo, domainEvents) => new LeaveCompanyUseCase(membershipRepo, domainEvents),
            inject: [MEMBERSHIP_REPOSITORY, 'DOMAIN_EVENTS_SERVICE'],
        },
    ],
})
export class CompanyModule {
}

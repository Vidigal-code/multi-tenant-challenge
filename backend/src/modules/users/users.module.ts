import { Module } from "@nestjs/common";
import { InfrastructureModule } from "@infrastructure/infrastructure.module";
import { UsersController } from "@interfaces/http/users/users.controller";
import { SearchUsersUseCase } from "@application/use-cases/users/search-users.usecase";
import { DeleteAccountUseCase } from "@application/use-cases/users/delete-account.usecase";
import { ListPrimaryOwnerCompaniesUseCase } from "@application/use-cases/companys/list-primary-owner-companies.usecase";
import { USER_REPOSITORY } from "@domain/repositories/users/user.repository";
import { COMPANY_REPOSITORY } from "@domain/repositories/companys/company.repository";
import { MEMBERSHIP_REPOSITORY } from "@domain/repositories/memberships/membership.repository";
import { PrismaService } from "@infrastructure/prisma/services/prisma.service";

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
      useFactory: (membershipRepo, companyRepo, userRepo) =>
        new ListPrimaryOwnerCompaniesUseCase(
          membershipRepo,
          companyRepo,
          userRepo,
        ),
      inject: [MEMBERSHIP_REPOSITORY, COMPANY_REPOSITORY, USER_REPOSITORY],
    },
    {
      provide: DeleteAccountUseCase,
      useFactory: (
        users,
        companies,
        memberships,
        domainEvents,
        listPrimaryOwnerCompanies,
        prisma,
      ) =>
        new DeleteAccountUseCase(
          users,
          companies,
          memberships,
          domainEvents,
          listPrimaryOwnerCompanies,
          prisma,
        ),
      inject: [
        USER_REPOSITORY,
        COMPANY_REPOSITORY,
        MEMBERSHIP_REPOSITORY,
        "DOMAIN_EVENTS_SERVICE",
        ListPrimaryOwnerCompaniesUseCase,
        PrismaService,
      ],
    },
  ],
  exports: [SearchUsersUseCase],
})
export class UsersModule {}

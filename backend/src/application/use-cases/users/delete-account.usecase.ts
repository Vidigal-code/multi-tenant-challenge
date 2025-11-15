import {UserRepository} from "@domain/repositories/users/user.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/companys/list-primary-owner-companies.usecase";

export interface DeleteAccountInput {
    userId: string;
    deleteCompanyIds?: string[];
}

export class DeleteAccountUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly companies: CompanyRepository,
        private readonly memberships: MembershipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly listPrimaryOwnerCompanies: ListPrimaryOwnerCompaniesUseCase,
    ) {
    }

    async execute(input: DeleteAccountInput) {
        const user = await this.users.findById(input.userId);
        if (!user) throw new ApplicationError(ErrorCode.USER_NOT_FOUND);

        const primaryOwnerCompanies = await this.listPrimaryOwnerCompanies.execute({
            userId: input.userId,
            page: 1,
            pageSize: 1000,
        });

        if (primaryOwnerCompanies.total > 0) {
            if (input.deleteCompanyIds) {
                const companyIdsToDelete = new Set(input.deleteCompanyIds);
                const primaryOwnerCompanyIds = new Set(primaryOwnerCompanies.data.map(c => c.id));
                
                for (const companyId of companyIdsToDelete) {
                    if (!primaryOwnerCompanyIds.has(companyId)) {
                        throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
                    }
                }

                for (const companyId of companyIdsToDelete) {
                    await this.companies.delete(companyId);
                    await this.domainEvents.publish({
                        name: "companys.deleted",
                        payload: {companyId},
                    });
                }

                const remainingCompanies = primaryOwnerCompanies.data.filter(
                    c => !companyIdsToDelete.has(c.id)
                );

                if (remainingCompanies.length > 0) {
                    throw new ApplicationError(ErrorCode.CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES);
                }
            } else {
                throw new ApplicationError(ErrorCode.CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES);
            }
        }

        const userMemberships = await this.memberships.listByUser(input.userId);
        for (const membership of userMemberships) {
            if (input.deleteCompanyIds?.includes(membership.companyId)) {
                continue;
            }

            if (membership.role === Role.OWNER) {
                const ownerCount = await this.memberships.countByCompanyAndRole(
                    membership.companyId,
                    Role.OWNER
                );
                if (ownerCount <= 1) {
                    throw new ApplicationError(ErrorCode.CANNOT_DELETE_LAST_OWNER);
                }
            }
            await this.memberships.remove(membership.id);
        }

        await this.users.deleteById(input.userId);

        await this.domainEvents.publish({
            name: "account.deleted",
            payload: {
                userId: input.userId,
                timestamp: new Date().toISOString(),
            },
        });

        return {deleted: true};
    }
}
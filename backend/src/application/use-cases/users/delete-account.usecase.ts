import {UserRepository} from "@domain/repositories/users/user.repository";
import {CompanyRepository} from "@domain/repositories/companys/company.repository";
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/companys/list-primary-owner-companies.usecase";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface DeleteAccountInput {
    userId: string;
}

export class DeleteAccountUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly users: UserRepository,
        private readonly companies: CompanyRepository,
        private readonly memberships: MembershipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly listPrimaryOwnerCompanies: ListPrimaryOwnerCompaniesUseCase,
        private readonly prisma: PrismaService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(DeleteAccountUseCase.name, configService);
    }

    async execute(input: DeleteAccountInput) {
        const userToDelete = await this.users.findById(input.userId);
        if (!userToDelete) {
            this.logger.default(`Delete account failed: user not found - user: ${input.userId}`);
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

       
        const allPrimaryOwnerCompanies: Array<{ id: string; name: string }> = [];
        let currentPage = 1;
        let hasMore = true;
        let totalCompanies = 0;

        while (hasMore) {
            const result = await this.listPrimaryOwnerCompanies.execute({
                userId: input.userId,
                page: currentPage,
                pageSize: 1000,
            });

            if (currentPage === 1) {
                totalCompanies = result.total;
            }

            if (result.data && result.data.length > 0) {
                allPrimaryOwnerCompanies.push(...result.data);
            }

            hasMore = result.data.length === 1000 && allPrimaryOwnerCompanies.length < totalCompanies;
            currentPage++;

            if (currentPage > 100) {
                break;
            }
        }

        for (const company of allPrimaryOwnerCompanies) {
            await this.companies.delete(company.id);
            await this.domainEvents.publish({
                name: "companys.deleted",
                payload: {companyId: company.id},
            });
        }

        const userMemberships = await this.memberships.listByUser(input.userId);
        for (const membership of userMemberships) {
            if (allPrimaryOwnerCompanies.some(c => c.id === membership.companyId)) {
                continue;
            }

            if (membership.role === Role.OWNER) {
                const ownerCount = await this.memberships.countByCompanyAndRole(
                    membership.companyId,
                    Role.OWNER
                );
                if (ownerCount <= 1) {
                    this.logger.default(`Delete account failed: cannot delete last owner - user:
                     ${input.userId}, company: ${membership.companyId}`);
                    throw new ApplicationError(ErrorCode.CANNOT_DELETE_LAST_OWNER);
                }
            }

            await this.memberships.remove(membership.id);
        }

        await (this.prisma as any).notification.deleteMany({
            where: {
                OR: [
                    { senderUserId: input.userId },
                    { recipientUserId: input.userId },
                ],
            },
        });

        await this.prisma.friendship.deleteMany({
            where: {
                OR: [
                    { requesterId: input.userId },
                    { addresseeId: input.userId },
                ],
            },
        });

        await this.prisma.invite.deleteMany({
            where: {
                inviterId: input.userId,
            },
        });

        if (userToDelete && userToDelete.email) {
            await this.prisma.invite.deleteMany({
                where: {
                    email: userToDelete.email.toString(),
                },
            });
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
import {MembershipRepository} from "@domain/repositories/memberships/membership.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {Role} from "@domain/enums/role.enum";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

export interface TransferOwnershipInput {
    requesterId: string;
    companyId: string;
    newOwnerId: string;
}

export class TransferOwnershipUseCase {
    private readonly logger: LoggerService;

    constructor(
        private readonly memberships: MembershipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(TransferOwnershipUseCase.name, configService);
    }

    async execute(input: TransferOwnershipInput) {

        const requesterMembership = await this.memberships.findByUserAndCompany(
            input.requesterId,
            input.companyId,
        );
        if (!requesterMembership || requesterMembership.role !== Role.OWNER) {
            this.logger.default(`Transfer ownership failed: only owner can transfer - requester: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.ONLY_OWNER_CAN_TRANSFER);
        }

        const newOwnerMembership = await this.memberships.findByUserAndCompany(
            input.newOwnerId,
            input.companyId,
        );
        if (!newOwnerMembership) {
            this.logger.default(`Transfer ownership failed: new owner is not a member - newOwner: ${input.newOwnerId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.NEW_OWNER_NOT_MEMBER);
        }

        if (input.requesterId === input.newOwnerId) {
            this.logger.default(`Transfer ownership failed: cannot transfer to self - requester: ${input.requesterId}, company: ${input.companyId}`);
            throw new ApplicationError(ErrorCode.CANNOT_TRANSFER_TO_SELF);
        }

        await (this.memberships as any).updateRole?.(requesterMembership.id, Role.ADMIN);
        await (this.memberships as any).updateRole?.(newOwnerMembership.id, Role.OWNER);

        await this.domainEvents.publish({
            name: "ownership.transferred",
            payload: {
                companyId: input.companyId,
                oldOwnerId: input.requesterId,
                newOwnerId: input.newOwnerId,
                timestamp: new Date().toISOString(),
            },
        });

        return {success: true};
    }
}
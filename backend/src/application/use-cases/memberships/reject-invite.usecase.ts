import {InviteRepository} from "@domain/repositories/invites/invite.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {InviteStatus} from "@domain/enums/invite-status.enum";

export interface RejectInviteInput {
    inviteId: string;
    userId: string;
    reason?: string;
}

export class RejectInviteUseCase {
    constructor(
        private readonly inviteRepo: InviteRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: RejectInviteInput) {
        const invite = await this.inviteRepo.findByToken(input.inviteId);

        if (!invite) throw new ApplicationError(ErrorCode.INVITE_NOT_FOUND);
        if (invite.status !== InviteStatus.PENDING) {
            throw new ApplicationError(ErrorCode.INVITE_NOT_PENDING);
        }

        await this.inviteRepo.updateStatus(invite.id, InviteStatus.REJECTED);
        await this.domainEvents.publish({
            name: "invites.rejected",
            payload: {inviteId: invite.id, companyId: invite.companyId},
        });
        return {success: true};
    }
}

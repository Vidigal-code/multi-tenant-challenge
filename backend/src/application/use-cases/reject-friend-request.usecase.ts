import {FriendshipRepository} from "@domain/repositories/friendship.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {FriendshipStatus} from "@domain/entities/friendship.entity";

export interface RejectFriendRequestInput {
    friendshipId: string;
    userId: string;
}

export class RejectFriendRequestUseCase {
    constructor(
        private readonly friendships: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: RejectFriendRequestInput) {
        const friendship = await this.friendships.findById(input.friendshipId);
        if (!friendship) {
            throw new ApplicationError("FRIENDSHIP_NOT_FOUND");
        }

        if (friendship.addresseeId !== input.userId) {
            throw new ApplicationError("CANNOT_REJECT_OTHERS_REQUEST");
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new ApplicationError("FRIENDSHIP_NOT_PENDING");
        }

        await this.friendships.delete(input.friendshipId);

        await this.domainEvents.publish({
            name: "friend.request.rejected",
            payload: {
                friendshipId: input.friendshipId,
                requesterId: friendship.requesterId,
                addresseeId: friendship.addresseeId,
            },
        });

        return {success: true};
    }
}
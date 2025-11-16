import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {EventPayloadBuilderService} from "@application/services/event-payload-builder.service";

export interface RejectFriendRequestInput {
    friendshipId: string;
    userId: string;
}

export class RejectFriendRequestUseCase {
    constructor(
        private readonly friendships: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly eventBuilder: EventPayloadBuilderService,
    ) {
    }

    async execute(input: RejectFriendRequestInput) {
        const friendship = await this.friendships.findById(input.friendshipId);
        if (!friendship) {
            throw new ApplicationError(ErrorCode.FRIENDSHIP_NOT_FOUND);
        }

        if (friendship.addresseeId !== input.userId) {
            throw new ApplicationError(ErrorCode.CANNOT_REJECT_OTHERS_REQUEST);
        }

        if (friendship.status !== FriendshipStatus.PENDING) {
            throw new ApplicationError(ErrorCode.FRIENDSHIP_NOT_PENDING);
        }

        await this.friendships.delete(input.friendshipId);

        const eventPayload = await this.eventBuilder.build({
            eventId: "FRIEND_REQUEST_REJECTED",
            senderId: input.userId,
            receiverId: friendship.requesterId,
            additionalData: {
                friendshipId: input.friendshipId,
                requesterId: friendship.requesterId,
                addresseeId: friendship.addresseeId,
            },
        });

        await this.domainEvents.publish({
            name: "friend.request.rejected",
            payload: eventPayload,
        });

        return {success: true};
    }
}
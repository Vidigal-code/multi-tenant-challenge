import {FriendshipRepository} from "@domain/repositories/friendships/friendship.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {EventPayloadBuilderService} from "@application/services/event-payload-builder.service";

export interface DeleteFriendshipInput {
    friendshipId: string;
    userId: string;
}

export class DeleteFriendshipUseCase {
    constructor(
        private readonly friendships: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
        private readonly eventBuilder: EventPayloadBuilderService,
    ) {
    }

    async execute(input: DeleteFriendshipInput) {
        const friendship = await this.friendships.findById(input.friendshipId);
        if (!friendship) {
            throw new ApplicationError(ErrorCode.FRIENDSHIP_NOT_FOUND);
        }

        if (friendship.requesterId !== input.userId && friendship.addresseeId !== input.userId) {
            throw new ApplicationError(ErrorCode.FORBIDDEN_ACTION);
        }

        await this.friendships.delete(input.friendshipId);

        const recipientId = friendship.requesterId === input.userId 
            ? friendship.addresseeId 
            : friendship.requesterId;

        const eventPayload = await this.eventBuilder.build({
            eventId: "FRIEND_REMOVED",
            senderId: input.userId,
            receiverId: recipientId,
            additionalData: {
                friendshipId: input.friendshipId,
                requesterId: friendship.requesterId,
                addresseeId: friendship.addresseeId,
                userId: input.userId,
            },
        });

        await this.domainEvents.publish({
            name: "friend.removed",
            payload: eventPayload,
        });

        return {success: true};
    }
}


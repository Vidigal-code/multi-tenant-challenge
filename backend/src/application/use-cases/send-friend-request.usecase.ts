import {UserRepository} from "@domain/repositories/user.repository";
import {FriendshipRepository} from "@domain/repositories/friendship.repository";
import {DomainEventsService} from "@domain/services/domain-events.service";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {FriendshipStatus} from "@domain/entities/friendship.entity";

export interface SendFriendRequestInput {
    requesterId: string;
    addresseeEmail: string;
}

export class SendFriendRequestUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly friendships: FriendshipRepository,
        private readonly domainEvents: DomainEventsService,
    ) {
    }

    async execute(input: SendFriendRequestInput) {

        const requester = await this.users.findById(input.requesterId);
        if (!requester) {
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        if (requester.email.toString() === input.addresseeEmail.toLowerCase().trim()) {
            throw new ApplicationError(ErrorCode.CANNOT_ADD_YOURSELF);
        }

        const addressee = await this.users.findByEmail(input.addresseeEmail);
        if (!addressee) {
            throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
        }

        const existingFriendship = await this.friendships.findByUsers(input.requesterId, addressee.id);
        if (existingFriendship) {
            if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
                throw new ApplicationError(ErrorCode.ALREADY_FRIENDS);
            }
            if (existingFriendship.status === FriendshipStatus.PENDING) {
                throw new ApplicationError(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
            }
            if (existingFriendship.status === FriendshipStatus.BLOCKED) {
                throw new ApplicationError(ErrorCode.USER_BLOCKED);
            }
        }

        const friendship = await this.friendships.create({
            requesterId: input.requesterId,
            addresseeId: addressee.id,
        });

        await this.domainEvents.publish({
            name: "friend.request.sent",
            payload: {
                friendshipId: friendship.id,
                requesterId: input.requesterId,
                addresseeId: addressee.id,
            },
        });

        return {friendship};
    }
}
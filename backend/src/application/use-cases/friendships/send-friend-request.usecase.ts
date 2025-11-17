import { UserRepository } from "@domain/repositories/users/user.repository";
import { FriendshipRepository } from "@domain/repositories/friendships/friendship.repository";
import { DomainEventsService } from "@domain/services/domain-events.service";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { FriendshipStatus } from "@domain/entities/friendships/friendship.entity";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { EventPayloadBuilderService } from "@application/services/event-payload-builder.service";

export interface SendFriendRequestInput {
  requesterId: string;
  addresseeEmail: string;
}

export class SendFriendRequestUseCase {
  private readonly logger: LoggerService;

  constructor(
    private readonly users: UserRepository,
    private readonly friendships: FriendshipRepository,
    private readonly domainEvents: DomainEventsService,
    private readonly eventBuilder: EventPayloadBuilderService,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(
      SendFriendRequestUseCase.name,
      configService,
    );
  }

  async execute(input: SendFriendRequestInput) {
    const requester = await this.users.findById(input.requesterId);
    if (!requester) {
      this.logger.default(
        `Friend request failed: requester not found - user: ${input.requesterId}`,
      );
      throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
    }

    if (
      requester.email.toString() === input.addresseeEmail.toLowerCase().trim()
    ) {
      this.logger.default(
        `Friend request failed: cannot add yourself - user: ${input.requesterId}`,
      );
      throw new ApplicationError(ErrorCode.CANNOT_ADD_YOURSELF);
    }

    const addressee = await this.users.findByEmail(input.addresseeEmail);
    if (!addressee) {
      this.logger.default(
        `Friend request failed: addressee not found - email: ${input.addresseeEmail}`,
      );
      throw new ApplicationError(ErrorCode.USER_NOT_FOUND);
    }

    const existingFriendship = await this.friendships.findByUsers(
      input.requesterId,
      addressee.id,
    );
    if (existingFriendship) {
      if (existingFriendship.status === FriendshipStatus.ACCEPTED) {
        this.logger.default(
          `Friend request failed: already friends - requester: ${input.requesterId}, addressee: ${addressee.id}`,
        );
        throw new ApplicationError(ErrorCode.ALREADY_FRIENDS);
      }
      if (existingFriendship.status === FriendshipStatus.PENDING) {
        this.logger.default(
          `Friend request failed: request already sent - requester: ${input.requesterId}, addressee: ${addressee.id}`,
        );
        throw new ApplicationError(ErrorCode.FRIEND_REQUEST_ALREADY_SENT);
      }
      if (existingFriendship.status === FriendshipStatus.BLOCKED) {
        this.logger.default(
          `Friend request failed: user blocked - requester: ${input.requesterId}, addressee: ${addressee.id}`,
        );
        throw new ApplicationError(ErrorCode.USER_BLOCKED);
      }
    }

    const friendship = await this.friendships.create({
      requesterId: input.requesterId,
      addresseeId: addressee.id,
    });

    const eventPayload = await this.eventBuilder.build({
      eventId: "FRIEND_REQUEST_SENT",
      senderId: input.requesterId,
      receiverId: addressee.id,
      additionalData: {
        friendshipId: friendship.id,
        requesterId: input.requesterId,
        addresseeId: addressee.id,
      },
    });

    await this.domainEvents.publish({
      name: "friend.request.sent",
      payload: eventPayload,
    });

    return { friendship };
  }
}

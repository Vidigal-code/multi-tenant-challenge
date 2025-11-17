import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@common/guards/jwt.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { SendFriendRequestUseCase } from "@application/use-cases/friendships/send-friend-request.usecase";
import { AcceptFriendRequestUseCase } from "@application/use-cases/friendships/accept-friend-request.usecase";
import { RejectFriendRequestUseCase } from "@application/use-cases/friendships/reject-friend-request.usecase";
import { DeleteFriendshipUseCase } from "@application/use-cases/friendships/delete-friendship.usecase";
import { ListFriendshipsUseCase } from "@application/use-cases/friendships/list-friendships.usecase";
import { SearchUsersUseCase } from "@application/use-cases/users/search-users.usecase";
import {
  AcceptFriendRequestDto,
  ListFriendshipsDto,
  RejectFriendRequestDto,
  SendFriendRequestDto,
} from "@application/dto/friendships/friendship.dto";
import { ErrorResponse } from "@application/dto/errors/error.response.dto";
import { SuccessCode } from "@application/success/success-code";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { QueryProducer } from "@infrastructure/messaging/producers/query.producer";
import { randomUUID } from "crypto";

@ApiTags("friendships")
@ApiCookieAuth()
@Controller("friendships")
@UseGuards(JwtAuthGuard)
export class FriendshipController {
  constructor(
    private readonly sendFriendRequest: SendFriendRequestUseCase,
    private readonly acceptFriendRequest: AcceptFriendRequestUseCase,
    private readonly rejectFriendRequest: RejectFriendRequestUseCase,
    private readonly deleteFriendship: DeleteFriendshipUseCase,
    private readonly listFriendships: ListFriendshipsUseCase,
    private readonly searchUsers: SearchUsersUseCase,
    private readonly cache: RedisQueryCacheService,
    private readonly queryProducer: QueryProducer,
  ) {}

  @Post("request")
  @ApiOperation({ summary: "Send friend request" })
  @ApiResponse({ status: 201, description: "Friend request sent" })
  @ApiResponse({
    status: 400,
    description: "Invalid request",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 409,
    description: "Already friends or request exists",
    type: ErrorResponse,
  })
  async sendRequest(
    @CurrentUser() user: any,
    @Body() body: SendFriendRequestDto,
  ) {
    const { friendship } = await this.sendFriendRequest.execute({
      requesterId: user.sub,
      addresseeEmail: body.email,
    });
    return {
      friendship: friendship.toJSON(),
      code: SuccessCode.FRIEND_REQUEST_SENT,
    };
  }

  @Post("accept")
  @ApiOperation({ summary: "Accept friend request" })
  @ApiResponse({ status: 200, description: "Friend request accepted" })
  @ApiResponse({
    status: 400,
    description: "Invalid request",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: "Cannot accept others' requests",
    type: ErrorResponse,
  })
  async acceptRequest(
    @CurrentUser() user: any,
    @Body() body: AcceptFriendRequestDto,
  ) {
    const { friendship } = await this.acceptFriendRequest.execute({
      friendshipId: body.friendshipId,
      userId: user.sub,
    });
    return {
      friendship: friendship.toJSON(),
      code: SuccessCode.FRIEND_REQUEST_ACCEPTED,
    };
  }

  @Post(":friendshipId/accept")
  @ApiOperation({ summary: "Accept friend request by ID" })
  @ApiResponse({ status: 200, description: "Friend request accepted" })
  @ApiResponse({
    status: 400,
    description: "Invalid request",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: "Cannot accept others' requests",
    type: ErrorResponse,
  })
  async acceptRequestById(
    @CurrentUser() user: any,
    @Param("friendshipId") friendshipId: string,
  ) {
    const { friendship } = await this.acceptFriendRequest.execute({
      friendshipId,
      userId: user.sub,
    });
    return {
      friendship: friendship.toJSON(),
      code: SuccessCode.FRIEND_REQUEST_ACCEPTED,
    };
  }

  @Post("reject")
  @ApiOperation({ summary: "Reject friend request" })
  @ApiResponse({ status: 200, description: "Friend request rejected" })
  @ApiResponse({
    status: 400,
    description: "Invalid request",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: "Cannot reject others' requests",
    type: ErrorResponse,
  })
  async rejectRequest(
    @CurrentUser() user: any,
    @Body() body: RejectFriendRequestDto,
  ) {
    await this.rejectFriendRequest.execute({
      friendshipId: body.friendshipId,
      userId: user.sub,
    });
    return { success: true };
  }

  @Delete(":friendshipId")
  @ApiOperation({
    summary: "Delete friendships (any status) or reject friend request",
  })
  @ApiResponse({ status: 200, description: "Friendship deleted" })
  @ApiResponse({
    status: 400,
    description: "Invalid request",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: "Cannot delete others' friendships",
    type: ErrorResponse,
  })
  async deleteFriendshipEndpoint(
    @CurrentUser() user: any,
    @Param("friendshipId") friendshipId: string,
  ) {
    await this.deleteFriendship.execute({
      friendshipId,
      userId: user.sub,
    });
    return { success: true };
  }

  @Get()
  @ApiOperation({ summary: "List users's friendships" })
  @ApiResponse({ status: 200, description: "Friendships listed" })
  async list(@CurrentUser() user: any, @Query() query: ListFriendshipsDto) {
    const params = {
      status: query.status,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
    };

    const cached = await this.cache.get("/friendships", params);
    if (cached) {
      return cached;
    }

    const requestId = randomUUID();
    await this.queryProducer.queueQuery("/friendships", params, user.sub, requestId);

    const workerResult = await this.cache.waitForCache("/friendships", params, 2000);
    if (workerResult) {
      return workerResult;
    }

    const result = await this.listFriendships.execute({
      userId: user.sub,
      status: params.status as any,
      page: params.page,
      pageSize: params.pageSize,
    });
    const friendships = result.data.map((f) => {
      const json = f.toJSON();
      const record = (result as any).recordsWithUsers?.find(
        (r: any) => r.id === f.id,
      );
      if (record) {
        return {
          ...json,
          requester: {
            id: record.requester.id,
            name: record.requester.name,
            email: record.requester.email,
          },
          addressee: {
            id: record.addressee.id,
            name: record.addressee.name,
            email: record.addressee.email,
          },
        };
      }
      return json;
    });
    const response = {
      data: friendships,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
    await this.cache.set("/friendships", params, response);
    return response;
  }

  @Get("search")
  @ApiOperation({ summary: "Search users by name or email" })
  @ApiResponse({ status: 200, description: "Users found" })
  async search(@CurrentUser() user: any, @Query("q") query: string) {
    const params = { q: query, currentUserId: user.sub };

    const cached = await this.cache.get("/users/search", params);
    if (cached) {
      return cached;
    }

    const requestId = randomUUID();
    await this.queryProducer.queueQuery("/users/search", params, user.sub, requestId);

    const workerResult = await this.cache.waitForCache("/users/search", params, 2000);
    if (workerResult) {
      return workerResult;
    }

    const result = await this.searchUsers.execute({
      query,
      currentUserId: user.sub,
    });
    await this.cache.set("/users/search", params, result);
    return result;
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@common/guards/jwt.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { User } from "@prisma/client";
import { SearchUsersUseCase } from "@application/use-cases/users/search-users.usecase";
import { DeleteAccountUseCase } from "@application/use-cases/users/delete-account.usecase";
import { BatchOperationsProducer } from "@infrastructure/messaging/producers/batch-operations.producer";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { QueryProducer } from "@infrastructure/messaging/producers/query.producer";
import { randomUUID } from "crypto";

@ApiTags("users")
@ApiCookieAuth()
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly batchOperationsProducer: BatchOperationsProducer,
    private readonly cache: RedisQueryCacheService,
    private readonly queryProducer: QueryProducer,
  ) {}

  @Get("search")
  @ApiOperation({ summary: "Search users by name or email" })
  @ApiQuery({ name: "q", description: "Search query for name or email" })
  @ApiResponse({ status: 200, description: "List of matching users" })
  async searchUsers(@Query("q") query: string, @CurrentUser() user: User) {
    const params = { q: query, currentUserId: user.id };

    const cached = await this.cache.get("/users/search", params);
    if (cached) {
      return cached;
    }

    const requestId = randomUUID();
    await this.queryProducer.queueQuery("/users/search", params, user.id, requestId);

    const workerResult = await this.cache.waitForCache("/users/search", params, 2000);
    if (workerResult) {
      return workerResult;
    }

    const result = await this.searchUsersUseCase.execute({
      query,
      currentUserId: user.id,
    });
    await this.cache.set("/users/search", params, result);
    return result;
  }

  @Delete("me")
  @ApiOperation({
    summary:
      "Delete current users account. Automatically deletes all companies where user is primary owner and removes user from all companies where they are ADMIN or MEMBER.",
  })
  @ApiResponse({ status: 200, description: "Account deleted successfully" })
  @ApiResponse({
    status: 400,
    description: "Cannot delete account (e.g., last owner of a company)",
  })
  async deleteAccount(
    @CurrentUser() user: User,
    @Body() body?: { deleteCompanyIds?: string[] },
  ) {
    const requestId = randomUUID();
    await this.batchOperationsProducer.queueDeleteAccount(
      user.id,
      requestId,
      body?.deleteCompanyIds,
    );
    await this.cache.invalidate("query:*");
    return { message: "Account deletion queued", queued: true, requestId };
  }
}

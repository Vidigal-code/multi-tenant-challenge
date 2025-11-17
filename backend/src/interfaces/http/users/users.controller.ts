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

@ApiTags("users")
@ApiCookieAuth()
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly searchUsersUseCase: SearchUsersUseCase,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
  ) {}

  @Get("search")
  @ApiOperation({ summary: "Search users by name or email" })
  @ApiQuery({ name: "q", description: "Search query for name or email" })
  @ApiResponse({ status: 200, description: "List of matching users" })
  async searchUsers(@Query("q") query: string, @CurrentUser() user: User) {
    return this.searchUsersUseCase.execute({
      query,
      currentUserId: user.id,
    });
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
  async deleteAccount(@CurrentUser() user: User) {
    await this.deleteAccountUseCase.execute({
      userId: user.id,
    });
    return { message: "Account deleted successfully" };
  }
}

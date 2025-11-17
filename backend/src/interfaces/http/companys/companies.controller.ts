import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@common/guards/jwt.guard";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { ListCompaniesUseCase } from "@application/use-cases/companys/list-companies.usecase";

@ApiTags("company")
@ApiCookieAuth()
@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly listCompaniesUseCase: ListCompaniesUseCase) {}

  @Get()
  @ApiOperation({ summary: "List companies users belongs to (alias)" })
  @ApiResponse({ status: 200, description: "Companies listed" })
  async list(
    @CurrentUser() user: any,
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 10,
  ) {
    return this.listCompaniesUseCase.execute({
      userId: user.sub,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }
}

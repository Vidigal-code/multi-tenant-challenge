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
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { QueryProducer } from "@infrastructure/messaging/producers/query.producer";
import { randomUUID } from "crypto";

@ApiTags("company")
@ApiCookieAuth()
@Controller("companies")
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(
    private readonly listCompaniesUseCase: ListCompaniesUseCase,
    private readonly cache: RedisQueryCacheService,
    private readonly queryProducer: QueryProducer,
  ) {}

  @Get()
  @ApiOperation({ summary: "List companies users belongs to (alias)" })
  @ApiResponse({ status: 200, description: "Companies listed" })
  async list(
    @CurrentUser() user: any,
    @Query("page") page = 1,
    @Query("pageSize") pageSize = 10,
  ) {
    const params = {
      page: Number(page),
      pageSize: Number(pageSize),
    };

    const cached = await this.cache.get("/companies", params);
    if (cached) {
      return cached;
    }

    const requestId = randomUUID();
    await this.queryProducer.queueQuery("/companies", params, user.sub, requestId);

    const workerResult = await this.cache.waitForCache("/companies", params, 2000);
    if (workerResult) {
      return workerResult;
    }

    const result = await this.listCompaniesUseCase.execute({
      userId: user.sub,
      page: params.page,
      pageSize: params.pageSize,
    });
    await this.cache.set("/companies", params, result);
    return result;
  }
}

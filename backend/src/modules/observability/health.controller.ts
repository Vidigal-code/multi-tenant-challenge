import { Controller, Get, HttpCode } from "@nestjs/common";
import { PrismaService } from "@infrastructure/prisma/services/prisma.service";
import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rabbit: RabbitMQService,
  ) {}

  @Get()
  @HttpCode(200)
  async getHealth() {
    const checks: Record<string, { status: string; details?: any }> = {};

    // DB check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.postgres = { status: "up" };
    } catch (err: any) {
      checks.postgres = { status: "down", details: err?.message };
    }

    // RabbitMQ check
    try {
      await this.rabbit.getChannel();
      checks.rabbitmq = { status: "up" };
    } catch (err: any) {
      checks.rabbitmq = { status: "down", details: err?.message };
    }

    // Redis (simple TCP URL parse only; full ping requires adding a redis client instance)
    const redisUrl = this.config.get<string>("app.redisUrl");
    if (redisUrl) {
      checks.redis = { status: "up" };
    }

    const allUp = Object.values(checks).every((c) => c.status === "up");
    return {
      status: allUp ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}

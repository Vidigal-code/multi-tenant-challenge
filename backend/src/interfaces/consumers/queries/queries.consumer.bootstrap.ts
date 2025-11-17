import * as dotenv from "dotenv";
dotenv.config();

import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { QueriesConsumer } from "./queries.consumer";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { INVITE_REPOSITORY } from "@domain/repositories/invites/invite.repository";
import { NOTIFICATION_REPOSITORY } from "@domain/repositories/notifications/notification.repository";
import { COMPANY_REPOSITORY } from "@domain/repositories/companys/company.repository";
import { MEMBERSHIP_REPOSITORY } from "@domain/repositories/memberships/membership.repository";
import { FRIENDSHIP_REPOSITORY } from "@domain/repositories/friendships/friendship.repository";
import { USER_REPOSITORY } from "@domain/repositories/users/user.repository";

async function bootstrap(): Promise<void> {
  const config = new ConfigService();
  const logger = new LoggerService("QueriesConsumerBootstrap", config);
  logger.default("Starting queries consumer worker...");

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const rabbitService = app.get(RabbitMQService);
    const cacheService = app.get(RedisQueryCacheService);
    const invitesRepo = app.get(INVITE_REPOSITORY);
    const notificationsRepo = app.get(NOTIFICATION_REPOSITORY);
    const companiesRepo = app.get(COMPANY_REPOSITORY);
    const membershipsRepo = app.get(MEMBERSHIP_REPOSITORY);
    const friendshipsRepo = app.get(FRIENDSHIP_REPOSITORY);
    const usersRepo = app.get(USER_REPOSITORY);

    if (!invitesRepo || !notificationsRepo || !companiesRepo || !membershipsRepo || !friendshipsRepo || !usersRepo) {
      throw new Error("Failed to get required repositories from application context");
    }

    const consumer = new QueriesConsumer(
      rabbitService,
      config,
      cacheService,
      invitesRepo,
      notificationsRepo,
      companiesRepo,
      membershipsRepo,
      friendshipsRepo,
      usersRepo,
    );

    await consumer.start();
    logger.default("Queries consumer worker started and listening.");

    process.on("SIGTERM", async () => {
      logger.default("SIGTERM received, shutting down gracefully...");
      await app.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.default("SIGINT received, shutting down gracefully...");
      await app.close();
      process.exit(0);
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error(`Failed to start queries consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}


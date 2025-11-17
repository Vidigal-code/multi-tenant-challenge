import * as dotenv from "dotenv";
dotenv.config();

import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { DeleteAccountConsumer } from "./delete-account.consumer";
import { DeleteAccountUseCase } from "@application/use-cases/users/delete-account.usecase";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";

async function bootstrap(): Promise<void> {
  const config = new ConfigService();
  const logger = new LoggerService("DeleteAccountConsumerBootstrap", config);
  logger.default("Starting delete account consumer worker...");

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const rabbitService = app.get(RabbitMQService);
    const deleteAccountUseCase = app.get(DeleteAccountUseCase);
    const cacheService = app.get(RedisQueryCacheService);

    const consumer = new DeleteAccountConsumer(
      rabbitService,
      config,
      deleteAccountUseCase,
      cacheService,
    );

    await consumer.start();
    logger.default("Delete account consumer worker started and listening.");

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
    logger.error(`Failed to start delete account consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}


import * as dotenv from "dotenv";
dotenv.config();

import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { ClearAllNotificationsConsumer } from "./clear-all-notifications.consumer";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { NOTIFICATION_REPOSITORY } from "@domain/repositories/notifications/notification.repository";

async function bootstrap(): Promise<void> {
  const config = new ConfigService();
  const logger = new LoggerService("ClearAllNotificationsConsumerBootstrap", config);
  logger.default("Starting clear all notifications consumer worker...");

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const rabbitService = app.get(RabbitMQService);
    const notificationsRepo = app.get(NOTIFICATION_REPOSITORY);

    if (!notificationsRepo) {
      throw new Error("Failed to get NOTIFICATION_REPOSITORY from application context");
    }

    const consumer = new ClearAllNotificationsConsumer(
      rabbitService,
      config,
      notificationsRepo,
    );

    await consumer.start();
    logger.default("Clear all notifications consumer worker started and listening.");

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
    logger.error(`Failed to start clear all notifications consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}


import * as dotenv from "dotenv";
dotenv.config();

import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { RejectAllInvitesConsumer } from "./reject-all-invites.consumer";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../../app.module";
import { INVITE_REPOSITORY } from "@domain/repositories/invites/invite.repository";

async function bootstrap(): Promise<void> {
  const config = new ConfigService();
  const logger = new LoggerService("RejectAllInvitesConsumerBootstrap", config);
  logger.default("Starting reject all invites consumer worker...");

  try {
    const app = await NestFactory.createApplicationContext(AppModule);
    const rabbitService = app.get(RabbitMQService);
    const invitesRepo = app.get(INVITE_REPOSITORY);

    if (!invitesRepo) {
      throw new Error("Failed to get INVITE_REPOSITORY from application context");
    }

    const consumer = new RejectAllInvitesConsumer(
      rabbitService,
      config,
      invitesRepo,
    );

    await consumer.start();
    logger.default("Reject all invites consumer worker started and listening.");

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
    logger.error(`Failed to start reject all invites consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}


import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import {
  CLEAR_ALL_NOTIFICATIONS_QUEUE,
  CLEAR_ALL_NOTIFICATIONS_DLQ,
} from "@infrastructure/messaging/producers/batch-operations.producer";
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from "@domain/repositories/notifications/notification.repository";
import { Inject } from "@nestjs/common";

interface ClearAllNotificationsPayload {
  userId: string;
  requestId: string;
  notificationIds: string[];
  timestamp: string;
}

/**
 * ClearAllNotificationsConsumer - Consumer for processing clear all notifications operations
 *
 * Architecture for high-scale notification cleanup:
 * - Processes batch notification deletion requests asynchronously
 * - Handles multiple notifications in a single operation
 * - Prevents blocking HTTP requests for batch operations
 *
 * Batch Processing:
 * - Processes deletions in batches to avoid overwhelming the database
 * - Deletes notifications efficiently
 * - Tracks progress via request IDs
 *
 * For high-scale:
 * - Multiple workers can process deletions in parallel
 * - Batch size configurable via environment variables
 * - Monitor processing time and adjust batch size
 *
 * Consumer para processar operações de limpar todas as notificações
 *
 * Arquitetura para limpeza de notificações de alta escala:
 * - Processa requisições de exclusão de notificações em lote de forma assíncrona
 * - Trata múltiplas notificações em uma única operação
 * - Previne bloqueio de requisições HTTP para operações em lote
 *
 * Processamento em Lote:
 * - Processa exclusões em lotes para evitar sobrecarregar o banco de dados
 * - Exclui notificações eficientemente
 * - Rastreia progresso via IDs de requisição
 *
 * Para alta escala:
 * - Múltiplos workers podem processar exclusões em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore tempo de processamento e ajuste tamanho do lote
 */
@Injectable()
export class ClearAllNotificationsConsumer extends BaseResilientConsumer<ClearAllNotificationsPayload> {
  private readonly batchSize: number;

  constructor(
    rabbit: RabbitMQService,
    configService: ConfigService,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
  ) {
    const redisUrl =
      (configService.get("app.redisUrl") as string) ||
      process.env.REDIS_URL ||
      "redis://localhost:6379";
    const prefetch = parseInt(
      process.env.RABBITMQ_PREFETCH || "50",
      10,
    );
    const retryMax = parseInt(
      process.env.RABBITMQ_RETRY_MAX || "5",
      10,
    );

    super(rabbit, {
      queue: CLEAR_ALL_NOTIFICATIONS_QUEUE,
      dlq: CLEAR_ALL_NOTIFICATIONS_DLQ,
      prefetch,
      retryMax,
      redisUrl,
      dedupTtlSeconds: 300,
    }, configService);

    this.batchSize = parseInt(
      process.env.NOTIFICATION_BATCH_SIZE || "50",
      10,
    );
  }

  protected dedupKey(payload: ClearAllNotificationsPayload): string | null {
    return `clear-all-notifications:${payload.userId}:${payload.requestId}`;
  }

  protected async process(
    payload: ClearAllNotificationsPayload,
  ): Promise<void> {
    this.logger.default(
      `Processing clear all notifications operation: userId=${payload.userId}, count=${payload.notificationIds.length || "all"}, requestId=${payload.requestId}`,
    );

    if (payload.notificationIds.length === 0) {
      const allNotifications = await this.notifications.listByUser({
        userId: payload.userId,
        page: 1,
        pageSize: 10000,
      });
      const batches = this.chunkArray(
        allNotifications.data.map((n) => n.id),
        this.batchSize,
      );

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await Promise.all(
          batch.map(async (notificationId) => {
            try {
              await this.notifications.delete(notificationId);
            } catch (error) {
              this.logger.error(
                `Failed to delete notification ${notificationId}: ${String(error)}`,
              );
            }
          }),
        );

        this.logger.default(
          `Processed batch ${i + 1}/${batches.length} of notification deletions`,
        );
      }
    } else {
      const batches = this.chunkArray(payload.notificationIds, this.batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        await Promise.all(
          batch.map(async (notificationId) => {
            try {
              const notification = await this.notifications.findById(
                notificationId,
              );
              if (
                notification &&
                (notification.recipientUserId === payload.userId ||
                  notification.senderUserId === payload.userId)
              ) {
                await this.notifications.delete(notificationId);
              }
            } catch (error) {
              this.logger.error(
                `Failed to delete notification ${notificationId}: ${String(error)}`,
              );
            }
          }),
        );

        this.logger.default(
          `Processed batch ${i + 1}/${batches.length} of notification deletions`,
        );
      }
    }

    this.logger.default(
      `Clear all notifications operation completed: userId=${payload.userId}, requestId=${payload.requestId}`,
    );
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}


import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "../services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";

export const DELETE_ACCOUNT_QUEUE = "operations.delete-account";
export const DELETE_ACCOUNT_DLQ = "dlq.operations.delete-account";

export const REJECT_ALL_INVITES_QUEUE = "operations.reject-all-invites";
export const REJECT_ALL_INVITES_DLQ = "dlq.operations.reject-all-invites";

export const DELETE_ALL_INVITES_QUEUE = "operations.delete-all-invites";
export const DELETE_ALL_INVITES_DLQ = "dlq.operations.delete-all-invites";

export const CLEAR_ALL_NOTIFICATIONS_QUEUE = "operations.clear-all-notifications";
export const CLEAR_ALL_NOTIFICATIONS_DLQ = "dlq.operations.clear-all-notifications";

/**
 * BatchOperationsProducer - Producer for batch operations via RabbitMQ
 *
 * Architecture for high-scale batch operations:
 * - Queues heavy operations for asynchronous processing
 * - Prevents blocking HTTP requests for long-running operations
 * - Supports batch processing with progress tracking
 *
 * Queue Strategy:
 * - Heavy operations are queued immediately
 * - Workers process operations in batches
 * - Results are tracked via request IDs
 *
 * For high-scale:
 * - Multiple workers can process operations in parallel
 * - Batch size configurable via environment variables
 * - Monitor queue depth to scale workers
 *
 * Producer para operações em lote via RabbitMQ
 *
 * Arquitetura para operações em lote de alta escala:
 * - Enfileira operações pesadas para processamento assíncrono
 * - Previne bloqueio de requisições HTTP para operações de longa duração
 * - Suporta processamento em lote com rastreamento de progresso
 *
 * Estratégia de Fila:
 * - Operações pesadas são enfileiradas imediatamente
 * - Workers processam operações em lotes
 * - Resultados são rastreados via IDs de requisição
 *
 * Para alta escala:
 * - Múltiplos workers podem processar operações em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore profundidade da fila para escalar workers
 */
@Injectable()
export class BatchOperationsProducer {
  private readonly logger: LoggerService;

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new LoggerService(BatchOperationsProducer.name, configService);
  }

  /**
   * EN -
   * Queues a user account deletion operation.
   *
   * PT -
   * Enfileira uma operação de exclusão de conta de usuário.
   *
   * @param userId - User ID to delete
   * @param requestId - Unique request ID for tracking
   * @param deleteCompanyIds - Optional company IDs to delete
   */
  async queueDeleteAccount(
    userId: string,
    requestId: string,
    deleteCompanyIds?: string[],
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(DELETE_ACCOUNT_QUEUE, DELETE_ACCOUNT_DLQ);

      const payload = {
        userId,
        requestId,
        deleteCompanyIds: deleteCompanyIds || [],
        timestamp: new Date().toISOString(),
      };

      await this.rabbit.sendToQueue(
        DELETE_ACCOUNT_QUEUE,
        Buffer.from(JSON.stringify(payload)),
      );

      this.logger.default(
        `Queued delete account operation: userId=${userId}, requestId=${requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue delete account operation: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * EN -
   * Queues a reject all invites operation.
   *
   * PT -
   * Enfileira uma operação de rejeitar todos os convites.
   *
   * @param userId - User ID rejecting invites
   * @param requestId - Unique request ID for tracking
   * @param inviteTokens - Array of invite tokens to reject
   */
  async queueRejectAllInvites(
    userId: string,
    requestId: string,
    inviteTokens: string[],
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(
        REJECT_ALL_INVITES_QUEUE,
        REJECT_ALL_INVITES_DLQ,
      );

      const payload = {
        userId,
        requestId,
        inviteTokens,
        timestamp: new Date().toISOString(),
      };

      await this.rabbit.sendToQueue(
        REJECT_ALL_INVITES_QUEUE,
        Buffer.from(JSON.stringify(payload)),
      );

      this.logger.default(
        `Queued reject all invites operation: userId=${userId}, count=${inviteTokens.length}, requestId=${requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue reject all invites operation: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * EN -
   * Queues a delete all invites operation.
   *
   * PT -
   * Enfileira uma operação de excluir todos os convites.
   *
   * @param userId - User ID deleting invites
   * @param requestId - Unique request ID for tracking
   * @param inviteIds - Array of invite IDs to delete
   */
  async queueDeleteAllInvites(
    userId: string,
    requestId: string,
    inviteIds: string[],
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(
        DELETE_ALL_INVITES_QUEUE,
        DELETE_ALL_INVITES_DLQ,
      );

      const payload = {
        userId,
        requestId,
        inviteIds,
        timestamp: new Date().toISOString(),
      };

      await this.rabbit.sendToQueue(
        DELETE_ALL_INVITES_QUEUE,
        Buffer.from(JSON.stringify(payload)),
      );

      this.logger.default(
        `Queued delete all invites operation: userId=${userId}, count=${inviteIds.length}, requestId=${requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue delete all invites operation: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * EN -
   * Queues a clear all notifications operation.
   *
   * PT -
   * Enfileira uma operação de limpar todas as notificações.
   *
   * @param userId - User ID clearing notifications
   * @param requestId - Unique request ID for tracking
   * @param notificationIds - Optional array of notification IDs to delete (if empty, deletes all)
   */
  async queueClearAllNotifications(
    userId: string,
    requestId: string,
    notificationIds?: string[],
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(
        CLEAR_ALL_NOTIFICATIONS_QUEUE,
        CLEAR_ALL_NOTIFICATIONS_DLQ,
      );

      const payload = {
        userId,
        requestId,
        notificationIds: notificationIds || [],
        timestamp: new Date().toISOString(),
      };

      await this.rabbit.sendToQueue(
        CLEAR_ALL_NOTIFICATIONS_QUEUE,
        Buffer.from(JSON.stringify(payload)),
      );

      this.logger.default(
        `Queued clear all notifications operation: userId=${userId}, count=${notificationIds?.length || "all"}, requestId=${requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue clear all notifications operation: ${String(error)}`,
      );
      throw error;
    }
  }
}


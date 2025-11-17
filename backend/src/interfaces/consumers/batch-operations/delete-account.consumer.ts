import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import {
  DELETE_ACCOUNT_QUEUE,
  DELETE_ACCOUNT_DLQ,
} from "@infrastructure/messaging/producers/batch-operations.producer";
import { DeleteAccountUseCase } from "@application/use-cases/users/delete-account.usecase";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";

interface DeleteAccountPayload {
  userId: string;
  requestId: string;
  deleteCompanyIds: string[];
  timestamp: string;
}

/**
 * DeleteAccountConsumer - Consumer for processing account deletion operations
 *
 * Architecture for high-scale account deletion:
 * - Processes account deletion requests asynchronously
 * - Handles batch deletion of related data (companies, memberships, notifications, etc.)
 * - Prevents blocking HTTP requests for long-running operations
 *
 * Batch Processing:
 * - Processes deletions in batches to avoid overwhelming the database
 * - Handles cascading deletions efficiently
 * - Tracks progress via request IDs
 *
 * For high-scale:
 * - Multiple workers can process deletions in parallel
 * - Batch size configurable via environment variables
 * - Monitor processing time and adjust batch size
 *
 * Consumer para processar operações de exclusão de conta
 *
 * Arquitetura para exclusão de conta de alta escala:
 * - Processa requisições de exclusão de conta de forma assíncrona
 * - Trata exclusão em lote de dados relacionados (empresas, membros, notificações, etc.)
 * - Previne bloqueio de requisições HTTP para operações de longa duração
 *
 * Processamento em Lote:
 * - Processa exclusões em lotes para evitar sobrecarregar o banco de dados
 * - Trata exclusões em cascata eficientemente
 * - Rastreia progresso via IDs de requisição
 *
 * Para alta escala:
 * - Múltiplos workers podem processar exclusões em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore tempo de processamento e ajuste tamanho do lote
 */
@Injectable()
export class DeleteAccountConsumer extends BaseResilientConsumer<DeleteAccountPayload> {
  constructor(
    rabbit: RabbitMQService,
    configService: ConfigService,
    private readonly deleteAccountUseCase: DeleteAccountUseCase,
    private readonly cache: RedisQueryCacheService,
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
      queue: DELETE_ACCOUNT_QUEUE,
      dlq: DELETE_ACCOUNT_DLQ,
      prefetch,
      retryMax,
      redisUrl,
      dedupTtlSeconds: 300,
    }, configService);
  }

  protected dedupKey(payload: DeleteAccountPayload): string | null {
    return `delete-account:${payload.userId}:${payload.requestId}`;
  }

  protected async process(payload: DeleteAccountPayload): Promise<void> {
    const startTime = Date.now();
    this.logger.default(
      `Processing delete account operation: userId=${payload.userId}, requestId=${payload.requestId}`,
    );

    try {
      await this.deleteAccountUseCase.execute({
        userId: payload.userId,
      });

      await this.cache.invalidate("query:*");
      await this.cache.invalidate(`query:*:${payload.userId}*`);

      const duration = Date.now() - startTime;
      this.logger.default(
        `Account deletion completed: userId=${payload.userId}, requestId=${payload.requestId}, duration=${duration}ms`,
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Account deletion failed: userId=${payload.userId}, requestId=${payload.requestId}, duration=${duration}ms, error: ${String(error)}`,
      );
      throw error;
    }
  }
}


import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import {
  DELETE_ALL_INVITES_QUEUE,
  DELETE_ALL_INVITES_DLQ,
} from "@infrastructure/messaging/producers/batch-operations.producer";
import {
  INVITE_REPOSITORY,
  InviteRepository,
} from "@domain/repositories/invites/invite.repository";
import { InviteStatus } from "@domain/enums/invite-status.enum";
import { Inject } from "@nestjs/common";

interface DeleteAllInvitesPayload {
  userId: string;
  requestId: string;
  inviteIds: string[];
  timestamp: string;
}

/**
 * DeleteAllInvitesConsumer - Consumer for processing delete all invites operations
 *
 * Architecture for high-scale invite deletion:
 * - Processes batch invite deletion requests asynchronously
 * - Handles multiple invites in a single operation
 * - Prevents blocking HTTP requests for batch operations
 *
 * Batch Processing:
 * - Processes deletions in batches to avoid overwhelming the database
 * - Deletes invites efficiently
 * - Tracks progress via request IDs
 *
 * For high-scale:
 * - Multiple workers can process deletions in parallel
 * - Batch size configurable via environment variables
 * - Monitor processing time and adjust batch size
 *
 * Consumer para processar operações de excluir todos os convites
 *
 * Arquitetura para exclusão de convites de alta escala:
 * - Processa requisições de exclusão de convites em lote de forma assíncrona
 * - Trata múltiplos convites em uma única operação
 * - Previne bloqueio de requisições HTTP para operações em lote
 *
 * Processamento em Lote:
 * - Processa exclusões em lotes para evitar sobrecarregar o banco de dados
 * - Exclui convites eficientemente
 * - Rastreia progresso via IDs de requisição
 *
 * Para alta escala:
 * - Múltiplos workers podem processar exclusões em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore tempo de processamento e ajuste tamanho do lote
 */
@Injectable()
export class DeleteAllInvitesConsumer extends BaseResilientConsumer<DeleteAllInvitesPayload> {
  private readonly batchSize: number;

  constructor(
    rabbit: RabbitMQService,
    configService: ConfigService,
    @Inject(INVITE_REPOSITORY) private readonly invites: InviteRepository,
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
      queue: DELETE_ALL_INVITES_QUEUE,
      dlq: DELETE_ALL_INVITES_DLQ,
      prefetch,
      retryMax,
      redisUrl,
      dedupTtlSeconds: 300,
    }, configService);

    this.batchSize = parseInt(
      process.env.INVITE_BATCH_SIZE || "50",
      10,
    );
  }

  protected dedupKey(payload: DeleteAllInvitesPayload): string | null {
    return `delete-all-invites:${payload.userId}:${payload.requestId}`;
  }

  protected async process(payload: DeleteAllInvitesPayload): Promise<void> {
    this.logger.default(
      `Processing delete all invites operation: userId=${payload.userId}, count=${payload.inviteIds.length}, requestId=${payload.requestId}`,
    );

    const batches = this.chunkArray(payload.inviteIds, this.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await Promise.all(
        batch.map(async (inviteId) => {
          try {
            const invite = await this.invites.findById(inviteId);
            if (invite) {
              if (invite.status === InviteStatus.PENDING) {
                await this.invites.updateStatus(invite.id, InviteStatus.REJECTED);
              }
              await this.invites.delete(inviteId);
            }
          } catch (error) {
            this.logger.error(
              `Failed to delete invite ${inviteId}: ${String(error)}`,
            );
          }
        }),
      );

      this.logger.default(
        `Processed batch ${i + 1}/${batches.length} of invite deletions`,
      );
    }

    this.logger.default(
      `Delete all invites operation completed: userId=${payload.userId}, requestId=${payload.requestId}`,
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


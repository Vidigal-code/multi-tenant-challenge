import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import {
  REJECT_ALL_INVITES_QUEUE,
  REJECT_ALL_INVITES_DLQ,
} from "@infrastructure/messaging/producers/batch-operations.producer";
import {
  INVITE_REPOSITORY,
  InviteRepository,
} from "@domain/repositories/invites/invite.repository";
import { InviteStatus } from "@domain/enums/invite-status.enum";
import { Inject } from "@nestjs/common";

interface RejectAllInvitesPayload {
  userId: string;
  requestId: string;
  inviteTokens: string[];
  timestamp: string;
}

/**
 * RejectAllInvitesConsumer - Consumer for processing reject all invites operations
 *
 * Architecture for high-scale invite rejection:
 * - Processes batch invite rejection requests asynchronously
 * - Handles multiple invites in a single operation
 * - Prevents blocking HTTP requests for batch operations
 *
 * Batch Processing:
 * - Processes rejections in batches to avoid overwhelming the database
 * - Updates invite status efficiently
 * - Tracks progress via request IDs
 *
 * For high-scale:
 * - Multiple workers can process rejections in parallel
 * - Batch size configurable via environment variables
 * - Monitor processing time and adjust batch size
 *
 * Consumer para processar operações de rejeitar todos os convites
 *
 * Arquitetura para rejeição de convites de alta escala:
 * - Processa requisições de rejeição de convites em lote de forma assíncrona
 * - Trata múltiplos convites em uma única operação
 * - Previne bloqueio de requisições HTTP para operações em lote
 *
 * Processamento em Lote:
 * - Processa rejeições em lotes para evitar sobrecarregar o banco de dados
 * - Atualiza status de convites eficientemente
 * - Rastreia progresso via IDs de requisição
 *
 * Para alta escala:
 * - Múltiplos workers podem processar rejeições em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore tempo de processamento e ajuste tamanho do lote
 */
@Injectable()
export class RejectAllInvitesConsumer extends BaseResilientConsumer<RejectAllInvitesPayload> {
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
      queue: REJECT_ALL_INVITES_QUEUE,
      dlq: REJECT_ALL_INVITES_DLQ,
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

  protected dedupKey(payload: RejectAllInvitesPayload): string | null {
    return `reject-all-invites:${payload.userId}:${payload.requestId}`;
  }

  protected async process(payload: RejectAllInvitesPayload): Promise<void> {
    this.logger.default(
      `Processing reject all invites operation: userId=${payload.userId}, count=${payload.inviteTokens.length}, requestId=${payload.requestId}`,
    );

    const batches = this.chunkArray(payload.inviteTokens, this.batchSize);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      await Promise.all(
        batch.map(async (token) => {
          try {
            const invite = await this.invites.findByToken(token);
            if (invite && invite.status === InviteStatus.PENDING) {
              await this.invites.updateStatus(invite.id, InviteStatus.REJECTED);
            }
          } catch (error) {
            this.logger.error(
              `Failed to reject invite with token ${token}: ${String(error)}`,
            );
          }
        }),
      );

      this.logger.default(
        `Processed batch ${i + 1}/${batches.length} of invite rejections`,
      );
    }

    this.logger.default(
      `Reject all invites operation completed: userId=${payload.userId}, requestId=${payload.requestId}`,
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


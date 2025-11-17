import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { RedisQueryCacheService } from "@infrastructure/cache/redis-query-cache.service";
import { QUERY_QUEUE, QUERY_DLQ } from "@infrastructure/messaging/producers/query.producer";
import {
  INVITE_REPOSITORY,
  InviteRepository,
} from "@domain/repositories/invites/invite.repository";
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from "@domain/repositories/notifications/notification.repository";
import {
  COMPANY_REPOSITORY,
  CompanyRepository,
} from "@domain/repositories/companys/company.repository";
import {
  MEMBERSHIP_REPOSITORY,
  MembershipRepository,
} from "@domain/repositories/memberships/membership.repository";
import {
  FRIENDSHIP_REPOSITORY,
  FriendshipRepository,
} from "@domain/repositories/friendships/friendship.repository";
import {
  USER_REPOSITORY,
  UserRepository,
} from "@domain/repositories/users/user.repository";
import { InviteStatus } from "@domain/enums/invite-status.enum";
import { Inject } from "@nestjs/common";

interface QueryPayload {
  endpoint: string;
  params: Record<string, any>;
  userId: string;
  requestId: string;
  timestamp: string;
}

/**
 * QueriesConsumer - Consumer for processing GET queries in batches
 *
 * Architecture for high-scale GET requests:
 * - Processes GET queries from queue in batches
 * - Caches results in Redis for future requests
 * - Handles multiple endpoint types (invites, notifications, companies, etc.)
 *
 * Batch Processing:
 * - Groups queries by endpoint type
 * - Processes batches efficiently
 * - Updates cache with results
 *
 * For high-scale:
 * - Multiple workers can process queries in parallel
 * - Batch size configurable via environment variables
 * - Monitor processing time and adjust batch size
 *
 * Consumer para processar consultas GET em lotes
 *
 * Arquitetura para requisições GET de alta escala:
 * - Processa consultas GET da fila em lotes
 * - Armazena resultados em cache no Redis para requisições futuras
 * - Trata múltiplos tipos de endpoint (convites, notificações, empresas, etc.)
 *
 * Processamento em Lote:
 * - Agrupa consultas por tipo de endpoint
 * - Processa lotes eficientemente
 * - Atualiza cache com resultados
 *
 * Para alta escala:
 * - Múltiplos workers podem processar consultas em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore tempo de processamento e ajuste tamanho do lote
 */
@Injectable()
export class QueriesConsumer extends BaseResilientConsumer<QueryPayload> {
  private batchBuffer: QueryPayload[] = [];
  private readonly batchSize: number;
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly batchTimeoutMs: number;

  constructor(
    rabbit: RabbitMQService,
    configService: ConfigService,
    private readonly cache: RedisQueryCacheService,
    @Inject(INVITE_REPOSITORY) private readonly invites: InviteRepository,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notifications: NotificationRepository,
    @Inject(COMPANY_REPOSITORY) private readonly companies: CompanyRepository,
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepository,
    @Inject(FRIENDSHIP_REPOSITORY)
    private readonly friendships: FriendshipRepository,
    @Inject(USER_REPOSITORY)
    private readonly users: UserRepository,
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
      queue: QUERY_QUEUE,
      dlq: QUERY_DLQ,
      prefetch,
      retryMax,
      redisUrl,
      dedupTtlSeconds: 60,
    }, configService);

    this.batchSize = parseInt(
      process.env.QUERY_BATCH_SIZE || "10",
      10,
    );
    this.batchTimeoutMs = parseInt(
      process.env.QUERY_BATCH_TIMEOUT_MS || "300",
      10,
    );
  }

  protected dedupKey(payload: QueryPayload): string | null {
    return `query:${payload.endpoint}:${payload.requestId}`;
  }

  protected async process(payload: QueryPayload): Promise<void> {
    this.batchBuffer.push(payload);

    if (this.batchBuffer.length >= this.batchSize) {
      await this.processBatch();
    } else {
      this.scheduleBatchTimeout();
    }
  }


  private scheduleBatchTimeout(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(async () => {
      if (this.batchBuffer.length > 0) {
        await this.processBatch();
      }
    }, this.batchTimeoutMs);
  }

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const batch = [...this.batchBuffer];
    this.batchBuffer = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const results = await Promise.allSettled(
      batch.map((payload) => this.processQuery(payload)),
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    this.logger.default(
      `Processed batch of ${batch.length} queries: ${successful} successful`,
    );
  }

  private async processQuery(payload: QueryPayload): Promise<void> {
    try {
      let result: any;

      if (payload.endpoint.startsWith("/invites")) {
        result = await this.processInvitesQuery(payload);
      } else if (payload.endpoint.startsWith("/notifications")) {
        result = await this.processNotificationsQuery(payload);
      } else if (payload.endpoint.startsWith("/companies") || payload.endpoint.startsWith("/company")) {
        result = await this.processCompaniesQuery(payload);
      } else if (payload.endpoint.startsWith("/friendships")) {
        result = await this.processFriendshipsQuery(payload);
      } else if (payload.endpoint.startsWith("/users/search")) {
        result = await this.processUsersSearchQuery(payload);
      } else {
        this.logger.default(
          `Unknown endpoint type: ${payload.endpoint}, skipping cache`,
        );
        return;
      }

      if (result) {
        await this.cache.set(payload.endpoint, payload.params, result);
      }
    } catch (error) {
      this.logger.error(
        `Failed to process query: ${payload.endpoint}, error: ${String(error)}`,
      );
      throw error;
    }
  }

  private async processInvitesQuery(
    payload: QueryPayload,
  ): Promise<any> {
    const { params, userId } = payload;

    if (payload.endpoint === "/invites" || payload.endpoint.includes("/invites")) {
      const email = params.email || userId;
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const { data, total } = await this.invites.listByEmail(email, page, pageSize);
      const pendingInvites = data.filter(
        (i) => i.status === InviteStatus.PENDING,
      );
      return {
        data: pendingInvites,
        total: pendingInvites.length,
        page,
        pageSize,
      };
    }

    if (payload.endpoint.includes("/invites/created")) {
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const { data, total } = await this.invites.listByInviter(userId, page, pageSize);
      return { data, total, page, pageSize };
    }

    return null;
  }

  private async processNotificationsQuery(
    payload: QueryPayload,
  ): Promise<any> {
    const { params, userId } = payload;

    if (payload.endpoint === "/notifications" || payload.endpoint.includes("/notifications")) {
      const page = parseInt(params.page, 10) || 1;
      const pageSize = parseInt(params.pageSize, 10) || 20;
      const result = await this.notifications.listByUser({
        userId,
        page,
        pageSize,
      });
      return {
        items: result.data.map((n) => n.toJSON()),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    }

    return null;
  }

  private async processCompaniesQuery(
    payload: QueryPayload,
  ): Promise<any> {
    const { params, userId } = payload;

    if (payload.endpoint === "/companies" || payload.endpoint.includes("/companies")) {
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const memberships = await this.memberships.listByUser(userId);
      const companyIds = memberships.map((m) => m.companyId);
      const companies = await Promise.all(
        companyIds.map((id) => this.companies.findById(id)),
      );
      const validCompanies = companies.filter((c) => c !== null);
      return {
        data: validCompanies,
        total: validCompanies.length,
        page,
        pageSize,
      };
    }

    return null;
  }

  private async processFriendshipsQuery(
    payload: QueryPayload,
  ): Promise<any> {
    const { params, userId } = payload;

    if (payload.endpoint === "/friendships" || payload.endpoint.includes("/friendships")) {
      const status = params.status;
      const page = params.page || 1;
      const pageSize = params.pageSize || 10;
      const result = await this.friendships.listByUser({
        userId,
        status,
        page,
        pageSize,
      });
      return {
        data: result.data.map((f) => f.toJSON()),
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      };
    }

    return null;
  }

  private async processUsersSearchQuery(
    payload: QueryPayload,
  ): Promise<any> {
    const { params, userId } = payload;

    if (payload.endpoint === "/users/search" || payload.endpoint.includes("/users/search")) {
      const query = params.q || params.query || "";
      if (!query || query.trim().length === 0) {
        return [];
      }

      const users = await this.users.searchByNameOrEmail(
        query.trim(),
        userId,
      );

      return users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email.toString(),
      }));
    }

    return null;
  }
}


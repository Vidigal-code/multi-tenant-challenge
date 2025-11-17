import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "../services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";

export const QUERY_QUEUE = "queries.get";
export const QUERY_DLQ = "dlq.queries.get";

/**
 * QueryProducer - Producer for GET query processing via RabbitMQ
 *
 * Architecture for high-scale GET requests:
 * - Queues GET requests for batch processing
 * - Reduces database load by processing queries in batches
 * - Supports cache-first strategy with queue fallback
 *
 * Queue Strategy:
 * - GET requests are queued when cache miss occurs
 * - Batch processing improves database query efficiency
 * - Results are cached after processing
 *
 * For high-scale:
 * - Multiple workers can process queries in parallel
 * - Batch size configurable via environment variables
 * - Monitor queue depth to scale workers
 *
 * Producer para processamento de consultas GET via RabbitMQ
 *
 * Arquitetura para requisições GET de alta escala:
 * - Enfileira requisições GET para processamento em lote
 * - Reduz carga no banco de dados processando consultas em lotes
 * - Suporta estratégia cache-first com fallback para fila
 *
 * Estratégia de Fila:
 * - Requisições GET são enfileiradas quando ocorre cache miss
 * - Processamento em lote melhora eficiência de consultas ao banco
 * - Resultados são armazenados em cache após processamento
 *
 * Para alta escala:
 * - Múltiplos workers podem processar consultas em paralelo
 * - Tamanho do lote configurável via variáveis de ambiente
 * - Monitore profundidade da fila para escalar workers
 */
@Injectable()
export class QueryProducer {
  private readonly logger: LoggerService;

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly configService: ConfigService,
  ) {
    this.logger = new LoggerService(QueryProducer.name, configService);
  }

  /**
   * EN -
   * Queues a GET query request for batch processing.
   *
   * PT -
   * Enfileira uma requisição de consulta GET para processamento em lote.
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters
   * @param userId - User ID making the request
   * @param requestId - Unique request ID for tracking
   */
  async queueQuery(
    endpoint: string,
    params: Record<string, any>,
    userId: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(QUERY_QUEUE, QUERY_DLQ);

      const payload = {
        endpoint,
        params,
        userId,
        requestId,
        timestamp: new Date().toISOString(),
      };

      await this.rabbit.sendToQueue(
        QUERY_QUEUE,
        Buffer.from(JSON.stringify(payload)),
      );

      this.logger.default(
        `Queued query request: ${endpoint}, requestId: ${requestId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to queue query request: ${endpoint}, error: ${String(error)}`,
      );
      throw error;
    }
  }

  /**
   * EN -
   * Queues multiple GET query requests for batch processing.
   *
   * PT -
   * Enfileira múltiplas requisições de consulta GET para processamento em lote.
   *
   * @param requests - Array of query requests
   */
  async queueBatch(
    requests: Array<{
      endpoint: string;
      params: Record<string, any>;
      userId: string;
      requestId: string;
    }>,
  ): Promise<void> {
    try {
      await this.rabbit.assertEventQueue(QUERY_QUEUE, QUERY_DLQ);

      for (const req of requests) {
        const payload = {
          endpoint: req.endpoint,
          params: req.params,
          userId: req.userId,
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
        };

        await this.rabbit.sendToQueue(
          QUERY_QUEUE,
          Buffer.from(JSON.stringify(payload)),
        );
      }

      this.logger.default(`Queued ${requests.length} query requests in batch`);
    } catch (error) {
      this.logger.error(
        `Failed to queue batch query requests: ${String(error)}`,
      );
      throw error;
    }
  }
}


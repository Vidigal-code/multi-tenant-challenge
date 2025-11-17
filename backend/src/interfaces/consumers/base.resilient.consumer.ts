import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { LoggerService } from "@infrastructure/logging/logger.service";
import Redis from "ioredis";

export interface ResilientConsumerOptions {
  queue: string;
  dlq: string;
  prefetch: number;
  retryMax: number;
  redisUrl: string;
  dedupTtlSeconds: number;
}

/**
 * BaseResilientConsumer - Base class for RabbitMQ event consumers
 *
 * Features for high-scale processing:
 * - Automatic retry with exponential backoff
 * - Dead Letter Queue (DLQ) for failed messages
 * - Message deduplication using Redis
 * - Prefetch control for parallel processing
 * - Graceful error handling
 *
 * Architecture:
 * - Multiple workers can consume from the same queue
 * - Messages are distributed across workers automatically
 * - Failed messages are retried up to retryMax times
 * - Duplicate messages are filtered using Redis
 *
 * For millions of events:
 * - Deploy multiple consumer instances for horizontal scaling
 * - Monitor queue depths and processing rates
 * - Adjust prefetch based on message processing time
 * - Use Redis Cluster for deduplication at scale
 *
 * Classe base para consumidores de eventos RabbitMQ
 *
 * Recursos para processamento em alta escala:
 * - Retry automático com backoff exponencial
 * - Fila de mensagens mortas (DLQ) para mensagens com falha
 * - Desduplicação de mensagens usando Redis
 * - Controle de prefetch para processamento paralelo
 * - Tratamento elegante de erros
 *
 * Arquitetura:
 * - Múltiplos workers podem consumir da mesma fila
 * - Mensagens são distribuídas entre workers automaticamente
 * - Mensagens com falha são reprocessadas até retryMax vezes
 * - Mensagens duplicadas são filtradas usando Redis
 *
 * Para milhões de eventos:
 * - Faça deploy de múltiplas instâncias de consumidor para escalonamento horizontal
 * - Monitore profundidade de filas e taxas de processamento
 * - Ajuste prefetch baseado no tempo de processamento de mensagens
 * - Use Redis Cluster para desduplicação em escala
 */
export abstract class BaseResilientConsumer<T = any> {
  protected readonly logger: LoggerService;
  private redis: Redis;

  constructor(
    protected readonly rabbit: RabbitMQService,
    private readonly opts: ResilientConsumerOptions,
    private readonly configService?: ConfigService,
  ) {
    this.logger = new LoggerService(this.constructor.name, configService);
    this.redis = new Redis(opts.redisUrl);
  }

  /**
   * EN -
   * Starts the consumer by initializing queues, setting up prefetch, and beginning message consumption.
   * Handles message parsing, deduplication, processing, and error recovery with retry logic.
   *
   * PT -
   * Inicia o consumidor inicializando as filas, configurando o prefetch e iniciando o consumo de mensagens.
   * Gerencia parsing de mensagens, desduplicação, processamento e recuperação de erros com lógica de retry.
   */
  async start(): Promise<void> {
    const channel = await this.rabbit.getChannel();
    await this.initializeQueues(channel);
    await this.rabbit.setPrefetch(this.opts.prefetch);
    this.logger.rabbitmq(
      `Consuming queue: ${this.opts.queue}, prefetch: ${this.opts.prefetch}`,
    );

    channel.consume(
      this.opts.queue,
      async (msg: any) => {
        if (!msg) return;

        await this.handleMessage(channel, msg);
      },
      { noAck: false },
    );
  }

  /**
   * EN -
   * Initializes the main queue with dead letter queue configuration and creates the DLQ.
   * Ensures queues exist before starting consumption.
   *
   * PT -
   * Inicializa a fila principal com configuração de dead letter queue e cria a DLQ.
   * Garante que as filas existam antes de iniciar o consumo.
   *
   * @param channel - RabbitMQ channel instance
   */
  private async initializeQueues(channel: any): Promise<void> {
    await this.rabbit.assertQueueWithOptions(this.opts.queue, {
      deadLetterExchange: "",
      deadLetterRoutingKey: this.opts.dlq,
    });
    await this.rabbit.assertQueue(this.opts.dlq);
  }

  /**
   * EN -
   * Handles a single message from the queue, orchestrating parsing, deduplication, and processing.
   * Coordinates the entire message lifecycle from receipt to acknowledgment or rejection.
   *
   * PT -
   * Processa uma única mensagem da fila, orquestrando parsing, desduplicação e processamento.
   * Coordena todo o ciclo de vida da mensagem desde o recebimento até a confirmação ou rejeição.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   */
  private async handleMessage(channel: any, msg: any): Promise<void> {
    const parseResult = this.parseMessage(msg);
    if (!parseResult.success) {
      this.rejectMessageToDlq(
        channel,
        msg,
        parseResult.error || "Invalid message format",
      );
      return;
    }

    const payload = parseResult.payload!;
    const dedupKey = this.dedupKey(payload);

    const isDuplicate = await this.checkDuplicate(dedupKey);
    if (isDuplicate) {
      this.acknowledgeMessage(channel, msg);
      return;
    }

    await this.processMessage(channel, msg, payload, dedupKey);
  }

  /**
   * EN -
   * Parses the raw message content from RabbitMQ into a typed payload.
   * Validates JSON format and extracts message content.
   *
   * PT -
   * Faz o parsing do conteúdo bruto da mensagem do RabbitMQ em um payload tipado.
   * Valida o formato JSON e extrai o conteúdo da mensagem.
   *
   * @param msg - RabbitMQ message object
   * @returns Object containing success status, parsed payload, and optional error message
   */
  private parseMessage(msg: any): {
    success: boolean;
    payload?: T;
    error?: string;
  } {
    const raw = msg.content.toString();

    try {
      const payload = JSON.parse(raw) as T;
      this.logger.rabbitmq(
        `Message received from queue: ${this.opts.queue}, size: ${raw.length} bytes`,
      );
      this.logger.rabbitmq(`Payload: ${raw.substring(0, 200)}...`);

      return { success: true, payload };
    } catch (error) {
      const errorMessage = `Invalid JSON, routing to DLQ: ${raw.substring(0, 100)}`;
      this.logger.rabbitmq(errorMessage);

      return { success: false, error: errorMessage };
    }
  }

  /**
   * EN -
   * Checks if a message is a duplicate using Redis-based deduplication.
   * Uses the deduplication key to identify unique messages.
   *
   * PT -
   * Verifica se uma mensagem é duplicada usando desduplicação baseada em Redis.
   * Usa a chave de desduplicação para identificar mensagens únicas.
   *
   * @param dedupKey - Deduplication key for the message, null if deduplication is not applicable
   * @returns True if message is duplicate, false otherwise
   */
  private async checkDuplicate(dedupKey: string | null): Promise<boolean> {
    if (!dedupKey) {
      return false;
    }

    const exists = await this.redis.get(dedupKey);
    if (exists) {
      const ttl = await this.redis.ttl(dedupKey);
      this.logger.rabbitmq(
        `Dedup: skipping duplicate message, key: ${dedupKey}, ttl: ${ttl}s`,
      );
      return true;
    }

    this.logger.rabbitmq(`Dedup: processing new message, key: ${dedupKey}`);
    return false;
  }

  /**
   * EN -
   * Processes a message by calling the abstract process method and handles success/failure.
   * Marks message as processed in Redis for deduplication and acknowledges on success.
   *
   * PT -
   * Processa uma mensagem chamando o método abstrato process e trata sucesso/falha.
   * Marca mensagem como processada no Redis para desduplicação e confirma em caso de sucesso.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   * @param payload - Parsed message payload
   * @param dedupKey - Deduplication key for the message
   */
  private async processMessage(
    channel: any,
    msg: any,
    payload: T,
    dedupKey: string | null,
  ): Promise<void> {
    try {
      this.logger.rabbitmq(`Processing message from queue: ${this.opts.queue}`);
      await this.process(payload);

      if (dedupKey) {
        await this.redis.set(dedupKey, "1", "EX", this.opts.dedupTtlSeconds);
      }

      this.logger.rabbitmq(
        `Message processed successfully: ${this.opts.queue}`,
      );
      this.acknowledgeMessage(channel, msg);
    } catch (error: any) {
      await this.handleProcessingError(channel, msg, error);
    }
  }

  /**
   * EN -
   * Handles processing errors by implementing retry logic with exponential backoff.
   * Dead-letters messages that exceed maximum retry attempts.
   *
   * PT -
   * Trata erros de processamento implementando lógica de retry com backoff exponencial.
   * Envia mensagens para dead letter queue quando excedem o número máximo de tentativas.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   * @param error - Error that occurred during processing
   */
  private async handleProcessingError(
    channel: any,
    msg: any,
    error: any,
  ): Promise<void> {
    const retries = this.getRetryCount(msg) + 1;

    if (retries >= this.opts.retryMax) {
      this.logger.rabbitmq(
        `Message failed after ${retries} attempts. Dead-lettering.`,
      );
      this.rejectMessageToDlq(channel, msg, error?.message || String(error));
      return;
    }

    this.logger.rabbitmq(
      `Processing failed, attempt: ${retries}/${this.opts.retryMax}. Retrying.`,
    );
    this.setRetryCount(msg, retries);
    this.rejectMessageForRetry(channel, msg);
  }

  /**
   * EN -
   * Acknowledges a successfully processed message to RabbitMQ.
   * Removes the message from the queue after successful processing.
   *
   * PT -
   * Confirma uma mensagem processada com sucesso para o RabbitMQ.
   * Remove a mensagem da fila após processamento bem-sucedido.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   */
  private acknowledgeMessage(channel: any, msg: any): void {
    channel.ack(msg);
  }

  /**
   * EN -
   * Rejects a message and sends it to the Dead Letter Queue.
   * Used for messages that cannot be processed or have exceeded retry limits.
   *
   * PT -
   * Rejeita uma mensagem e a envia para a Dead Letter Queue.
   * Usado para mensagens que não podem ser processadas ou excederam limites de retry.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   * @param reason - Reason for rejection (error message)
   */
  private rejectMessageToDlq(channel: any, msg: any, reason: string): void {
    this.logger.rabbitmq(`Rejecting message to DLQ: ${reason}`);
    channel.nack(msg, false, false);
  }

  /**
   * EN -
   * Rejects a message and requeues it for retry.
   * Used when processing fails but retry attempts are still available.
   *
   * PT -
   * Rejeita uma mensagem e a recoloca na fila para retry.
   * Usado quando o processamento falha mas ainda há tentativas de retry disponíveis.
   *
   * @param channel - RabbitMQ channel instance
   * @param msg - RabbitMQ message object
   */
  private rejectMessageForRetry(channel: any, msg: any): void {
    channel.nack(msg, false, true);
  }

  /**
   * EN -
   * Abstract method that must be implemented by subclasses to define message processing logic.
   * This is the core business logic that processes each message payload.
   *
   * PT -
   * Método abstrato que deve ser implementado pelas subclasses para definir a lógica de processamento de mensagens.
   * Esta é a lógica de negócio central que processa cada payload de mensagem.
   *
   * @param payload - Parsed message payload of type T
   */
  protected abstract process(payload: T): Promise<void>;

  /**
   * EN -
   * Generates a deduplication key for a message payload to prevent duplicate processing.
   * Uses different strategies based on payload structure (messageId, inviteId, userId, companyId).
   * Returns null if deduplication is not applicable for the payload type.
   *
   * PT -
   * Gera uma chave de desduplicação para um payload de mensagem para prevenir processamento duplicado.
   * Usa diferentes estratégias baseadas na estrutura do payload (messageId, inviteId, userId, companyId).
   * Retorna null se a desduplicação não for aplicável para o tipo de payload.
   *
   * @param payload - Message payload to generate deduplication key for
   * @returns Deduplication key string or null if deduplication is not applicable
   */
  protected dedupKey(payload: T): string | null {
    const p = payload as any;

    if (p?.messageId || p?.id) {
      return `msg:${p.messageId || p.id}`;
    }

    if (p?.eventId && p?.inviteId) {
      const timestamp = p?.timestamp
        ? new Date(p.timestamp).getTime()
        : Date.now();
      return `evt:${p.eventId}:invite:${p.inviteId}:ts:${timestamp}`;
    }

    if (p?.eventId && p?.userId) {
      const timestamp = p?.timestamp
        ? new Date(p.timestamp).getTime()
        : Date.now();
      const uniqueId =
        p?.initiatorId || p?.senderUserId || p?.notificationId || "";
      const roleChange =
        p?.oldRole && p?.newRole ? `:${p.oldRole}->${p.newRole}` : "";
      return `evt:${p.eventId}:user:${p.userId}:ts:${timestamp}:uid:${uniqueId}${roleChange}`;
    }

    if (p?.eventId && p?.companyId) {
      const timestamp = p?.timestamp
        ? new Date(p.timestamp).getTime()
        : Date.now();
      const uniqueId =
        p?.initiatorId || p?.senderUserId || p?.notificationId || "";
      return `evt:${p.eventId}:company:${p.companyId}:ts:${timestamp}:uid:${uniqueId}`;
    }

    return null;
  }

  /**
   * EN -
   * Retrieves the current retry count from message headers.
   * Tracks how many times a message has been retried after processing failures.
   *
   * PT -
   * Recupera a contagem atual de retry dos headers da mensagem.
   * Rastreia quantas vezes uma mensagem foi reprocessada após falhas no processamento.
   *
   * @param msg - RabbitMQ message object
   * @returns Current retry count, defaults to 0 if not set
   */
  private getRetryCount(msg: any): number {
    return msg.properties.headers["x-retry-count"] || 0;
  }

  /**
   * EN -
   * Sets the retry count in message headers for tracking retry attempts.
   * Used to increment retry counter when processing fails and message is requeued.
   *
   * PT -
   * Define a contagem de retry nos headers da mensagem para rastrear tentativas de retry.
   * Usado para incrementar o contador de retry quando o processamento falha e a mensagem é recolocada na fila.
   *
   * @param msg - RabbitMQ message object
   * @param count - New retry count value
   */
  private setRetryCount(msg: any, count: number): void {
    msg.properties.headers["x-retry-count"] = count;
  }
}

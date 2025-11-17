import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

const MEMBERS_EVENTS_QUEUE = "events.members";
const NOTIFICATIONS_REALTIME_QUEUE = "notifications.realtimes";
const DLQ_REALTIME_NOTIFICATIONS = "dlq.notifications.realtimes";
const DLQ_MEMBERS = "dlq.events.members";

/**
 * EN -
 * MembersEventsConsumer - Consumer for membership-related domain events that forwards to realtime queue.
 *
 * This consumer processes membership domain events (joined, left, removed, role updated) and forwards them
 * to the realtime notifications queue for WebSocket delivery to connected clients.
 *
 * Architecture:
 * - Consumes from 'events.members' queue (membership domain events)
 * - Forwards all membership events to 'notifications.realtimes' queue
 * - Uses DLQ for failed message handling
 * - Logs event processing for monitoring and debugging
 *
 * Event Processing:
 * - All membership events are forwarded without modification
 * - Events are serialized as JSON buffers
 * - Event ID is logged for tracking purposes
 * - Queue initialization is performed before each forward operation
 *
 * PT -
 * MembersEventsConsumer - Consumidor para eventos de domínio relacionados a associações que encaminha para fila realtime.
 *
 * Este consumidor processa eventos de domínio de associações (entrada, saída, remoção, atualização de papel) e os encaminha
 * para a fila de notificações realtime para entrega via WebSocket para clientes conectados.
 *
 * Arquitetura:
 * - Consome da fila 'events.members' (eventos de domínio de associações)
 * - Encaminha todos os eventos de associação para fila 'notifications.realtimes'
 * - Usa DLQ para tratamento de mensagens com falha
 * - Registra processamento de eventos para monitoramento e depuração
 *
 * Processamento de Eventos:
 * - Todos os eventos de associação são encaminhados sem modificação
 * - Eventos são serializados como buffers JSON
 * - ID do evento é registrado para fins de rastreamento
 * - Inicialização de fila é realizada antes de cada operação de encaminhamento
 */
class MembersEventsConsumer extends BaseResilientConsumer<any> {
  constructor(rabbit: RabbitMQService, config: ConfigService) {
    super(
      rabbit,
      {
        queue: MEMBERS_EVENTS_QUEUE,
        dlq: DLQ_MEMBERS,
        prefetch: parseInt(
          (config.get("app.rabbitmq.prefetch") as any) ?? "50",
          10,
        ),
        retryMax: parseInt(
          (config.get("app.rabbitmq.retryMax") as any) ?? "5",
          10,
        ),
        redisUrl:
          (config.get("app.redisUrl") as string) ||
          process.env.REDIS_URL ||
          "redis://redis:6379",
        dedupTtlSeconds: 60,
      },
      config,
    );
  }

  /**
   * EN -
   * Extracts event ID from payload for logging purposes.
   * Returns 'unknown' if eventId is not present in payload.
   *
   * PT -
   * Extrai ID do evento do payload para fins de log.
   * Retorna 'unknown' se eventId não estiver presente no payload.
   *
   * @param payload - Event payload containing optional eventId
   * @returns Event ID string or 'unknown' if not found
   */
  private extractEventId(payload: any): string {
    return payload?.eventId || "unknown";
  }

  /**
   * EN -
   * Initializes realtime notifications queue and DLQ if they don't exist.
   * Ensures queues are properly configured with dead letter exchange before forwarding messages.
   *
   * PT -
   * Inicializa fila de notificações realtime e DLQ se não existirem.
   * Garante que as filas estejam adequadamente configuradas com dead letter exchange antes de encaminhar mensagens.
   */
  private async ensureRealtimeQueuesExist(): Promise<void> {
    await this.rabbit.assertQueueWithOptions(NOTIFICATIONS_REALTIME_QUEUE, {
      deadLetterExchange: "",
      deadLetterRoutingKey: DLQ_REALTIME_NOTIFICATIONS,
    });
    await this.rabbit.assertQueue(DLQ_REALTIME_NOTIFICATIONS);
  }

  /**
   * EN -
   * Serializes payload to JSON buffer for queue transmission.
   * Converts payload object to JSON string and then to Buffer for RabbitMQ.
   *
   * PT -
   * Serializa payload para buffer JSON para transmissão na fila.
   * Converte objeto payload para string JSON e depois para Buffer para RabbitMQ.
   *
   * @param payload - Event payload to serialize
   * @returns Buffer containing JSON-serialized payload
   */
  private serializePayload(payload: any): Buffer {
    return Buffer.from(JSON.stringify(payload));
  }

  /**
   * EN -
   * Forwards membership event payload to realtime notifications queue for WebSocket delivery.
   * Ensures queues exist, serializes payload, sends to queue, and logs the operation.
   *
   * PT -
   * Encaminha payload de evento de associação para fila de notificações realtime para entrega via WebSocket.
   * Garante que filas existam, serializa payload, envia para fila e registra a operação.
   *
   * @param payload - Membership event payload to forward
   * @param eventId - Event ID for logging purposes
   */
  private async forwardToRealtimeQueue(
    payload: any,
    eventId: string,
  ): Promise<void> {
    await this.ensureRealtimeQueuesExist();
    const serializedPayload = this.serializePayload(payload);
    await this.rabbit.sendToQueue(
      NOTIFICATIONS_REALTIME_QUEUE,
      serializedPayload,
    );
    this.logger.rabbitmq(
      `Forwarded member event to ${NOTIFICATIONS_REALTIME_QUEUE}: ${eventId}`,
    );
  }

  /**
   * EN -
   * Processes membership domain events by forwarding them to realtime notifications queue.
   * Logs event processing start and forwards event for WebSocket delivery.
   *
   * PT -
   * Processa eventos de domínio de associações encaminhando-os para fila de notificações realtime.
   * Registra início do processamento do evento e encaminha evento para entrega via WebSocket.
   *
   * @param payload - Membership domain event payload
   */
  protected async process(payload: any): Promise<void> {
    const eventId = this.extractEventId(payload);
    this.logger.rabbitmq(`Processing member event: ${eventId}`);
    await this.forwardToRealtimeQueue(payload, eventId);
  }
}

/**
 * EN -
 * Initializes RabbitMQ service and establishes connection.
 * Prepares messaging infrastructure for consumer operations.
 *
 * PT -
 * Inicializa o serviço RabbitMQ e estabelece conexão.
 * Prepara infraestrutura de mensageria para operações do consumidor.
 *
 * @param config - Configuration service instance
 * @returns Initialized RabbitMQ service instance
 */
async function initializeRabbitMQ(
  config: ConfigService,
): Promise<RabbitMQService> {
  const rabbit =
    new (require("@infrastructure/messaging/services/rabbitmq.service").RabbitMQService)(
      config,
    );
  await rabbit.onModuleInit();
  return rabbit;
}

/**
 * EN -
 * Creates and starts the MembersEventsConsumer instance.
 * Initializes the consumer with all required dependencies and begins message consumption.
 *
 * PT -
 * Cria e inicia a instância do MembersEventsConsumer.
 * Inicializa o consumidor com todas as dependências necessárias e inicia o consumo de mensagens.
 *
 * @param rabbit - RabbitMQ service instance
 * @param config - Configuration service instance
 * @param logger - Logger service instance for logging consumer status
 */
async function startConsumer(
  rabbit: RabbitMQService,
  config: ConfigService,
  logger: LoggerService,
): Promise<void> {
  const consumer = new MembersEventsConsumer(rabbit, config);
  await consumer.start();
  logger.default("Members events consumer started.");
}

/**
 * EN -
 * Main bootstrap function that orchestrates the entire consumer initialization process.
 * Handles service setup, consumer startup, and error handling.
 *
 * PT -
 * Função principal de bootstrap que orquestra todo o processo de inicialização do consumidor.
 * Gerencia configuração de serviços, inicialização do consumidor e tratamento de erros.
 */
async function bootstrap(): Promise<void> {
  const config = new ConfigService();
  const logger = new LoggerService("MembersEventsConsumer", config);
  logger.default("Starting members events consumer...");

  try {
    const rabbit = await initializeRabbitMQ(config);
    await startConsumer(rabbit, config, logger);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error(`Failed to start members events consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

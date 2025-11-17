import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { BaseResilientConsumer } from "../base.resilient.consumer";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

const GENERIC_EVENTS_QUEUE = "events";
const NOTIFICATIONS_REALTIME_QUEUE = "notifications.realtimes";
const DLQ_REALTIME_NOTIFICATIONS = "dlq.notifications.realtimes";
const DLQ_GENERIC = "dlq.events";

/**
 * EN -
 * GenericEventsConsumer - Consumer for generic domain events that forwards friend and notification events to realtime queue.
 *
 * This consumer processes generic domain events and filters friend/notification related events,
 * enriching them with eventId and forwarding to the realtime notifications queue for WebSocket delivery.
 *
 * Architecture:
 * - Consumes from 'events' queue (generic domain events)
 * - Filters events related to friends and notifications
 * - Enriches payloads with standardized eventId
 * - Forwards filtered events to 'notifications.realtimes' queue
 * - Uses DLQ for failed message handling
 *
 * Event Processing:
 * - Friend events: friend.request.sent, friend.request.accepted, friend.request.rejected, friend.removed
 * - Notification events: notifications.sent, notifications.created, notifications.replied
 * - Events matching 'friend' or 'notification' patterns are automatically forwarded
 *
 * PT -
 * GenericEventsConsumer - Consumidor para eventos de domínio genéricos que encaminha eventos de amizade e notificação para fila realtime.
 *
 * Este consumidor processa eventos de domínio genéricos e filtra eventos relacionados a amizades e notificações,
 * enriquecendo-os com eventId e encaminhando para a fila de notificações realtime para entrega via WebSocket.
 *
 * Arquitetura:
 * - Consome da fila 'events' (eventos de domínio genéricos)
 * - Filtra eventos relacionados a amizades e notificações
 * - Enriquece payloads com eventId padronizado
 * - Encaminha eventos filtrados para fila 'notifications.realtimes'
 * - Usa DLQ para tratamento de mensagens com falha
 *
 * Processamento de Eventos:
 * - Eventos de amizade: friend.request.sent, friend.request.accepted, friend.request.rejected, friend.removed
 * - Eventos de notificação: notifications.sent, notifications.created, notifications.replied
 * - Eventos que correspondem aos padrões 'friend' ou 'notification' são automaticamente encaminhados
 */
class GenericEventsConsumer extends BaseResilientConsumer<any> {
  /**
   * EN -
   * Event ID mapping for standardizing event names to uppercase event IDs.
   * Maps domain event names to their corresponding event ID constants.
   *
   * PT -
   * Mapeamento de IDs de eventos para padronizar nomes de eventos para IDs de eventos em maiúsculas.
   * Mapeia nomes de eventos de domínio para suas constantes de ID de evento correspondentes.
   */
  private readonly eventIdMapping: Record<string, string> = {
    "friend.request.sent": "FRIEND_REQUEST_SENT",
    "friend.request.accepted": "FRIEND_REQUEST_ACCEPTED",
    "friend.request.rejected": "FRIEND_REQUEST_REJECTED",
    "friend.removed": "FRIEND_REMOVED",
    "notifications.sent": "NOTIFICATION_SENT",
    "notifications.created": "NOTIFICATION_CREATED",
    "notifications.replied": "NOTIFICATION_REPLIED",
  };

  constructor(rabbit: RabbitMQService, config: ConfigService) {
    super(
      rabbit,
      {
        queue: GENERIC_EVENTS_QUEUE,
        dlq: DLQ_GENERIC,
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
   * Extracts event name from payload, checking multiple possible fields.
   * Supports both 'eventName' and 'name' fields for backward compatibility.
   *
   * PT -
   * Extrai nome do evento do payload, verificando múltiplos campos possíveis.
   * Suporta tanto campos 'eventName' quanto 'name' para compatibilidade retroativa.
   *
   * @param payload - Event payload containing event name
   * @returns Extracted event name or empty string if not found
   */
  private extractEventName(payload: any): string {
    return payload?.eventName || payload?.name || "";
  }

  /**
   * EN -
   * Determines if an event should be forwarded to realtime notifications queue.
   * Checks if event name matches known mappings or contains 'friend'/'notification' keywords.
   *
   * PT -
   * Determina se um evento deve ser encaminhado para a fila de notificações realtime.
   * Verifica se o nome do evento corresponde a mapeamentos conhecidos ou contém palavras-chave 'friend'/'notification'.
   *
   * @param eventName - Name of the domain event
   * @returns True if event should be forwarded, false otherwise
   */
  private shouldForwardEvent(eventName: string): boolean {
    return !!(
      this.eventIdMapping[eventName] ||
      eventName.includes("friend") ||
      eventName.includes("notification")
    );
  }

  /**
   * EN -
   * Resolves event ID from event name using mapping or generates from event name.
   * Uses predefined mapping if available, otherwise converts event name to uppercase with underscores.
   *
   * PT -
   * Resolve ID do evento a partir do nome do evento usando mapeamento ou gera a partir do nome do evento.
   * Usa mapeamento predefinido se disponível, caso contrário converte nome do evento para maiúsculas com underscores.
   *
   * @param eventName - Name of the domain event
   * @returns Standardized event ID string
   */
  private resolveEventId(eventName: string): string {
    return (
      this.eventIdMapping[eventName] ||
      eventName.toUpperCase().replace(/\./g, "_")
    );
  }

  /**
   * EN -
   * Enriches payload with standardized eventId for downstream processing.
   * Creates a new payload object with eventId added while preserving all original fields.
   *
   * PT -
   * Enriquece payload com eventId padronizado para processamento downstream.
   * Cria um novo objeto payload com eventId adicionado preservando todos os campos originais.
   *
   * @param payload - Original event payload
   * @param eventId - Standardized event ID to add
   * @returns Enriched payload with eventId field
   */
  private enrichPayloadWithEventId(payload: any, eventId: string): any {
    return {
      ...payload,
      eventId,
    };
  }

  /**
   * EN -
   * Initializes realtime notifications queue and DLQ if they don't exist.
   * Ensures queues are properly configured with dead letter exchange before forwarding messages.
   *
   * PT -
   * Inicializa fila de notificações realtime e DLQ se não existirem.
   * Garante que as filas estejam adequadamente configuradas com dead letter exchange antes de encaminhar mensagens.
   *
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
   * Forwards enriched payload to realtime notifications queue for WebSocket delivery.
   * Serializes payload to JSON buffer and sends to queue with proper error handling.
   *
   * PT -
   * Encaminha payload enriquecido para fila de notificações realtime para entrega via WebSocket.
   * Serializa payload para buffer JSON e envia para fila com tratamento adequado de erros.
   *
   * @param enrichedPayload - Payload enriched with eventId
   * @param eventName - Original event name for logging
   * @param eventId - Standardized event ID for logging
   */
  private async forwardToRealtimeQueue(
    enrichedPayload: any,
    eventName: string,
    eventId: string,
  ): Promise<void> {
    await this.rabbit.sendToQueue(
      NOTIFICATIONS_REALTIME_QUEUE,
      Buffer.from(JSON.stringify(enrichedPayload)),
    );
    this.logger.rabbitmq(
      `Forwarded ${eventName} to ${NOTIFICATIONS_REALTIME_QUEUE} with eventId: ${eventId}`,
    );
  }

  /**
   * EN -
   * Processes generic domain events by filtering and forwarding friend/notification events.
   * Extracts event name, checks if forwarding is needed, enriches payload, and forwards to realtime queue.
   *
   * PT -
   * Processa eventos de domínio genéricos filtrando e encaminhando eventos de amizade/notificação.
   * Extrai nome do evento, verifica se encaminhamento é necessário, enriquece payload e encaminha para fila realtime.
   *
   * @param payload - Generic domain event payload
   */
  protected async process(payload: any): Promise<void> {
    const eventName = this.extractEventName(payload);

    if (!this.shouldForwardEvent(eventName)) {
      return;
    }

    const eventId = this.resolveEventId(eventName);
    const enrichedPayload = this.enrichPayloadWithEventId(payload, eventId);

    await this.ensureRealtimeQueuesExist();
    await this.forwardToRealtimeQueue(enrichedPayload, eventName, eventId);
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
 * Creates and starts the GenericEventsConsumer instance.
 * Initializes the consumer with all required dependencies and begins message consumption.
 *
 * PT -
 * Cria e inicia a instância do GenericEventsConsumer.
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
  const consumer = new GenericEventsConsumer(rabbit, config);
  await consumer.start();
  logger.default("Generic events consumer started.");
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
  const logger = new LoggerService("GenericEventsConsumer", config);
  logger.default("Starting generic events consumer...");

  try {
    const rabbit = await initializeRabbitMQ(config);
    await startConsumer(rabbit, config, logger);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    logger.error(`Failed to start generic events consumer: ${errorMessage}`);
    process.exit(1);
  }
}

if (require.main === module) {
  bootstrap();
}

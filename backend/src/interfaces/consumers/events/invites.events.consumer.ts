import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

const INVITES_EVENTS_QUEUE = "events.invites";
const NOTIFICATIONS_REALTIME_QUEUE = "notifications.realtimes";
const DLQ_REALTIME_NOTIFICATIONS = "dlq.notifications.realtimes";
const DLQ_INVITES = "dlq.events.invites";

/**
 * EN -
 * InvitesEventsConsumer - Consumer for invite-related domain events that forwards to realtime queue.
 * 
 * This consumer processes invite domain events (created, accepted, rejected) and forwards them
 * to the realtime notifications queue for WebSocket delivery to connected clients.
 * 
 * Architecture:
 * - Consumes from 'events.invites' queue (invite domain events)
 * - Forwards all invite events to 'notifications.realtimes' queue
 * - Uses DLQ for failed message handling
 * - Ensures realtime queue exists before forwarding
 * 
 * Event Processing:
 * - All invite events are forwarded without modification
 * - Events are serialized as JSON buffers
 * - Queue initialization is performed before each forward operation
 * 
 * PT -
 * InvitesEventsConsumer - Consumidor para eventos de domínio relacionados a convites que encaminha para fila realtime.
 * 
 * Este consumidor processa eventos de domínio de convites (criado, aceito, rejeitado) e os encaminha
 * para a fila de notificações realtime para entrega via WebSocket para clientes conectados.
 * 
 * Arquitetura:
 * - Consome da fila 'events.invites' (eventos de domínio de convites)
 * - Encaminha todos os eventos de convite para fila 'notifications.realtimes'
 * - Usa DLQ para tratamento de mensagens com falha
 * - Garante que fila realtime existe antes de encaminhar
 * 
 * Processamento de Eventos:
 * - Todos os eventos de convite são encaminhados sem modificação
 * - Eventos são serializados como buffers JSON
 * - Inicialização de fila é realizada antes de cada operação de encaminhamento
 */
class InvitesEventsConsumer extends BaseResilientConsumer<any> {
    constructor(rabbit: RabbitMQService, config: ConfigService) {
        super(rabbit, {
            queue: INVITES_EVENTS_QUEUE,
            dlq: DLQ_INVITES,
            prefetch: parseInt((config.get("app.rabbitmq.prefetch") as any) ?? "50", 10),
            retryMax: parseInt((config.get("app.rabbitmq.retryMax") as any) ?? "5", 10),
            redisUrl: (config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://redis:6379',
            dedupTtlSeconds: 60,
        }, config);
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
            deadLetterExchange: '',
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
     * Forwards invite event payload to realtime notifications queue for WebSocket delivery.
     * Ensures queues exist, serializes payload, and sends to queue.
     * 
     * PT -
     * Encaminha payload de evento de convite para fila de notificações realtime para entrega via WebSocket.
     * Garante que filas existam, serializa payload e envia para fila.
     * 
     * @param payload - Invite event payload to forward
     */
    private async forwardToRealtimeQueue(payload: any): Promise<void> {
        await this.ensureRealtimeQueuesExist();
        const serializedPayload = this.serializePayload(payload);
        await this.rabbit.sendToQueue(NOTIFICATIONS_REALTIME_QUEUE, serializedPayload);
    }

    /**
     * EN -
     * Processes invite domain events by forwarding them to realtime notifications queue.
     * All invite events are forwarded without modification for WebSocket delivery.
     * 
     * PT -
     * Processa eventos de domínio de convites encaminhando-os para fila de notificações realtime.
     * Todos os eventos de convite são encaminhados sem modificação para entrega via WebSocket.
     * 
     * @param payload - Invite domain event payload
     */
    protected async process(payload: any): Promise<void> {
        await this.forwardToRealtimeQueue(payload);
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
async function initializeRabbitMQ(config: ConfigService): Promise<RabbitMQService> {
    const rabbit = new (require("@infrastructure/messaging/services/rabbitmq.service").RabbitMQService)(config);
    await rabbit.onModuleInit();
    return rabbit;
}

/**
 * EN -
 * Creates and starts the InvitesEventsConsumer instance.
 * Initializes the consumer with all required dependencies and begins message consumption.
 * 
 * PT -
 * Cria e inicia a instância do InvitesEventsConsumer.
 * Inicializa o consumidor com todas as dependências necessárias e inicia o consumo de mensagens.
 * 
 * @param rabbit - RabbitMQ service instance
 * @param config - Configuration service instance
 * @param logger - Logger service instance for logging consumer status
 */
async function startConsumer(rabbit: RabbitMQService, config: ConfigService, logger: LoggerService): Promise<void> {
    const consumer = new InvitesEventsConsumer(rabbit, config);
    await consumer.start();
    logger.default("Invites events consumer started.");
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
    const logger = new LoggerService("InvitesEventsConsumer", config);
    logger.default("Starting invites events consumer...");
    
    try {
        const rabbit = await initializeRabbitMQ(config);
        await startConsumer(rabbit, config, logger);
    } catch (error: any) {
        const errorMessage = error?.message || String(error);
        logger.error(`Failed to start invites events consumer: ${errorMessage}`);
        process.exit(1);
    }
}

if (require.main === module) {
    bootstrap();
}

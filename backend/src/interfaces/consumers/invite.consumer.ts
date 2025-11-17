import {ConfigService} from "@nestjs/config";
import {INVITE_QUEUE, RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {LoggerService} from "@infrastructure/logging/logger.service";

/**
 * EN -
 * InviteConsumer - Consumer for invite queue messages that logs invite processing.
 * 
 * This consumer processes invite queue messages, parsing and logging invite details.
 * Used for monitoring and tracking invite creation and processing.
 * 
 * Architecture:
 * - Consumes from 'invites' queue
 * - Logs invite events for monitoring
 * - Handles message parsing errors gracefully
 * - Uses manual acknowledgment for reliable processing
 * 
 * Message Processing:
 * - Parses JSON payload from message content
 * - Logs invite email and token for tracking
 * - Acknowledges successful processing
 * - Rejects messages with parsing errors
 * 
 * PT -
 * InviteConsumer - Consumidor para mensagens da fila de convites que registra processamento de convites.
 * 
 * Este consumidor processa mensagens da fila de convites, fazendo parsing e registrando detalhes dos convites.
 * Usado para monitoramento e rastreamento de criação e processamento de convites.
 * 
 * Arquitetura:
 * - Consome da fila 'invites'
 * - Registra eventos de convite para monitoramento
 * - Trata erros de parsing de mensagens graciosamente
 * - Usa confirmação manual para processamento confiável
 * 
 * Processamento de Mensagens:
 * - Faz parsing de payload JSON do conteúdo da mensagem
 * - Registra email e token do convite para rastreamento
 * - Confirma processamento bem-sucedido
 * - Rejeita mensagens com erros de parsing
 */
export class InviteConsumer {
    private readonly logger: LoggerService;

    constructor(
        private readonly rabbitmqService: RabbitMQService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(InviteConsumer.name, configService);
    }

    /**
     * EN -
     * Initializes invite queue if it doesn't exist.
     * Ensures queue is durable for message persistence across broker restarts.
     * 
     * PT -
     * Inicializa fila de convites se não existir.
     * Garante que fila seja durável para persistência de mensagens entre reinicializações do broker.
     * 
     * @param channel - RabbitMQ channel instance
     */
    private async initializeQueue(channel: any): Promise<void> {
        await channel.assertQueue(INVITE_QUEUE, {durable: true});
    }

    /**
     * EN -
     * Parses message content from buffer to JSON object.
     * Converts message buffer to string and parses as JSON.
     * 
     * PT -
     * Faz parsing do conteúdo da mensagem de buffer para objeto JSON.
     * Converte buffer da mensagem para string e faz parsing como JSON.
     * 
     * @param content - Message content as string
     * @returns Parsed payload object
     * @throws Error if JSON parsing fails
     */
    private parseMessageContent(content: string): any {
        return JSON.parse(content);
    }

    /**
     * EN -
     * Logs invite event details for monitoring and tracking.
     * Extracts email and token from payload and logs them.
     * 
     * PT -
     * Registra detalhes do evento de convite para monitoramento e rastreamento.
     * Extrai email e token do payload e os registra.
     * 
     * @param payload - Parsed invite payload
     */
    private logInviteDetails(payload: any): void {
        this.logger.rabbitmq(`Invite queued for ${payload.email} with token ${payload.token}`);
    }

    /**
     * EN -
     * Processes a single invite message from the queue.
     * Parses content, logs details, and acknowledges message on success.
     * 
     * PT -
     * Processa uma única mensagem de convite da fila.
     * Faz parsing do conteúdo, registra detalhes e confirma mensagem em caso de sucesso.
     * 
     * @param channel - RabbitMQ channel instance
     * @param msg - RabbitMQ message object
     */
    private async processMessage(channel: any, msg: any): Promise<void> {
        if (!msg) {
            return;
        }

        const content = msg.content.toString();
        const contentPreview = content.substring(0, 100);
        this.logger.rabbitmq(`Invite event received: ${contentPreview}`);

        try {
            const payload = this.parseMessageContent(content);
            this.logInviteDetails(payload);
            channel.ack(msg);
        } catch (error: any) {
            const errorMessage = error?.message || String(error);
            this.logger.rabbitmq(`Error processing message: ${errorMessage}`);
            channel.nack(msg, false, false);
        }
    }

    /**
     * EN -
     * Starts consuming messages from the invite queue.
     * Initializes queue, sets up message handler, and begins consumption.
     * 
     * PT -
     * Inicia consumo de mensagens da fila de convites.
     * Inicializa fila, configura handler de mensagens e inicia consumo.
     */
    async start(): Promise<void> {
        const channel = await this.rabbitmqService.getChannel();
        await this.initializeQueue(channel);

        this.logger.rabbitmq(`Waiting for messages in queue: ${INVITE_QUEUE}`);

        channel.consume(
            INVITE_QUEUE,
            (msg: any) => this.processMessage(channel, msg),
            {noAck: false},
        );
    }
}

/**
 * EN -
 * Gets RabbitMQ URL from environment variables or uses default.
 * Checks multiple environment variables for flexibility in different deployment scenarios.
 * 
 * PT -
 * Obtém URL do RabbitMQ de variáveis de ambiente ou usa padrão.
 * Verifica múltiplas variáveis de ambiente para flexibilidade em diferentes cenários de deployment.
 * 
 * @returns RabbitMQ connection URL string
 */
function getRabbitMQUrl(): string {
    return (
        process.env.RABBITMQ_URL ||
        process.env.RABBITMQ_URL_INTERNAL ||
        "amqp://guest:guest@rabbitmq:5672"
    );
}

/**
 * EN -
 * Configures ConfigService with RabbitMQ URL for service initialization.
 * Sets internal configuration with RabbitMQ connection URL.
 * 
 * PT -
 * Configura ConfigService com URL do RabbitMQ para inicialização do serviço.
 * Define configuração interna com URL de conexão do RabbitMQ.
 * 
 * @param config - Configuration service instance
 * @param rabbitmqUrl - RabbitMQ connection URL
 */
function configureRabbitMQUrl(config: ConfigService, rabbitmqUrl: string): void {
    (config as any).internalConfig = {app: {rabbitmqUrl}};
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
    const rabbitmqUrl = getRabbitMQUrl();
    configureRabbitMQUrl(config, rabbitmqUrl);
    
    const rabbitService = new RabbitMQService(config as any);
    await rabbitService.onModuleInit();
    return rabbitService;
}

/**
 * EN -
 * Creates and starts the InviteConsumer instance.
 * Initializes the consumer with all required dependencies and begins message consumption.
 * 
 * PT -
 * Cria e inicia a instância do InviteConsumer.
 * Inicializa o consumidor com todas as dependências necessárias e inicia o consumo de mensagens.
 * 
 * @param rabbitService - RabbitMQ service instance
 * @param config - Configuration service instance
 * @param logger - Logger service instance for logging consumer status
 */
async function startConsumer(
    rabbitService: RabbitMQService,
    config: ConfigService,
    logger: LoggerService
): Promise<void> {
    const consumer = new InviteConsumer(rabbitService, config);
    await consumer.start();
    logger.default("Invite consumer worker started and listening.");
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
    const logger = new LoggerService("WorkerBootstrap", config);
    logger.default("Starting invites consumer worker...");

    try {
        const rabbitService = await initializeRabbitMQ(config);
        await startConsumer(rabbitService, config, logger);
    } catch (error: any) {
        const errorMessage = error?.message || String(error);
        logger.error(`Failed to start invite consumer: ${errorMessage}`);
        process.exit(1);
    }
}

if (require.main === module) {
    bootstrap();
}

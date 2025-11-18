import {ConfigService} from "@nestjs/config";
import {INVITE_QUEUE, RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {LoggerService} from "@infrastructure/logging/logger.service";

export class InviteConsumer {
    private readonly logger: LoggerService;

    constructor(
        private readonly rabbitmqService: RabbitMQService,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new LoggerService(InviteConsumer.name, configService);
    }

    async start() {
        const channel = await this.rabbitmqService.getChannel();
        await channel.assertQueue(INVITE_QUEUE, {durable: true});

        this.logger.rabbitmq(`Waiting for messages in queue: ${INVITE_QUEUE}`);

        channel.consume(
            INVITE_QUEUE,
            (msg: any) => {
                if (msg) {
                    const content = msg.content.toString();
                    this.logger.rabbitmq(`Invite event received: ${content.substring(0, 100)}`);

                    try {
                        const payload = JSON.parse(content);
                        this.logger.rabbitmq(`Invite queued for ${payload.email} with token ${payload.token}`);
                        channel.ack(msg);
                    } catch (error: any) {
                        this.logger.rabbitmq(`Error processing message: ${error?.message || String(error)}`);
                        channel.nack(msg, false, false);
                    }
                }
            },
            {noAck: false},
        );
    }
}

async function bootstrap() {
    const config = new ConfigService();
    const logger = new LoggerService("WorkerBootstrap", config);
    logger.default("Starting invites consumer worker...");

    const rabbitmqUrl =
        process.env.RABBITMQ_URL ||
        process.env.RABBITMQ_URL_INTERNAL ||
        "amqp://guest:guest@rabbitmq:5672";

    (config as any).internalConfig = {app: {rabbitmqUrl}};

    const rabbitService = new RabbitMQService(config as any);
    await rabbitService.onModuleInit();
    const consumer = new InviteConsumer(rabbitService, config);
    await consumer.start();

    logger.default("Invite consumer worker started and listening.");
}

if (require.main === module) {
    bootstrap();
}

import {ConfigService} from "@nestjs/config";
import {Logger} from "@nestjs/common";
import {INVITE_QUEUE, RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";

export class InviteConsumer {
    private readonly logger = new Logger(InviteConsumer.name);

    constructor(private readonly rabbitmqService: RabbitMQService) {
    }

    async start() {
        const channel = await this.rabbitmqService.getChannel();
        await channel.assertQueue(INVITE_QUEUE, {durable: true});

        this.logger.log(`Waiting for messages in ${INVITE_QUEUE}`);

        channel.consume(
            INVITE_QUEUE,
            (msg: any) => {
                if (msg) {
                    const content = msg.content.toString();
                    this.logger.log(`Received invite event: ${content}`);

                    try {
                        const payload = JSON.parse(content);
                        this.logger.log(
                            `Invite queued for ${payload.email} with token ${payload.token}`,
                        );
                        channel.ack(msg);
                    } catch (error) {
                        this.logger.error(`Error processing message: ${error}`);
                        channel.nack(msg, false, false);
                    }
                }
            },
            {noAck: false},
        );
    }
}

async function bootstrap() {
    const logger = new Logger("WorkerBootstrap");
    logger.log("Starting invites consumer worker...");

    const config = new ConfigService();
    const rabbitmqUrl =
        process.env.RABBITMQ_URL ||
        process.env.RABBITMQ_URL_INTERNAL ||
        "amqp://guest:guest@rabbitmq:5672";
    (config as any).internalConfig = {app: {rabbitmqUrl}};

    const rabbitService = new RabbitMQService(config as any);
    await rabbitService.onModuleInit();
    const consumer = new InviteConsumer(rabbitService);
    await consumer.start();

    logger.log("Invite consumer worker started and listening.");
}

if (require.main === module) {
    bootstrap();
}

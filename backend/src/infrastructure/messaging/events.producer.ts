import {Injectable, Logger} from "@nestjs/common";
import {RabbitMQService} from "./rabbitmq.service";

export const EVENTS_QUEUE = "events";

@Injectable()
export class EventsProducer {
    private readonly logger = new Logger(EventsProducer.name);

    constructor(private readonly rabbitmqService: RabbitMQService) {
    }

    async emitGenericEvent(payload: Record<string, unknown>): Promise<void> {
        try {
            await this.rabbitmqService.assertQueue(EVENTS_QUEUE);
            await this.rabbitmqService.sendToQueue(
                EVENTS_QUEUE,
                Buffer.from(JSON.stringify(payload)),
            );
        } catch (error) {
            this.logger.error("Failed to emit generic event", error as Error);
        }
    }
}

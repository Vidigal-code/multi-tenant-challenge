import {Injectable, Logger} from "@nestjs/common";
import {RabbitMQService} from "./rabbitmq.service";

export const INVITE_QUEUE = "invites";

@Injectable()
export class InviteProducer {
    private readonly logger = new Logger(InviteProducer.name);

    constructor(private readonly rabbitmqService: RabbitMQService) {
    }

    async emitInviteCreated(payload: Record<string, unknown>): Promise<void> {
        try {
            await this.rabbitmqService.assertQueue(INVITE_QUEUE);
            await this.rabbitmqService.sendToQueue(
                INVITE_QUEUE,
                Buffer.from(JSON.stringify(payload)),
            );
        } catch (error) {
            this.logger.error("Failed to emit invite event", error as Error);
        }
    }
}

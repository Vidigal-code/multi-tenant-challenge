import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "../services/rabbitmq.service";
import {LoggerService} from "@infrastructure/logging/logger.service";

export const INVITE_QUEUE = "invites";
export const INVITES_EVENTS_QUEUE = "events.invites";

function serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => serializeBigInt(item));
    }
    
    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = serializeBigInt(obj[key]);
            }
        }
        return result;
    }
    
    return obj;
}

@Injectable()
export class InviteProducer {
    private readonly logger: LoggerService;

    constructor(
        private readonly rabbitmqService: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
        this.logger = new LoggerService(InviteProducer.name, configService);
    }

    async emitInviteCreated(payload: Record<string, unknown>): Promise<void> {
        try {
            this.logger.rabbitmq(`Emitting invite created event to queue: ${INVITE_QUEUE}`);
            await this.rabbitmqService.assertQueue(INVITE_QUEUE);
            const serializedPayload = serializeBigInt(payload);
            await this.rabbitmqService.sendToQueue(
                INVITE_QUEUE,
                Buffer.from(JSON.stringify(serializedPayload)),
            );
            this.logger.rabbitmq(`Invite created event emitted successfully to: ${INVITE_QUEUE}`);
        } catch (error) {
            this.logger.rabbitmq(`Failed to emit invite event: ${(error as Error)?.message}`);
        }
    }

    async emitInviteEvent(payload: Record<string, unknown>): Promise<void> {
        try {
            this.logger.rabbitmq(`Emitting invite event to queue: ${INVITES_EVENTS_QUEUE}`);
            await this.rabbitmqService.assertEventQueue(INVITES_EVENTS_QUEUE, "dlq.events.invites");
            const serializedPayload = serializeBigInt(payload);
            await this.rabbitmqService.sendToQueue(
                INVITES_EVENTS_QUEUE,
                Buffer.from(JSON.stringify(serializedPayload)),
            );
            this.logger.rabbitmq(`Invite event emitted successfully to: ${INVITES_EVENTS_QUEUE}`);
        } catch (error: any) {
            if (error?.code === 406) {
                this.logger.rabbitmq(`Queue ${INVITES_EVENTS_QUEUE} exists with different config. Attempting to send anyway...`);
                try {
                    const serializedPayload = serializeBigInt(payload);
                    await this.rabbitmqService.sendToQueue(
                        INVITES_EVENTS_QUEUE,
                        Buffer.from(JSON.stringify(serializedPayload)),
                    );
                } catch (sendError) {
                    this.logger.rabbitmq(`Failed to send invite event after config mismatch: ${(sendError as Error)?.message}`);
                }
            } else {
                this.logger.rabbitmq(`Failed to emit invite event: ${error?.message}`);
            }
        }
    }
}

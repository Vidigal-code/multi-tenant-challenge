import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "../services/rabbitmq.service";
import {LoggerService} from "@infrastructure/logging/logger.service";

export const EVENTS_QUEUE = "events";
export const MEMBERS_EVENTS_QUEUE = "events.members";

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
export class EventsProducer {
    private readonly logger: LoggerService;

    constructor(
        private readonly rabbitmqService: RabbitMQService,
        private readonly configService: ConfigService,
    ) {
        this.logger = new LoggerService(EventsProducer.name, configService);
    }

    async emitGenericEvent(payload: Record<string, unknown>): Promise<void> {
        try {
            this.logger.rabbitmq(`Emitting generic event to queue: ${EVENTS_QUEUE}`);
            await this.rabbitmqService.assertEventQueue(EVENTS_QUEUE, "dlq.events");
            const serializedPayload = serializeBigInt(payload);
            await this.rabbitmqService.sendToQueue(
                EVENTS_QUEUE,
                Buffer.from(JSON.stringify(serializedPayload)),
            );
            this.logger.rabbitmq(`Generic event emitted successfully to: ${EVENTS_QUEUE}`);
        } catch (error: any) {
            if (error?.code === 406) {
                this.logger.rabbitmq(`Queue ${EVENTS_QUEUE} exists with different config. Attempting to send anyway...`);
                try {
                    const serializedPayload = serializeBigInt(payload);
                    await this.rabbitmqService.sendToQueue(
                        EVENTS_QUEUE,
                        Buffer.from(JSON.stringify(serializedPayload)),
                    );
                } catch (sendError) {
                    this.logger.rabbitmq(`Failed to send generic event after config mismatch: ${(sendError as Error)?.message}`);
                }
            } else {
                this.logger.error(`Failed to emit generic event: ${error?.message || String(error)}`);
            }
        }
    }

    async emitMemberEvent(payload: Record<string, unknown>): Promise<void> {
        try {
            this.logger.rabbitmq(`Emitting member event to queue: ${MEMBERS_EVENTS_QUEUE}`);
            await this.rabbitmqService.assertEventQueue(MEMBERS_EVENTS_QUEUE, "dlq.events.members");
            const serializedPayload = serializeBigInt(payload);
            await this.rabbitmqService.sendToQueue(
                MEMBERS_EVENTS_QUEUE,
                Buffer.from(JSON.stringify(serializedPayload)),
            );
            this.logger.rabbitmq(`Member event emitted successfully to: ${MEMBERS_EVENTS_QUEUE}`);
        } catch (error: any) {
            if (error?.code === 406) {
                this.logger.rabbitmq(`Queue ${MEMBERS_EVENTS_QUEUE} exists with different config. Attempting to send anyway...`);
                try {
                    const serializedPayload = serializeBigInt(payload);
                    await this.rabbitmqService.sendToQueue(
                        MEMBERS_EVENTS_QUEUE,
                        Buffer.from(JSON.stringify(serializedPayload)),
                    );
                } catch (sendError) {
                    this.logger.rabbitmq(`Failed to send member event after config mismatch: ${(sendError as Error)?.message}`);
                }
            } else {
                this.logger.rabbitmq(`Failed to emit member event: ${error?.message}`);
            }
        }
    }
}

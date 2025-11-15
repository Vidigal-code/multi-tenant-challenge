import {Injectable} from "@nestjs/common";
import {DomainEvent, DomainEventsService,} from "@domain/services/domain-events.service";
import {InviteProducer} from "./invite.producer";
import {EventsProducer} from "./events.producer";

@Injectable()
export class RabbitMQDomainEventsService implements DomainEventsService {
    constructor(
        private readonly inviteProducer: InviteProducer,
        private readonly eventsProducer: EventsProducer,
    ) {
    }

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        switch (event.name) {
            case "invite.created": {
                await this.inviteProducer.emitInviteCreated(
                    event.payload as Record<string, unknown>,
                );
                break;
            }
            case "membership.removed": {
                await this.eventsProducer.emitGenericEvent(
                    event.payload as Record<string, unknown>,
                );
                break;
            }
            case "membership.role.updated": {
                await this.eventsProducer.emitGenericEvent(
                    event.payload as Record<string, unknown>,
                );
                break;
            }
            default:
                break;
        }
    }
}

import {Injectable} from "@nestjs/common";
import {DomainEvent, DomainEventsService,} from "@domain/services/domain-events.service";
import {InviteProducer} from "../producers/invite.producer";
import {EventsProducer} from "../producers/events.producer";

@Injectable()
export class RabbitMQDomainEventsService implements DomainEventsService {
    constructor(
        private readonly inviteProducer: InviteProducer,
        private readonly eventsProducer: EventsProducer,
    ) {
    }

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        switch (event.name) {
            case "invites.created": {
                await this.inviteProducer.emitInviteCreated(
                    event.payload as Record<string, unknown>,
                );
                break;
            }
            case "memberships.removed": {
                await this.eventsProducer.emitGenericEvent(
                    event.payload as Record<string, unknown>,
                );
                break;
            }
            case "memberships.role.updated": {
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

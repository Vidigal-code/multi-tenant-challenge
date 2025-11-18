import {Injectable} from "@nestjs/common";
import {DomainEvent, DomainEventsService,} from "@domain/services/domain-events.service";
import {InviteProducer} from "../producers/invite.producer";
import {EventsProducer} from "../producers/events.producer";

/**
 * RabbitMQDomainEventsService - Publishes domain events to RabbitMQ queues
 * 
 * Architecture for millions of events:
 * - Events are routed to specific queues based on event type
 * - Each event type has dedicated queue for isolation
 * - Workers process events asynchronously
 * - Supports horizontal scaling with multiple workers
 * 
 * Event Routing:
 * - invites.* -> InviteProducer -> events.invites queue (consumed by InvitesEventsConsumer)
 * - memberships.* -> EventsProducer -> events.members queue (consumed by MembersEventsConsumer)
 * - Generic events -> EventsProducer -> events queue
 * 
 * For high-scale:
 * - Deploy multiple workers per queue type
 * - Monitor queue depths and processing rates
 * - Use RabbitMQ Cluster for high availability
 * 
 * Serviço RabbitMQ que publica eventos de domínio em filas RabbitMQ
 * 
 * Arquitetura para milhões de eventos:
 * - Eventos são roteados para filas específicas baseado no tipo de evento
 * - Cada tipo de evento tem fila dedicada para isolamento
 * - Workers processam eventos assincronamente
 * - Suporta escalonamento horizontal com múltiplos workers
 * 
 * Roteamento de Eventos:
 * - invites.* -> InviteProducer -> fila events.invites (consumido por InvitesEventsConsumer)
 * - memberships.* -> EventsProducer -> fila events.members (consumido por MembersEventsConsumer)
 * - Eventos genéricos -> EventsProducer -> fila events
 * 
 * Para alta escala:
 * - Faça deploy de múltiplos workers por tipo de fila
 * - Monitore profundidade de filas e taxas de processamento
 * - Use RabbitMQ Cluster para alta disponibilidade
 */
@Injectable()
export class RabbitMQDomainEventsService implements DomainEventsService {
    constructor(
        private readonly inviteProducer: InviteProducer,
        private readonly eventsProducer: EventsProducer,
    ) {
    }

    async publish<T>(event: DomainEvent<T>): Promise<void> {
        const payload = event.payload as Record<string, unknown>;
        
        switch (event.name) {
            case "invites.created":
            case "invites.accepted":
            case "invites.rejected": {
                await this.inviteProducer.emitInviteCreated(payload);
                await this.inviteProducer.emitInviteEvent({
                    ...payload,
                    eventName: event.name,
                });
                break;
            }
            case "memberships.joined":
            case "memberships.removed":
            case "memberships.role.updated":
            case "memberships.left": {
                await this.eventsProducer.emitMemberEvent({
                    ...payload,
                    eventName: event.name,
                });
                break;
            }
            default: {
                await this.eventsProducer.emitGenericEvent({
                    ...payload,
                    eventName: event.name,
                });
                break;
            }
        }
    }
}

import {Module} from "@nestjs/common";
import {ConfigModule} from "@nestjs/config";
import {RabbitMQService} from "./rabbitmq.service";
import {InviteProducer} from "./invite.producer";
import {RabbitMQDomainEventsService} from "./domain-events.service";
import {EventsProducer} from "./events.producer";

@Module({
    imports: [ConfigModule],
    providers: [
        RabbitMQService,
        InviteProducer,
        EventsProducer,
        RabbitMQDomainEventsService,
        {
            provide: "DOMAIN_EVENTS_SERVICE",
            useClass: RabbitMQDomainEventsService,
        },
    ],
    exports: [
        RabbitMQService,
        InviteProducer,
        EventsProducer,
        RabbitMQDomainEventsService,
        "DOMAIN_EVENTS_SERVICE",
    ],
})
export class RabbitMQModule {
}

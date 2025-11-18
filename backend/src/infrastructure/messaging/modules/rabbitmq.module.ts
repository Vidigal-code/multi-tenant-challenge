import {Module} from "@nestjs/common";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {RabbitMQService} from "../services/rabbitmq.service";
import {InviteProducer} from "../producers/invite.producer";
import {RabbitMQDomainEventsService} from "../services/domain-events.service";
import {EventsProducer} from "../producers/events.producer";
import {DeliveryConfirmationService} from "../services/delivery-confirmation.service";

@Module({
    imports: [ConfigModule],
    providers: [
        RabbitMQService,
        DeliveryConfirmationService,
        {
            provide: InviteProducer,
            useFactory: (rabbitmqService: RabbitMQService, configService: ConfigService) => {
                return new InviteProducer(rabbitmqService, configService);
            },
            inject: [RabbitMQService, ConfigService],
        },
        {
            provide: EventsProducer,
            useFactory: (rabbitmqService: RabbitMQService, configService: ConfigService) => {
                return new EventsProducer(rabbitmqService, configService);
            },
            inject: [RabbitMQService, ConfigService],
        },
        RabbitMQDomainEventsService,
        {
            provide: "DOMAIN_EVENTS_SERVICE",
            useClass: RabbitMQDomainEventsService,
        },
    ],
    exports: [
        RabbitMQService,
        DeliveryConfirmationService,
        InviteProducer,
        EventsProducer,
        RabbitMQDomainEventsService,
        "DOMAIN_EVENTS_SERVICE",
    ],
})
export class RabbitMQModule {
}

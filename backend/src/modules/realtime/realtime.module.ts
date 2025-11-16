import {Module} from '@nestjs/common';
import {RealtimeController} from '@interfaces/http/realtimes/realtime.controller';
import {InfrastructureModule} from '@infrastructure/infrastructure.module';
import {NotificationCreatorService} from '@application/services/notification-creator.service';
import {EventPayloadBuilderService} from '@application/services/event-payload-builder.service';
import {NotificationMessageFormatterService} from '@application/services/notification-message-formatter.service';
import {ConfigModule} from '@nestjs/config';

@Module({
    imports: [InfrastructureModule, ConfigModule],
    controllers: [RealtimeController],
    providers: [
        NotificationCreatorService,
        EventPayloadBuilderService,
        NotificationMessageFormatterService,
        {
            provide: 'EventPayloadBuilderService',
            useExisting: EventPayloadBuilderService,
        },
    ],
    exports: [NotificationCreatorService, EventPayloadBuilderService, NotificationMessageFormatterService, 'EventPayloadBuilderService'],
})
export class RealtimeModule {
}

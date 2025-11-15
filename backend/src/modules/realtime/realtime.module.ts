import {Module} from '@nestjs/common';
import {RealtimeController} from '@interfaces/http/realtimes/realtime.controller';
import {InfrastructureModule} from '@infrastructure/infrastructure.module';
import {NotificationCreatorService} from '@application/services/notification-creator.service';
import {ConfigModule} from '@nestjs/config';

@Module({
    imports: [InfrastructureModule, ConfigModule],
    controllers: [RealtimeController],
    providers: [NotificationCreatorService],
    exports: [NotificationCreatorService],
})
export class RealtimeModule {
}

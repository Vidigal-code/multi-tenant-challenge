import {Module} from "@nestjs/common";
import {APP_FILTER, APP_INTERCEPTOR} from "@nestjs/core";
import {ConfigModule} from "@nestjs/config";
import {appConfig} from "@config/app.config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {AuthInfraModule} from "@infrastructure/auth/auth-infra.module";
import {RabbitMQModule} from "@infrastructure/messaging/rabbitmq.module";
import {AuthModule} from "@modules/auth/auth.module";
import {CompanyModule} from "@modules/company/company.module";
import {MembershipModule} from "@modules/membership/membership.module";
import {FriendshipModule} from "@modules/friendship/friendship.module";
import {UsersModule} from "@modules/users/users.module";
import {AllExceptionsFilter} from "@common/filters/all-exceptions.filter";
import {BigIntSerializationInterceptor} from "@common/interceptors/bigint-serialization.interceptor";
import {RabbitMQDomainEventsService} from "@infrastructure/messaging/domain-events.service";
import {WsDomainEventsBridgeService} from "./realtime/ws-domain-events.service";
import {ObservabilityModule} from "@modules/observability/observability.module";
import {RequestMetricsInterceptor} from "@modules/observability/services/request-metrics.interceptor";
import {LoggerModule} from "nestjs-pino";
import {EventsGateway} from "./realtime/events.gateway";
import {RealtimeModule} from "./modules/realtime/realtime.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [appConfig],
            envFilePath: [".env", ".env.local"],
        }),
        InfrastructureModule,
        AuthInfraModule,
        RabbitMQModule,
        AuthModule,
        CompanyModule,
        MembershipModule,
        FriendshipModule,
        UsersModule,
        RealtimeModule,
        ObservabilityModule,
        LoggerModule.forRoot({
            pinoHttp: {
                transport:
                    process.env.NODE_ENV !== "production"
                        ? {target: "pino-pretty", options: {singleLine: true}}
                        : undefined,
                autoLogging: false,
            },
        }),
    ],
    providers: [
        {
            provide: APP_FILTER,
            useClass: AllExceptionsFilter,
        },
        RabbitMQDomainEventsService,
        {
            provide: "DOMAIN_EVENTS_SERVICE",
            useClass: WsDomainEventsBridgeService,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: RequestMetricsInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: BigIntSerializationInterceptor,
        },
        EventsGateway,
    ],
})
export class AppModule {
}

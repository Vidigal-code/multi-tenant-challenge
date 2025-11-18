import {Module} from "@nestjs/common";
import {APP_FILTER, APP_INTERCEPTOR} from "@nestjs/core";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {appConfig} from "@config/app.config";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {AuthInfraModule} from "@infrastructure/auth/modules/auth-infra.module";
import {RabbitMQModule} from "@infrastructure/messaging/modules/rabbitmq.module";
import {AuthModule} from "@modules/auths/auth.module";
import {CompanyModule} from "@modules/companys/company.module";
import {MembershipModule} from "@modules/memberships/membership.module";
import {FriendshipModule} from "@modules/friendships/friendship.module";
import {UsersModule} from "@modules/users/users.module";
import {AllExceptionsFilter} from "@common/filters/all-exceptions.filter";
import {BigIntSerializationInterceptor} from "@common/interceptors/bigint-serialization.interceptor";
import {RabbitMQDomainEventsService} from "@infrastructure/messaging/services/domain-events.service";
import {WsDomainEventsBridgeService} from "./realtime/ws-domain-events.service";
import {ObservabilityModule} from "@modules/observability/observability.module";
import {RequestMetricsInterceptor} from "@modules/observability/services/request-metrics.interceptor";
import {LoggerModule} from "nestjs-pino";
import {EventsGateway} from "./realtime/events.gateway";
import {RealtimeModule} from "@modules/realtime/realtime.module";

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
        LoggerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const loggingEnabled = config.get<boolean>("app.logging.enabled", true);
                return {
                    pinoHttp: loggingEnabled
                        ? {
                              transport:
                                  process.env.NODE_ENV !== "production"
                                      ? {target: "pino-pretty", options: {singleLine: true}}
                                      : undefined,
                              autoLogging: false,
                          }
                        : undefined,
                };
            },
        }),
    ],
    providers: [
        {
            provide: APP_FILTER,
            useFactory: (configService: ConfigService) => {
                return new AllExceptionsFilter(configService);
            },
            inject: [ConfigService],
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

import {Module} from "@nestjs/common";
import {HealthController} from "./health.controller";
import {MetricsController} from "./metrics.controller";
import {MetricsService} from "./services/metrics.service";
import {RequestMetricsInterceptor} from "./services/request-metrics.interceptor";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RabbitMQModule} from "@infrastructure/messaging/modules/rabbitmq.module";
import {WorkersController} from "@interfaces/http/workers/workers.controller";
import {AuthInfraModule} from "@infrastructure/auth/modules/auth-infra.module";

@Module({
    imports: [InfrastructureModule, RabbitMQModule, AuthInfraModule],
    controllers: [HealthController, MetricsController, WorkersController],
    providers: [MetricsService, RequestMetricsInterceptor],
    exports: [MetricsService, RequestMetricsInterceptor],
})
export class ObservabilityModule {
}

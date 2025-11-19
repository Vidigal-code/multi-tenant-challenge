import {Module} from "@nestjs/common";
import {HealthController} from "./health.controller";
import {MetricsController} from "./metrics.controller";
import {MetricsService} from "./services/metrics.service";
import {RequestMetricsInterceptor} from "./services/request-metrics.interceptor";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";
import {RabbitMQModule} from "@infrastructure/messaging/modules/rabbitmq.module";
import {WorkersController} from "@interfaces/http/workers/workers.controller";
import {WorkerTokenService} from "./services/worker-token.service";
import {WorkerAuthGuard} from "./guards/worker-auth.guard";

@Module({
    imports: [InfrastructureModule, RabbitMQModule],
    controllers: [HealthController, MetricsController, WorkersController],
    providers: [MetricsService, RequestMetricsInterceptor, WorkerTokenService, WorkerAuthGuard],
    exports: [MetricsService, RequestMetricsInterceptor],
})
export class ObservabilityModule {
}

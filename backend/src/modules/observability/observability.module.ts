import {Module} from "@nestjs/common";
import {HealthController} from "./health.controller";
import {MetricsController} from "./metrics.controller";
import {MetricsService} from "./services/metrics.service";
import {RequestMetricsInterceptor} from "./services/request-metrics.interceptor";
import {InfrastructureModule} from "@infrastructure/infrastructure.module";

@Module({
    imports: [InfrastructureModule],
    controllers: [HealthController, MetricsController],
    providers: [MetricsService, RequestMetricsInterceptor],
    exports: [MetricsService, RequestMetricsInterceptor],
})
export class ObservabilityModule {
}

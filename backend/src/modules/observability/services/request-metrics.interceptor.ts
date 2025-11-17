import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const started = process.hrtime.bigint();
    const req: any = context.switchToHttp().getRequest();
    return next.handle().pipe(
      tap(() => {
        const diffNs = Number(process.hrtime.bigint() - started);
        const durationSeconds = diffNs / 1e9;
        const method = req.method;
        const route = req.route?.path || req.originalUrl || "unknown";
        const status = context.switchToHttp().getResponse()?.statusCode || 0;
        if (
          this.metrics.httpRequestCounter &&
          this.metrics.httpRequestDuration
        ) {
          this.metrics.httpRequestCounter.inc({
            method,
            route,
            status: String(status),
          });
          this.metrics.httpRequestDuration.observe(
            { method, route, status: String(status) },
            durationSeconds,
          );
        }
      }),
    );
  }
}

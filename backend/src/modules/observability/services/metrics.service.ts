import { Injectable, OnModuleInit } from "@nestjs/common";
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

@Injectable()
export class MetricsService implements OnModuleInit {
  httpRequestCounter!: Counter;
  httpRequestDuration!: Histogram;
  private readonly registry = new Registry();

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
    this.httpRequestCounter = new Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status"],
      registers: [this.registry],
    });
    this.httpRequestDuration = new Histogram({
      name: "http_request_duration_seconds",
      help: "Duration of HTTP requests in seconds",
      labelNames: ["method", "route", "status"],
      buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}

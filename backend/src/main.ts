import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { swaggerSetup } from "./swagger";
import { ValidationPipe } from "@nestjs/common";
import pinoHttp from "pino-http";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const loggingEnabled = configService.get<boolean>(
    "app.logging.enabled",
    true,
  );

  app.use(helmet());
  app.use(cookieParser());

  if (loggingEnabled) {
    app.use(
      pinoHttp({
        autoLogging: false,
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
      }),
    );
  }
  const corsOrigins: string[] = [];

  const frontendBaseUrl = process.env.FRONTEND_BASE_URL;
  if (frontendBaseUrl) {
    corsOrigins.push(frontendBaseUrl);
  }

  const wsCorsOrigin = process.env.WS_CORS_ORIGIN;
  if (wsCorsOrigin) {
    const wsOrigins = wsCorsOrigin
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
      .map((origin) => {
        if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
          return `http://${origin}`;
        }
        return origin;
      });

    wsOrigins.forEach((origin) => {
      if (origin !== frontendBaseUrl && !corsOrigins.includes(origin)) {
        corsOrigins.push(origin);
      }
    });
  }

  if (corsOrigins.length === 0) {
    corsOrigins.push("http://localhost:3000");
  }

  const corsSitesEnabled = process.env.CORS_SITES_ENABLED;
  if (corsSitesEnabled) {
    const sites = corsSitesEnabled
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map((site) => site.trim())
      .filter((site) => site.length > 0)
      .map((site) => {
        if (!site.startsWith("http://") && !site.startsWith("https://")) {
          return `http://${site}`;
        }
        return site;
      });

    sites.forEach((site) => {
      if (!corsOrigins.includes(site)) {
        corsOrigins.push(site);
      }
    });
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_MAX || 100),
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  swaggerSetup(app);

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, "0.0.0.0");
}

bootstrap();

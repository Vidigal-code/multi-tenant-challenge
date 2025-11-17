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
  app.enableCors({
    origin: ["http://localhost:3000"],
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

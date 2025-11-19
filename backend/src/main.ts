import {NestFactory} from "@nestjs/core";
import {AppModule} from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import {swaggerSetup} from "./swagger";
import {ValidationPipe} from "@nestjs/common";
import pinoHttp from "pino-http";
import {ConfigService} from "@nestjs/config";
import {
    expandToWebsocketOrigins,
    resolveAllowedOrigins,
} from "@common/utils/origin.util";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {bufferLogs: true});
    const configService = app.get(ConfigService);
    const loggingEnabled = configService.get<boolean>("app.logging.enabled", true);
    const httpCorsOrigins = resolveAllowedOrigins(
        process.env.CORS_SITES_ENABLES,
        process.env.CORS_SITES_ENABLES_ALL,
    );

    const connectSrc =
        httpCorsOrigins === true
            ? ["'self'", "*"]
            : Array.from(new Set(["'self'", ...expandToWebsocketOrigins(httpCorsOrigins)]));
    
    app.use(
        helmet({
            frameguard: {action: "deny"},
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc,
                    fontSrc: ["'self'", "data:", "https:"],
                    objectSrc: ["'none'"],
                    baseUri: ["'self'"],
                    frameAncestors: ["'none'"],
                },
            },
            crossOriginEmbedderPolicy: false,
            referrerPolicy: {policy: "no-referrer"},
        }),
    );
    app.use(cookieParser());
    
    if (loggingEnabled) {
        app.use(
            pinoHttp({
                autoLogging: false,
                transport:
                    process.env.NODE_ENV !== "production"
                        ? {target: "pino-pretty", options: {singleLine: true}}
                        : undefined,
            }),
        );
    }
    app.enableCors({
        origin: httpCorsOrigins,
        credentials: true,
        methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Accept",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
        ],
        exposedHeaders: ["Content-Disposition"],
        maxAge: 86400,
    });
    app.use(
        rateLimit({
            windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
            max: Number(process.env.RATE_LIMIT_MAX || 100),
        }),
    );
    app.useGlobalPipes(new ValidationPipe({whitelist: true, transform: true}));

    swaggerSetup(app);

    const port = Number(process.env.PORT) || 4000;
    const host = process.env.HOST ?? "0.0.0.0";
    await app.listen(port, host);
}

bootstrap();

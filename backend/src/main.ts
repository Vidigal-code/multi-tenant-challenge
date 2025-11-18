import {NestFactory} from "@nestjs/core";
import {AppModule} from "./app.module";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import {swaggerSetup} from "./swagger";
import {ValidationPipe} from "@nestjs/common";
import pinoHttp from "pino-http";
import {ConfigService} from "@nestjs/config";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {bufferLogs: true});
    const configService = app.get(ConfigService);
    const loggingEnabled = configService.get<boolean>(
        "app.logging.enabled",
        true,
    );

    const corsSitesEnabledAll = process.env.CORS_SITES_ENABLES_ALL === "true";
    const nodeEnv = process.env.NODE_ENV || "development";
    const isProduction = nodeEnv === "production";

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL || "http://localhost:3000";
    
    const frontendOrigin = frontendBaseUrl.replace(/\/$/, "");
    
    if (corsSitesEnabledAll) {
        app.use(
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'", frontendOrigin, "http://localhost:4000", "ws://localhost:4000"],
                        fontSrc: ["'self'"],
                        objectSrc: ["'none'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'none'"],
                        baseUri: ["'self'"],
                        formAction: ["'self'"],
                        upgradeInsecureRequests: isProduction ? [] : null,
                    },
                },
                frameguard: {
                    action: "deny",
                },
                xssFilter: true,
                noSniff: true,
                hidePoweredBy: true,
                hsts: isProduction ? {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true,
                } : false,
                crossOriginResourcePolicy: {policy: "cross-origin"},
                crossOriginEmbedderPolicy: false,
                crossOriginOpenerPolicy: {policy: "same-origin-allow-popups"},
                referrerPolicy: {
                    policy: "strict-origin-when-cross-origin",
                },
            }),
        );
    } else {
        app.use(
            helmet({
                contentSecurityPolicy: {
                    directives: {
                        defaultSrc: ["'self'"],
                        styleSrc: ["'self'", "'unsafe-inline'"],
                        scriptSrc: ["'self'"],
                        imgSrc: ["'self'", "data:", "https:"],
                        connectSrc: ["'self'", frontendOrigin, "http://localhost:4000", "ws://localhost:4000"],
                        fontSrc: ["'self'"],
                        objectSrc: ["'none'"],
                        mediaSrc: ["'self'"],
                        frameSrc: ["'none'"],
                        baseUri: ["'self'"],
                        formAction: ["'self'"],
                    },
                },
                frameguard: {
                    action: "deny",
                },
                xssFilter: true,
                noSniff: true,
                hidePoweredBy: true,
                hsts: isProduction ? {
                    maxAge: 31536000,
                    includeSubDomains: true,
                    preload: true,
                } : false,
                crossOriginResourcePolicy: {policy: "same-origin"},
                crossOriginEmbedderPolicy: false,
                crossOriginOpenerPolicy: {policy: "same-origin-allow-popups"},
                referrerPolicy: {
                    policy: "strict-origin-when-cross-origin",
                },
            }),
        );
    }

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

    if (corsSitesEnabledAll) {
        app.enableCors({
            origin: true,
            credentials: true,
        });
    } else {
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

        const corsSitesEnabled = process.env.CORS_SITES_ENABLES;
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
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
            exposedHeaders: ['Set-Cookie'],
        });
    }

    app.use(
        rateLimit({
            windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
            max: Number(process.env.RATE_LIMIT_MAX || 100),
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests from this IP, please try again later.',
        }),
    );

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));

    swaggerSetup(app);

    const port = Number(process.env.PORT) || 4000;
    
    try {
        await app.listen(port, "0.0.0.0");
        console.log(`Application is running on: http://0.0.0.0:${port}`);
        console.log(` Swagger documentation: http://0.0.0.0:${port}/api`);
    } catch (error) {
        console.error("Failed to start application:", error);
        process.exit(1);
    }
}

bootstrap().catch((error) => {
    console.error("Fatal error during bootstrap:", error);
    process.exit(1);
});

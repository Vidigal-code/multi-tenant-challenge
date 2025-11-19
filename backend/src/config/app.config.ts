import {registerAs} from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
    port: parseInt(process.env.PORT ?? "4000", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
    frontendBaseUrl: process.env.FRONTEND_BASE_URL ?? "http://localhost:3000",
    jwt: {
        secret: process.env.JWT_SECRET ?? "secret",
        expiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
        cookieName: process.env.COOKIE_NAME ?? "session",
        algorithm: process.env.JWT_ALGORITHM ?? "HS256",
        privateKey: process.env.JWT_PRIVATE_KEY,
        publicKey: process.env.JWT_PUBLIC_KEY,
    },
    workerJwt: {
        secret: process.env.WORKER_JWT_SECRET ?? process.env.JWT_SECRET,
        expiresIn: process.env.WORKER_JWT_EXPIRES_IN ?? "7d",
        cookieName: process.env.WORKER_JWT_COOKIE_NAME ?? "worker_session",
        algorithm: process.env.WORKER_JWT_ALGORITHM ?? "HS256",
        privateKey: process.env.WORKER_JWT_PRIVATE_KEY ?? process.env.JWT_PRIVATE_KEY,
        publicKey: process.env.WORKER_JWT_PUBLIC_KEY ?? process.env.JWT_PUBLIC_KEY,
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
        max: parseInt(process.env.RATE_LIMIT_MAX ?? "100", 10),
    },
    invite: {
        tokenBytes: parseInt(process.env.INVITE_TOKEN_BYTES ?? "24", 10),
        expiresDays: parseInt(process.env.INVITE_EXPIRES_DAYS ?? "7", 10),
        requireExistingUser:
            (process.env.INVITE_REQUIRE_EXISTING_USER ?? "true").toLowerCase() ===
            "true",
    },
    bcryptCost: parseInt(process.env.BCRYPT_COST ?? "10", 10),
    redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
    rabbitmqUrl: process.env.RABBITMQ_URL ?? "amqp://guest:guest@localhost:5672",
    rabbitmq: {
        prefetch: parseInt(process.env.RABBITMQ_PREFETCH ?? "50", 10),
        retryMax: parseInt(process.env.RABBITMQ_RETRY_MAX ?? "5", 10),
    },
    emailValidation: {
        cacheTtlHitSeconds: parseInt(
            process.env.EMAIL_VALIDATION_TTL_HIT ?? "1800",
            10,
        ),
        cacheTtlMissSeconds: parseInt(
            process.env.EMAIL_VALIDATION_TTL_MISS ?? "120",
            10,
        ),
    },
    logging: {
        enabled: (process.env.BACKEND_LOGGING ?? "true").toLowerCase() !== "false",
        rabbitmq: (process.env.RABBITMQ_LOGGING ?? "false").toLowerCase() === "true",
        websocket: (process.env.WEBSOCKET_LOGGING ?? "false").toLowerCase() === "true",
    },
}));

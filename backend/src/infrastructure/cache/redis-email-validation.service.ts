import {Inject, Injectable, Logger} from "@nestjs/common";
import Redis from "ioredis";
import {EMAIL_VALIDATION_SERVICE, EmailValidationService,} from "@application/ports/email-validation.service";
import {USER_REPOSITORY, UserRepository,} from "@domain/repositories/user.repository";
import {ConfigService} from "@nestjs/config";

@Injectable()
export class RedisEmailValidationService implements EmailValidationService {
    private readonly redis: Redis;
    private readonly logger = new Logger(RedisEmailValidationService.name);
    private readonly ttlHit: number;
    private readonly ttlMiss: number;

    constructor(
        private readonly config: ConfigService,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    ) {
        const url = (this.config.get("app.redisUrl") as string) ||
            process.env.REDIS_URL ||
            "redis://localhost:6379";
        this.redis = new Redis(url);
        this.ttlHit = parseInt(
            (this.config.get("app.emailValidation.cacheTtlHitSeconds") as string) ??
            process.env.EMAIL_VALIDATION_TTL_HIT ??
            "1800",
            10,
        );
        this.ttlMiss = parseInt(
            (this.config.get("app.emailValidation.cacheTtlMissSeconds") as string) ??
            process.env.EMAIL_VALIDATION_TTL_MISS ??
            "120",
            10,
        );
    }

    async exists(emailRaw: string): Promise<boolean> {
        const email = emailRaw.trim().toLowerCase();
        const key = this.key(email);
        try {
            const cached = await this.redis.get(key);
            if (cached !== null) return cached === "1";
        } catch (err) {
            this.logger.warn(`Redis get failed for ${key}: ${String(err)}`);
        }

        const user = await this.users.findByEmail(email);
        const exists = !!user;
        try {
            await this.redis.set(key, exists ? "1" : "0", "EX", exists ? this.ttlHit : this.ttlMiss);
        } catch (err) {
            this.logger.warn(`Redis set failed for ${key}: ${String(err)}`);
        }
        return exists;
    }

    private key(email: string) {
        return `email:exists:${email}`;
    }
}

export const emailValidationProvider = {
    provide: EMAIL_VALIDATION_SERVICE,
    useClass: RedisEmailValidationService,
};

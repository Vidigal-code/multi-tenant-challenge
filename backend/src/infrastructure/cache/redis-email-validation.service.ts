import {Inject, Injectable} from "@nestjs/common";
import Redis from "ioredis";
import {EMAIL_VALIDATION_SERVICE, EmailValidationService,} from "@application/ports/email-validation.service";
import {USER_REPOSITORY, UserRepository,} from "@domain/repositories/users/user.repository";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";

/**
 * RedisEmailValidationService - Email validation with Redis caching
 * 
 * Redis Integration:
 * - Redis cache for email existence validation
 * - Reduces database queries by caching validation results
 * - Different TTL for hits (valid emails) and misses (invalid emails)
 * - Configurable via EMAIL_VALIDATION_TTL_HIT and EMAIL_VALIDATION_TTL_MISS
 * 
 * Cache Strategy:
 * - Hit TTL (default: 1800s = 30min): Longer cache for valid emails
 * - Miss TTL (default: 120s = 2min): Shorter cache for invalid emails
 * 
 * For high-scale:
 * - Use Redis Cluster for high availability
 * - Monitor cache hit rates and adjust TTL values
 * - Configure Redis with appropriate memory limits
 * 
 * Serviço de validação de email com cache Redis
 * 
 * Integração Redis:
 * - Cache Redis para validação de existência de email
 * - Reduz consultas ao banco de dados armazenando resultados de validação
 * - TTL diferente para hits (emails válidos) e misses (emails inválidos)
 * - Configurável via EMAIL_VALIDATION_TTL_HIT e EMAIL_VALIDATION_TTL_MISS
 * 
 * Estratégia de Cache:
 * - TTL de Hit (padrão: 1800s = 30min): Cache mais longo para emails válidos
 * - TTL de Miss (padrão: 120s = 2min): Cache mais curto para emails inválidos
 * 
 * Para alta escala:
 * - Use Redis Cluster para alta disponibilidade
 * - Monitore taxas de cache hit e ajuste valores de TTL
 * - Configure Redis com limites apropriados de memória
 */
@Injectable()
export class RedisEmailValidationService implements EmailValidationService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlHit: number;
    private readonly ttlMiss: number;

    constructor(
        private readonly config: ConfigService,
        @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    ) {
        this.logger = new LoggerService(RedisEmailValidationService.name, config);
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
            if (cached !== null) {
                this.logger.default(`Cache hit for email validation: ${email}`);
                return cached === "1";
            }
        } catch (err) {
            this.logger.error(`Redis get failed for ${key}: ${String(err)}`);
        }

        this.logger.default(`Cache miss - validating email in database: ${email}`);
        const user = await this.users.findByEmail(email);
        const exists = !!user;
        try {
            await this.redis.set(key, exists ? "1" : "0", "EX", exists ? this.ttlHit : this.ttlMiss);
            this.logger.default(`Email ${email} validated: ${exists ? 'exists' : 'does not exist'}, cached for ${exists ? this.ttlHit : this.ttlMiss}s`);
        } catch (err) {
            this.logger.error(`Redis set failed for ${key}: ${String(err)}`);
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

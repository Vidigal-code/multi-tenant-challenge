import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { LoggerService } from "@infrastructure/logging/logger.service";

/**
 * RedisQueryCacheService - Query result caching with Redis and auto-cleanup
 *
 * Architecture for high-scale GET requests:
 * - Caches GET query results in Redis with configurable TTL
 * - Automatic cleanup of expired cache entries
 * - Batch processing support for queue-based queries
 * - Cache key patterns for efficient invalidation
 *
 * Cache Strategy:
 * - TTL-based expiration (default: 300s = 5min)
 * - Automatic cleanup runs periodically to remove expired entries
 * - Cache keys follow pattern: `query:{endpoint}:{paramsHash}`
 *
 * For high-scale:
 * - Use Redis Cluster for high availability
 * - Monitor cache hit rates and adjust TTL values
 * - Configure Redis with appropriate memory limits
 * - Use batch operations for queue processing
 *
 * Serviço de cache de consultas com Redis e limpeza automática
 *
 * Arquitetura para requisições GET de alta escala:
 * - Armazena resultados de consultas GET no Redis com TTL configurável
 * - Limpeza automática de entradas de cache expiradas
 * - Suporte a processamento em lote para consultas baseadas em fila
 * - Padrões de chave de cache para invalidação eficiente
 *
 * Estratégia de Cache:
 * - Expiração baseada em TTL (padrão: 300s = 5min)
 * - Limpeza automática executa periodicamente para remover entradas expiradas
 * - Chaves de cache seguem padrão: `query:{endpoint}:{paramsHash}`
 *
 * Para alta escala:
 * - Use Redis Cluster para alta disponibilidade
 * - Monitore taxas de cache hit e ajuste valores de TTL
 * - Configure Redis com limites apropriados de memória
 * - Use operações em lote para processamento de fila
 */
@Injectable()
export class RedisQueryCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly redis: Redis;
  private readonly logger: LoggerService;
  private readonly ttlSeconds: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly cleanupIntervalMs: number;

  constructor(private readonly configService: ConfigService) {
    this.logger = new LoggerService(RedisQueryCacheService.name, configService);
    const url =
      (this.configService.get("app.redisUrl") as string) ||
      process.env.REDIS_URL ||
      "redis://localhost:6379";
    this.redis = new Redis(url);
    this.ttlSeconds = parseInt(
      process.env.QUERY_CACHE_TTL_SECONDS || "300",
      10,
    );
    this.cleanupIntervalMs = parseInt(
      process.env.QUERY_CACHE_CLEANUP_INTERVAL_MS || "60000",
      10,
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.default(
      `Initializing Redis query cache - TTL: ${this.ttlSeconds}s, Cleanup interval: ${this.cleanupIntervalMs}ms`,
    );
    this.startAutoCleanup();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    await this.redis.quit();
  }

  /**
   * EN -
   * Generates a cache key for a query endpoint and parameters.
   *
   * PT -
   * Gera uma chave de cache para um endpoint de consulta e parâmetros.
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters object
   * @returns Cache key string
   */
  private generateKey(endpoint: string, params: Record<string, any>): string {
    const paramsStr = JSON.stringify(params);
    const paramsHash = this.hashString(paramsStr);
    return `query:${endpoint}:${paramsHash}`;
  }

  /**
   * EN -
   * Simple hash function for string hashing.
   *
   * PT -
   * Função de hash simples para hashing de strings.
   *
   * @param str - String to hash
   * @returns Hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * EN -
   * Gets a cached query result from Redis.
   *
   * PT -
   * Obtém um resultado de consulta em cache do Redis.
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters object
   * @returns Cached result or null if not found
   */
  async get<T>(
    endpoint: string,
    params: Record<string, any>,
  ): Promise<T | null> {
    const key = this.generateKey(endpoint, params);
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        this.logger.default(`Cache hit for query: ${endpoint}`);
        return JSON.parse(cached) as T;
      }
      this.logger.default(`Cache miss for query: ${endpoint}`);
      return null;
    } catch (error) {
      this.logger.error(`Redis get failed for ${key}: ${String(error)}`);
      return null;
    }
  }

  /**
   * EN -
   * Sets a query result in Redis cache with TTL.
   *
   * PT -
   * Define um resultado de consulta no cache Redis com TTL.
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters object
   * @param value - Result value to cache
   * @param ttlSeconds - Optional TTL override
   */
  async set<T>(
    endpoint: string,
    params: Record<string, any>,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = this.generateKey(endpoint, params);
    const ttl = ttlSeconds || this.ttlSeconds;
    try {
      await this.redis.set(key, JSON.stringify(value), "EX", ttl);
      this.logger.default(`Cached query result: ${endpoint}, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Redis set failed for ${key}: ${String(error)}`);
    }
  }

  /**
   * EN -
   * Invalidates cache entries matching a pattern.
   *
   * PT -
   * Invalida entradas de cache que correspondem a um padrão.
   *
   * @param pattern - Redis key pattern (e.g., "query:invites:*")
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.default(`Invalidated ${keys.length} cache entries: ${pattern}`);
      }
    } catch (error) {
      this.logger.error(`Cache invalidation failed for ${pattern}: ${String(error)}`);
    }
  }

  /**
   * EN -
   * Waits for a cache entry to be set by a worker, with timeout and polling.
   * Used to synchronize query processing between HTTP controller and worker.
   *
   * PT -
   * Aguarda uma entrada de cache ser definida por um worker, com timeout e polling.
   * Usado para sincronizar processamento de consultas entre controller HTTP e worker.
   *
   * @param endpoint - API endpoint path
   * @param params - Query parameters object
   * @param timeoutMs - Maximum time to wait in milliseconds (default: 2000ms)
   * @param pollIntervalMs - Polling interval in milliseconds (default: 100ms)
   * @returns Cached result or null if timeout
   */
  async waitForCache<T>(
    endpoint: string,
    params: Record<string, any>,
    timeoutMs: number = 2000,
    pollIntervalMs: number = 100,
  ): Promise<T | null> {
    const key = this.generateKey(endpoint, params);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          this.logger.default(`Cache populated by worker for query: ${endpoint}`);
          return JSON.parse(cached) as T;
        }
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        this.logger.error(`Error waiting for cache ${key}: ${String(error)}`);
        return null;
      }
    }

    this.logger.default(`Cache wait timeout for query: ${endpoint} after ${timeoutMs}ms`);
    return null;
  }

  /**
   * EN -
   * Starts automatic cleanup of expired cache entries.
   * Runs periodically to remove expired keys.
   *
   * PT -
   * Inicia limpeza automática de entradas de cache expiradas.
   * Executa periodicamente para remover chaves expiradas.
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      try {
        const keys = await this.redis.keys("query:*");
        if (keys.length === 0) return;

        let cleaned = 0;
        for (const key of keys) {
          const ttl = await this.redis.ttl(key);
          if (ttl === -1) {
            await this.redis.del(key);
            cleaned++;
          }
        }

        if (cleaned > 0) {
          this.logger.default(`Auto-cleanup: removed ${cleaned} expired cache entries`);
        }
      } catch (error) {
        this.logger.error(`Auto-cleanup failed: ${String(error)}`);
      }
    }, this.cleanupIntervalMs);
  }

  /**
   * EN -
   * Gets multiple cached query results in batch.
   *
   * PT -
   * Obtém múltiplos resultados de consulta em cache em lote.
   *
   * @param requests - Array of cache requests
   * @returns Array of cached results (null for cache misses)
   */
  async getBatch<T>(
    requests: Array<{ endpoint: string; params: Record<string, any> }>,
  ): Promise<Array<T | null>> {
    const keys = requests.map((req) =>
      this.generateKey(req.endpoint, req.params),
    );
    try {
      const values = await this.redis.mget(...keys);
      return values.map((val, idx) => {
        if (val) {
          this.logger.default(`Cache hit for query: ${requests[idx].endpoint}`);
          return JSON.parse(val) as T;
        }
        this.logger.default(`Cache miss for query: ${requests[idx].endpoint}`);
        return null;
      });
    } catch (error) {
      this.logger.error(`Redis batch get failed: ${String(error)}`);
      return requests.map(() => null);
    }
  }

  /**
   * EN -
   * Sets multiple query results in cache in batch.
   *
   * PT -
   * Define múltiplos resultados de consulta no cache em lote.
   *
   * @param entries - Array of cache entries
   * @param ttlSeconds - Optional TTL override
   */
  async setBatch(
    entries: Array<{
      endpoint: string;
      params: Record<string, any>;
      value: any;
    }>,
    ttlSeconds?: number,
  ): Promise<void> {
    const ttl = ttlSeconds || this.ttlSeconds;
    const pipeline = this.redis.pipeline();

    for (const entry of entries) {
      const key = this.generateKey(entry.endpoint, entry.params);
      pipeline.set(key, JSON.stringify(entry.value), "EX", ttl);
    }

    try {
      await pipeline.exec();
      this.logger.default(`Cached ${entries.length} query results in batch, TTL: ${ttl}s`);
    } catch (error) {
      this.logger.error(`Redis batch set failed: ${String(error)}`);
    }
  }
}


import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import Redis from 'ioredis';
import {LoggerService} from '@infrastructure/logging/logger.service';

/**
 * DeliveryConfirmationService - Manages delivery confirmation for real-time notifications
 *
 * Architecture for millions of users:
 * - Redis-based pending message tracking
 * - Timeout-based delivery failure detection
 * - Automatic cleanup of expired confirmations
 * - Support for multiple concurrent workers
 *
 * Flow:
 * 1. Worker emits WebSocket notification and stores message in Redis with TTL
 * 2. Frontend receives notification and sends confirmation via WebSocket
 * 3. Worker receives confirmation and saves notification to database
 * 4. If timeout expires without confirmation, message is returned to queue/DLQ
 *
 * Redis Keys:
 * - `delivery:pending:{messageId}`: Pending delivery with message payload and metadata
 * - TTL: 60 seconds (configurable via DELIVERY_CONFIRMATION_TTL)
 *
 * For high-scale:
 * - Use Redis Cluster for high availability
 * - Monitor pending delivery counts and timeout rates
 * - Adjust TTL based on network latency and processing time
 * - Consider sharding by user ID for better distribution
 *
 * Serviço de confirmação de entrega para notificações em tempo real
 *
 * Arquitetura para milhões de usuários:
 * - Rastreamento de mensagens pendentes baseado em Redis
 * - Detecção de falha de entrega baseada em timeout
 * - Limpeza automática de confirmações expiradas
 * - Suporte para múltiplos workers concorrentes
 *
 * Fluxo:
 * 1. Worker emite notificação WebSocket e armazena mensagem no Redis com TTL
 * 2. Frontend recebe notificação e envia confirmação via WebSocket
 * 3. Worker recebe confirmação e salva notificação no banco de dados
 * 4. Se timeout expirar sem confirmação, mensagem volta para fila/DLQ
 *
 * Chaves Redis:
 * - `delivery:pending:{messageId}`: Entrega pendente com payload e metadados da mensagem
 * - TTL: 60 segundos (configurável via DELIVERY_CONFIRMATION_TTL)
 *
 * Para alta escala:
 * - Use Redis Cluster para alta disponibilidade
 * - Monitore contagens de entregas pendentes e taxas de timeout
 * - Ajuste TTL baseado em latência de rede e tempo de processamento
 * - Considere fragmentação por ID de usuário para melhor distribuição
 */
@Injectable()
export class DeliveryConfirmationService {
    private readonly redis: Redis;
    private readonly logger: LoggerService;
    private readonly ttlSeconds: number;

    constructor(private readonly config: ConfigService) {
        this.logger = new LoggerService(DeliveryConfirmationService.name, config);
        const url = (this.config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://localhost:6379';
        this.redis = new Redis(url, {
            maxRetriesPerRequest: 3,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });
        this.ttlSeconds = parseInt(process.env.DELIVERY_CONFIRMATION_TTL || '60', 10);

        this.redis.on('error', (err) => {
            this.logger.error(`Redis error in DeliveryConfirmationService: ${err.message}`);
        });

        this.redis.on('connect', () => {
            this.logger.default('Redis connected for delivery confirmation');
        });
    }

    /**
     * Store a pending delivery in Redis with TTL
     *
     * EN: Stores message metadata for later confirmation. If confirmation is not received within TTL,
     * the delivery is considered failed and should be retried or sent to DLQ.
     *
     * PT: Armazena uma entrega pendente no Redis com TTL. Se a confirmação não for recebida dentro do TTL,
     * a entrega é considerada falhada e deve ser reprocessada ou enviada para DLQ.
     *
     * @param messageId - Unique identifier for the message (typically from RabbitMQ message ID)
     * @param messageId - Identificador único da mensagem (tipicamente do ID da mensagem RabbitMQ)
     * @param payload - Message payload including notification data
     * @param payload - Payload da mensagem incluindo dados da notificação
     * @param metadata - Additional metadata (userId, companyId, timestamp, etc.)
     * @param metadata - Metadados adicionais (userId, companyId, timestamp, etc.)
     * @returns Promise<void>
     */
    async storePendingDelivery(
        messageId: string,
        payload: any,
        metadata: { userId?: string; companyId?: string; timestamp: number; queue?: string }
    ): Promise<void> {
        const key = `delivery:pending:${messageId}`;
        const data = {
            payload,
            metadata,
            createdAt: Date.now(),
        };
        await this.redis.setex(key, this.ttlSeconds, JSON.stringify(data));
        this.logger.default(`Pending delivery stored: messageId=${messageId}, userId=${metadata.userId}, ttl=${this.ttlSeconds}s`);
    }

    /**
     * Confirm delivery and remove pending message from Redis
     *
     * EN: Called when frontend confirms receipt. Removes the pending delivery from Redis,
     * indicating successful delivery. Worker should then save notification to database.
     *
     * PT: Chamado quando o frontend confirma recebimento. Remove a entrega pendente do Redis,
     * indicando entrega bem-sucedida. Worker deve então salvar notificação no banco de dados.
     *
     * @param messageId - Unique identifier for the message
     * @param messageId - Identificador único da mensagem
     * @returns Promise<any | null> - Stored payload and metadata, or null if not found/expired
     * @returns Promise<any | null> - Payload e metadados armazenados, ou null se não encontrado/expirado
     */
    async confirmDelivery(messageId: string): Promise<{ payload: any; metadata: any } | null> {
        const key = `delivery:pending:${messageId}`;
        const data = await this.redis.get(key);
        if (!data) {
            this.logger.default(`Delivery confirmation not found (expired or already confirmed): messageId=${messageId}`);
            return null;
        }
        await this.redis.del(key);
        const parsed = JSON.parse(data);
        this.logger.default(`Delivery confirmed: messageId=${messageId}, userId=${parsed.metadata?.userId}`);
        return parsed;
    }

    /**
     * Check if a delivery is still pending
     *
     * EN: Checks if a message is still waiting for confirmation. Useful for timeout checks.
     *
     * PT: Verifica se uma mensagem ainda está aguardando confirmação. Útil para verificações de timeout.
     *
     * @param messageId - Unique identifier for the message
     * @param messageId - Identificador único da mensagem
     * @returns Promise<boolean>
     */
    async isPending(messageId: string): Promise<boolean> {
        const key = `delivery:pending:${messageId}`;
        const exists = await this.redis.exists(key);
        return exists === 1;
    }

    /**
     * Get pending delivery data without removing it
     *
     * EN: Retrieves pending delivery data for inspection or timeout handling.
     *
     * PT: Recupera dados de entrega pendente para inspeção ou tratamento de timeout.
     *
     * @param messageId - Unique identifier for the message
     * @param messageId - Identificador único da mensagem
     * @returns Promise<any | null>
     */
    async getPendingDelivery(messageId: string): Promise<{ payload: any; metadata: any; createdAt: number } | null> {
        const key = `delivery:pending:${messageId}`;
        const data = await this.redis.get(key);
        if (!data) {
            return null;
        }
        return JSON.parse(data);
    }

    /**
     * Remove pending delivery (for cleanup or timeout handling)
     *
     * EN: Removes pending delivery from Redis. Used when delivery times out or fails.
     *
     * PT: Remove entrega pendente do Redis. Usado quando a entrega expira ou falha.
     *
     * @param messageId - Unique identifier for the message
     * @param messageId - Identificador único da mensagem
     * @returns Promise<void>
     */
    async removePendingDelivery(messageId: string): Promise<void> {
        const key = `delivery:pending:${messageId}`;
        await this.redis.del(key);
        this.logger.default(`Pending delivery removed: messageId=${messageId}`);
    }

    /**
     * Get count of pending deliveries (for monitoring)
     *
     * EN: Returns approximate count of pending deliveries. Useful for worker status monitoring.
     *
     * PT: Retorna contagem aproximada de entregas pendentes. Útil para monitoramento de status dos workers.
     *
     * @returns Promise<number>
     */
    async getPendingCount(): Promise<number> {
        const keys = await this.redis.keys('delivery:pending:*');
        return keys.length;
    }

    /**
     * Cleanup expired deliveries (should be called periodically)
     *
     * EN: Redis TTL handles expiration automatically, but this method can be used
     * for explicit cleanup or monitoring.
     *
     * PT: TTL do Redis trata expiração automaticamente, mas este método pode ser usado
     * para limpeza explícita ou monitoramento.
     *
     * @returns Promise<number> - Number of expired deliveries cleaned up
     * @returns Promise<number> - Número de entregas expiradas removidas
     */
    async cleanupExpired(): Promise<number> {
        const keys = await this.redis.keys('delivery:pending:*');
        let cleaned = 0;
        for (const key of keys) {
            const ttl = await this.redis.ttl(key);
            if (ttl === -1 || ttl === -2) {
                await this.redis.del(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.logger.default(`Cleaned up ${cleaned} expired deliveries`);
        }
        return cleaned;
    }

    /**
     * Start automatic cleanup interval
     *
     * EN: Starts a periodic cleanup task that removes expired deliveries from Redis.
     * This ensures Redis doesn't accumulate stale keys.
     *
     * PT: Inicia uma tarefa de limpeza periódica que remove entregas expiradas do Redis.
     * Isto garante que o Redis não acumule chaves antigas.
     *
     * @param intervalMs - Cleanup interval in milliseconds (default: 60000 = 1 minute)
     * @param intervalMs - Intervalo de limpeza em milissegundos (padrão: 60000 = 1 minuto)
     * @returns () => void - Function to stop the cleanup interval
     * @returns () => void - Função para parar o intervalo de limpeza
     */
    startAutoCleanup(intervalMs: number = 60000): () => void {
        const interval = setInterval(async () => {
            try {
                await this.cleanupExpired();
            } catch (error: any) {
                this.logger.error(`Error in auto cleanup: ${error?.message || String(error)}`);
            }
        }, intervalMs);

        this.logger.default(`Auto cleanup started with interval: ${intervalMs}ms`);

        return () => {
            clearInterval(interval);
            this.logger.default('Auto cleanup stopped');
        };
    }
}


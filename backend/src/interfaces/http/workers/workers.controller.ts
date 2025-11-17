import {Controller, Get, Param, Query, HttpCode, UseGuards} from '@nestjs/common';
import {ApiOperation, ApiResponse, ApiTags, ApiCookieAuth} from '@nestjs/swagger';
import {DeliveryConfirmationService} from '@infrastructure/messaging/services/delivery-confirmation.service';
import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {ConfigService} from '@nestjs/config';
import {LoggerService} from '@infrastructure/logging/logger.service';
import {WorkersJwsGuard} from '@common/guards/workers-jws.guard';
import * as os from 'os';
import * as process from 'process';

/**
 * EN -
 * WorkersController - REST API for worker status monitoring
 * 
 * Provides endpoints to monitor worker health, overload status, and active worker counts.
 * Useful for auto-scaling, load balancing, and operational monitoring.
 * 
 * All endpoints are protected by JWT authentication and require a valid token.
 * 
 * Endpoints:
 * - GET /workers/status: Get status of all workers
 * - GET /workers/:workerType/status: Get status of a specific worker type
 * - GET /workers/:workerType/overloaded: Check if worker type is overloaded
 * - GET /workers/:workerType/count: Get count of active workers for a type
 * 
 * For high-scale deployments:
 * - Use these endpoints for auto-scaling decisions
 * - Monitor worker overload to prevent message queue buildup
 * - Track active worker counts for capacity planning
 * - WORKER_CAPACITY_SHARING_FACTOR variable (default: 256) is used for worker capacity calculations
 * 
 * Security:
 * - All endpoints are protected by JWS (JSON Web Signature) with ES256 algorithm
 * - ES256 uses ECDSA with P-256 curve and SHA-256 hash for strong cryptographic security
 * - Requires valid JWT token signed with ES256 in request cookie
 * 
 * PT -
 * WorkersController - API REST para monitoramento de status de workers
 * 
 * Fornece endpoints para monitorar saúde dos workers, status de sobrecarga e contagem de workers ativos.
 * Útil para auto-escalonamento, balanceamento de carga e monitoramento operacional.
 * 
 * Todos os endpoints são protegidos por autenticação JWT e requerem um token válido.
 * 
 * Endpoints:
 * - GET /workers/status: Obter status de todos os workers
 * - GET /workers/:workerType/status: Obter status de um tipo específico de worker
 * - GET /workers/:workerType/overloaded: Verificar se tipo de worker está sobrecarregado
 * - GET /workers/:workerType/count: Obter contagem de workers ativos para um tipo
 * 
 * Para deployments de alta escala:
 * - Use estes endpoints para decisões de auto-escalonamento
 * - Monitore sobrecarga de workers para prevenir acúmulo de filas
 * - Acompanhe contagem de workers ativos para planejamento de capacidade
 * - Variável WORKER_CAPACITY_SHARING_FACTOR (padrão: 256) é usada para cálculos de capacidade de workers
 * 
 * Segurança:
 * - Todos os endpoints são protegidos por JWS (JSON Web Signature) com algoritmo ES256
 * - ES256 usa ECDSA com curva P-256 e hash SHA-256 para segurança criptográfica forte
 * - Requer token JWT válido assinado com ES256 no cookie da requisição
 */
@ApiTags('workers')
@ApiCookieAuth()
@Controller('workers')
@UseGuards(WorkersJwsGuard)
export class WorkersController {
    private readonly logger: LoggerService;
    private readonly overloadThreshold: number;
    private readonly workerCapacitySharingFactor: number;
    private readonly workerTypes = [
        'realtime',
        'invites',
        'members',
        'generic',
    ] as const;

    constructor(
        private readonly deliveryConfirmation: DeliveryConfirmationService,
        private readonly rabbitmq: RabbitMQService,
        private readonly config: ConfigService,
    ) {
        this.logger = new LoggerService(WorkersController.name, config);
        this.overloadThreshold = parseInt(process.env.WORKER_OVERLOAD_THRESHOLD || '1000', 10);
        this.workerCapacitySharingFactor = config.get<number>('app.worker.capacitySharingFactor') || 256;
    }

    /**
     * EN -
     * Get status of all workers.
     * 
     * Returns comprehensive status for all worker types including pending deliveries,
     * overload status, and system metrics.
     * Protected by JWT authentication.
     * 
     * PT -
     * Obter status de todos os workers.
     * 
     * Retorna status abrangente para todos os tipos de workers incluindo entregas pendentes,
     * status de sobrecarga e métricas do sistema.
     * Protegido por autenticação JWT.
     * 
     * @returns Comprehensive worker status for all worker types
     */
    @Get('status')
    @HttpCode(200)
    @ApiOperation({summary: 'Get status of all workers'})
    @ApiResponse({status: 200, description: 'Worker status returned'})
    @ApiResponse({status: 401, description: 'Unauthorized - JWT token required'})
    async getAllStatus() {
        this.logger.default('GET /workers/status');

        const status: Record<string, any> = {};

        for (const workerType of this.workerTypes) {
            status[workerType] = await this.getWorkerTypeStatus(workerType);
        }

        const pendingCount = await this.deliveryConfirmation.getPendingCount();
        const systemMetrics = {
            cpuUsage: process.cpuUsage(),
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            hostname: os.hostname(),
            platform: os.platform(),
            loadAverage: os.loadavg(),
        };

        return {
            workers: status,
            pendingDeliveries: pendingCount,
            system: systemMetrics,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * EN -
     * Get status of a specific worker type.
     * 
     * Returns detailed status for a specific worker type.
     * Protected by JWT authentication.
     * 
     * PT -
     * Obter status de um tipo específico de worker.
     * 
     * Retorna status detalhado para um tipo específico de worker.
     * Protegido por autenticação JWT.
     * 
     * @param workerType - Type of worker (realtime, invites, members, generic)
     * @returns Detailed status for the specified worker type
     */
    @Get(':workerType/status')
    @HttpCode(200)
    @ApiOperation({summary: 'Get status of a specific worker type'})
    @ApiResponse({status: 200, description: 'Worker status returned'})
    @ApiResponse({status: 401, description: 'Unauthorized - JWT token required'})
    @ApiResponse({status: 404, description: 'Worker type not found'})
    async getWorkerStatus(@Param('workerType') workerType: string) {
        this.logger.default(`GET /workers/${workerType}/status`);

        if (!this.workerTypes.includes(workerType as any)) {
            return {
                error: 'Worker type not found',
                availableTypes: this.workerTypes,
            };
        }

        return await this.getWorkerTypeStatus(workerType);
    }

    /**
     * EN -
     * Check if a worker type is overloaded.
     * 
     * Returns true if worker type is overloaded (pending deliveries exceed threshold).
     * Protected by JWT authentication.
     * 
     * PT -
     * Verificar se um tipo de worker está sobrecarregado.
     * 
     * Retorna true se tipo de worker estiver sobrecarregado (entregas pendentes excedem limite).
     * Protegido por autenticação JWT.
     * 
     * @param workerType - Type of worker (realtime, invites, members, generic)
     * @returns Overload status with pending deliveries count and threshold
     */
    @Get(':workerType/overloaded')
    @HttpCode(200)
    @ApiOperation({summary: 'Check if worker type is overloaded'})
    @ApiResponse({status: 200, description: 'Overload status returned'})
    @ApiResponse({status: 401, description: 'Unauthorized - JWT token required'})
    async isOverloaded(@Param('workerType') workerType: string) {
        this.logger.default(`GET /workers/${workerType}/overloaded`);

        if (!this.workerTypes.includes(workerType as any)) {
            return {
                error: 'Worker type not found',
                availableTypes: this.workerTypes,
            };
        }

        const pendingCount = await this.deliveryConfirmation.getPendingCount();
        const overloaded = pendingCount > this.overloadThreshold;

        return {
            workerType,
            overloaded,
            pendingDeliveries: pendingCount,
            threshold: this.overloadThreshold,
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * EN -
     * Get count of active workers for a type.
     * 
     * Returns approximate count of active workers for a worker type.
     * Uses WORKER_CAPACITY_SHARING_FACTOR variable (default: 256) for capacity calculations.
     * Note: This is an approximation based on pending deliveries and system metrics.
     * For accurate counts, use process managers or container orchestration APIs.
     * 
     * PT -
     * Obter contagem de workers ativos para um tipo.
     * 
     * Retorna contagem aproximada de workers ativos para um tipo de worker.
     * Usa variável WORKER_CAPACITY_SHARING_FACTOR (padrão: 256) para cálculos de capacidade.
     * Nota: Esta é uma aproximação baseada em entregas pendentes e métricas do sistema.
     * Para contagens precisas, use gerenciadores de processos ou APIs de orquestração de containers.
     * 
     * @param workerType - Type of worker (realtime, invites, members, generic)
     * @param method - Calculation method: 'pending', 'load', or 'combined' (default: 'pending')
     * @returns Estimated worker count with calculation details
     */
    @Get(':workerType/count')
    @HttpCode(200)
    @ApiOperation({summary: 'Get count of active workers for a type'})
    @ApiResponse({status: 200, description: 'Worker count returned'})
    @ApiResponse({status: 401, description: 'Unauthorized - JWT token required'})
    async getWorkerCount(
        @Param('workerType') workerType: string,
        @Query('method') method: string = 'pending'
    ) {
        this.logger.default(`GET /workers/${workerType}/count?method=${method}`);

        if (!this.workerTypes.includes(workerType as any)) {
            return {
                error: 'Worker type not found',
                availableTypes: this.workerTypes,
            };
        }

        const pendingCount = await this.deliveryConfirmation.getPendingCount();
        const loadAverage = os.loadavg()[0];
        const cpuCount = os.cpus().length;

        let estimatedCount = 1;
        if (method === 'pending') {
            estimatedCount = Math.max(1, Math.ceil(pendingCount / this.workerCapacitySharingFactor));
        } else if (method === 'load') {
            estimatedCount = Math.max(1, Math.ceil(loadAverage / cpuCount));
        } else {
            estimatedCount = Math.max(1, Math.ceil((pendingCount / this.workerCapacitySharingFactor + loadAverage / cpuCount) / 2));
        }

        return {
            workerType,
            estimatedCount,
            method,
            workerCapacitySharingFactor: this.workerCapacitySharingFactor,
            pendingDeliveries: pendingCount,
            loadAverage,
            cpuCount,
            note: 'This is an estimated count. For accurate counts, use process managers or container orchestration APIs.',
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Private helper to get status for a worker type
     *
     * EN: Internal method to compute worker type status.
     *
     * PT: Método interno para calcular status do tipo de worker.
     */
    private async getWorkerTypeStatus(workerType: string): Promise<any> {
        try {
            const channel = await this.rabbitmq.getChannel();
            const pendingCount = await this.deliveryConfirmation.getPendingCount();
            const overloaded = pendingCount > this.overloadThreshold;

            let queueName = '';
            if (workerType === 'realtime') {
                queueName = 'notifications.realtimes';
            } else if (workerType === 'invites') {
                queueName = 'events.invites';
            } else if (workerType === 'members') {
                queueName = 'events.members';
            } else if (workerType === 'generic') {
                queueName = 'events';
            }

            let queueInfo: any = null;
            if (queueName && channel) {
                try {
                    const queue = await channel.checkQueue(queueName);
                    queueInfo = {
                        name: queueName,
                        messageCount: queue.messageCount,
                        consumerCount: queue.consumerCount,
                    };
                } catch (error: any) {
                    queueInfo = {
                        name: queueName,
                        error: error?.message || String(error),
                    };
                }
            }

            return {
                type: workerType,
                overloaded,
                pendingDeliveries: pendingCount,
                threshold: this.overloadThreshold,
                queue: queueInfo,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            this.logger.error(`Error getting worker status for ${workerType}: ${error?.message || String(error)}`);
            return {
                type: workerType,
                error: error?.message || String(error),
                timestamp: new Date().toISOString(),
            };
        }
    }
}


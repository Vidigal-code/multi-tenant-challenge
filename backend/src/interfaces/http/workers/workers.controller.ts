import {Controller, Get, Param, Query, HttpCode} from '@nestjs/common';
import {ApiOperation, ApiResponse, ApiTags} from '@nestjs/swagger';
import {DeliveryConfirmationService} from '@infrastructure/messaging/services/delivery-confirmation.service';
import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {ConfigService} from '@nestjs/config';
import {LoggerService} from '@infrastructure/logging/logger.service';
import * as os from 'os';
import * as process from 'process';

/**
 * WorkersController - REST API for worker status monitoring
 *
 * EN: Provides endpoints to monitor worker health, overload status, and active worker counts.
 * Useful for auto-scaling, load balancing, and operational monitoring.
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
 *
 * PT: Fornece endpoints para monitorar saúde dos workers, status de sobrecarga e contagem de workers ativos.
 * Útil para auto-escalonamento, balanceamento de carga e monitoramento operacional.
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
 */
@ApiTags('workers')
@Controller('workers')
export class WorkersController {
    private readonly logger: LoggerService;
    private readonly overloadThreshold: number;
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
    }

    /**
     * Get status of all workers
     *
     * EN: Returns comprehensive status for all worker types including pending deliveries,
     * overload status, and system metrics.
     *
     * PT: Retorna status abrangente para todos os tipos de workers incluindo entregas pendentes,
     * status de sobrecarga e métricas do sistema.
     */
    @Get('status')
    @HttpCode(200)
    @ApiOperation({summary: 'Get status of all workers'})
    @ApiResponse({status: 200, description: 'Worker status returned'})
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
     * Get status of a specific worker type
     *
     * EN: Returns detailed status for a specific worker type.
     *
     * PT: Retorna status detalhado para um tipo específico de worker.
     */
    @Get(':workerType/status')
    @HttpCode(200)
    @ApiOperation({summary: 'Get status of a specific worker type'})
    @ApiResponse({status: 200, description: 'Worker status returned'})
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
     * Check if a worker type is overloaded
     *
     * EN: Returns true if worker type is overloaded (pending deliveries exceed threshold).
     *
     * PT: Retorna true se tipo de worker estiver sobrecarregado (entregas pendentes excedem limite).
     */
    @Get(':workerType/overloaded')
    @HttpCode(200)
    @ApiOperation({summary: 'Check if worker type is overloaded'})
    @ApiResponse({status: 200, description: 'Overload status returned'})
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
     * Get count of active workers for a type
     *
     * EN: Returns approximate count of active workers for a worker type.
     * Note: This is an approximation based on pending deliveries and system metrics.
     * For accurate counts, use process managers or container orchestration APIs.
     *
     * PT: Retorna contagem aproximada de workers ativos para um tipo de worker.
     * Nota: Esta é uma aproximação baseada em entregas pendentes e métricas do sistema.
     * Para contagens precisas, use gerenciadores de processos ou APIs de orquestração de containers.
     */
    @Get(':workerType/count')
    @HttpCode(200)
    @ApiOperation({summary: 'Get count of active workers for a type'})
    @ApiResponse({status: 200, description: 'Worker count returned'})
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
            estimatedCount = Math.max(1, Math.ceil(pendingCount / 100));
        } else if (method === 'load') {
            estimatedCount = Math.max(1, Math.ceil(loadAverage / cpuCount));
        } else {
            estimatedCount = Math.max(1, Math.ceil((pendingCount / 100 + loadAverage / cpuCount) / 2));
        }

        return {
            workerType,
            estimatedCount,
            method,
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


import {Injectable, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {PrismaClient} from "@prisma/client";
import {LoggerService} from "@infrastructure/logging/logger.service";

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {
    private readonly logger: LoggerService;

    constructor(private readonly configService?: ConfigService) {
        const prismaLogEnv = process.env.PRISMALOG?.trim() || '';
        let prismaLogLevels: Array<'query' | 'info' | 'warn' | 'error'> = [];
        
        if (prismaLogEnv && prismaLogEnv.toLowerCase() !== 'false' && prismaLogEnv.toLowerCase() !== 'none') {
            const validLevels: Array<'query' | 'info' | 'warn' | 'error'> = ['query', 'info', 'warn', 'error'];
            const levels = prismaLogEnv.split(',').map(level => level.trim().toLowerCase()).filter(level => validLevels.includes(level as any));
            prismaLogLevels = levels as Array<'query' | 'info' | 'warn' | 'error'>;
        }

        super({
            log: prismaLogLevels.length > 0 ? prismaLogLevels : undefined,
        });
        this.logger = new LoggerService(PrismaService.name, configService);
    }

    async onModuleInit(): Promise<void> {
        try {
            this.logger.default('Connecting to database...');
            await this.$connect();
            this.logger.default('Database connected successfully');
        } catch (error: any) {
            this.logger.error(`Failed to connect to database: ${error?.message || String(error)}`);
            throw error;
        }
    }

    async onModuleDestroy(): Promise<void> {
        this.logger.default('Disconnecting from database...');
        await this.$disconnect();
        this.logger.default('Database disconnected');
    }
}

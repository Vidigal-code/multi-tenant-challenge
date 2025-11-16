import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LoggerService {
    private readonly logger: Logger;
    private readonly rabbitmqLogging: boolean;
    private readonly websocketLogging: boolean;
    private readonly defaultLogging: boolean;

    private readonly BLUE = '\x1b[34m';
    private readonly GREEN = '\x1b[32m';
    private readonly RESET = '\x1b[0m';

    constructor(
        private readonly context?: string,
        private readonly configService?: ConfigService,
    ) {
        this.logger = new Logger(context || 'LoggerService');
        
        if (configService) {
            this.rabbitmqLogging = configService.get<boolean>('app.logging.rabbitmq', false) || 
                                 process.env.RABBITMQ_LOGGING === 'true';
            this.websocketLogging = configService.get<boolean>('app.logging.websocket', false) || 
                                  process.env.WEBSOCKET_LOGGING === 'true';
            this.defaultLogging = configService.get<boolean>('app.logging.enabled', true) &&
                                process.env.BACKEND_LOGGING !== 'false';
        } else {
            this.rabbitmqLogging = process.env.RABBITMQ_LOGGING === 'true';
            this.websocketLogging = process.env.WEBSOCKET_LOGGING === 'true';
            this.defaultLogging = process.env.BACKEND_LOGGING !== 'false';
        }
    }

    rabbitmq(message: string, ...args: any[]): void {
        if (this.rabbitmqLogging) {
            console.log(`${this.BLUE}[RABBITMQ] ${message}${this.RESET}`, ...args);
        }
    }

    websocket(message: string, ...args: any[]): void {
        if (this.websocketLogging) {
            console.log(`${this.GREEN}[WEBSOCKET] ${message}${this.RESET}`, ...args);
        }
    }

    default(message: string, ...args: any[]): void {
        if (this.defaultLogging) {
            this.logger.log(message, ...args);
        }
    }

    error(message: any, trace?: string, context?: string): void {
        if (this.defaultLogging) {
            this.logger.error(message, trace, context);
        }
    }

    warn(message: any, context?: string): void {
        if (this.defaultLogging) {
            this.logger.warn(message, context);
        }
    }

    debug(message: any, context?: string): void {
        if (this.defaultLogging) {
            this.logger.debug(message, context);
        }
    }

    verbose(message: any, context?: string): void {
        if (this.defaultLogging) {
            this.logger.verbose(message, context);
        }
    }

    log(message: any, ...args: any[]): void {
        if (this.defaultLogging) {
            this.logger.log(message, ...args);
        }
    }
}


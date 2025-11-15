import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    WebSocketGateway,
    WebSocketServer
} from '@nestjs/websockets';
import {Inject, Injectable, Logger} from '@nestjs/common';
import {Server} from 'socket.io';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from '@domain/repositories/memberships/membership.repository';
import {createAdapter} from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import {Counter, Gauge, Registry, Summary} from 'prom-client';

export const RT_EVENT = {
    COMPANY_UPDATED: 'companys.updated',
    MEMBER_JOINED: 'member.joined',
    MEMBER_LEFT: 'member.left',
    NOTIFICATION_CREATED: 'notifications.created',
    INVITE_REJECTED: 'invites.rejected',
    NOTIFICATION_READ: 'notifications.read',
    FRIEND_REQUEST_SENT: 'friend.request.sent',
    FRIEND_REQUEST_ACCEPTED: 'friend.request.accepted',
    FRIEND_REMOVED: 'friend.removed',
};

@Injectable()
@WebSocketGateway({
    cors: {
        origin: process.env.WS_CORS_ORIGIN?.split(',') || '*',
        credentials: true,
    },
    namespace: process.env.WS_NAMESPACE || '/rt',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server!: Server;
    private readonly logger = new Logger(EventsGateway.name);
    private activeConnections = 0;
    private readonly metricConnections: Gauge<string>;
    private readonly metricEmits: Counter<string>;
    private readonly metricRateLimited: Counter<string>;
    private redisClient?: Redis;
    private rateWindowMs: number;
    private rateMax: number;
    private perEventMax: Record<string, number> = {};
    private readonly metricRateUsage: Summary<string>;
    private inboundRateMax: number;
    private inboundWindowMs: number;

    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository,
    ) {
        const registry = new Registry();
        this.metricConnections = new Gauge({
            name: 'ws_connections_active',
            help: 'Active websocket connections',
            registers: [registry],
        });
        this.metricEmits = new Counter({
            name: 'ws_events_emitted_total',
            help: 'Total websocket events emitted',
            labelNames: ['event'],
            registers: [registry],
        });
        this.metricRateLimited = new Counter({
            name: 'ws_events_rate_limited_total',
            help: 'Total websocket events blocked by rate limiting',
            labelNames: ['event'],
            registers: [registry],
        });
        this.rateWindowMs = parseInt(process.env.WS_RATE_LIMIT_WINDOW_MS || '1000', 10);
        this.rateMax = parseInt(process.env.WS_RATE_LIMIT_MAX || '50', 10);
        this.inboundWindowMs = parseInt(process.env.WS_INBOUND_RATE_LIMIT_WINDOW_MS || '1000', 10);
        this.inboundRateMax = parseInt(process.env.WS_INBOUND_RATE_LIMIT_MAX || '30', 10);
        Object.values(RT_EVENT).forEach(ev => {
            const envKey = `WS_RATE_LIMIT_MAX_${ev.toUpperCase().replace(/\./g, '_')}`;
            const v = process.env[envKey];
            if (v) {
                const num = parseInt(v, 10);
                if (!Number.isNaN(num) && num > 0) this.perEventMax[ev] = num;
            }
        });
        this.metricRateUsage = new Summary({
            name: 'ws_events_rate_usage_ratio',
            help: 'Ratio (current/window max) sampled each emit for distribution (p95).',
            percentiles: [0.5, 0.9, 0.95, 0.99],
            labelNames: ['event'],
            registers: [registry],
        });
        const url = process.env.REDIS_URL;
        if (url) {
            try {
                this.redisClient = new Redis(url, {lazyConnect: true});
                this.redisClient.on('error', (e) => this.logger.error(`Redis rate-limit error: ${e.message}`));
                this.redisClient.connect().catch(err => this.logger.warn(`Redis rate-limit connect failed: ${err.message}`));
            } catch (e: any) {
                this.logger.warn(`Rate limit Redis init skipped: ${e.message}`);
            }
        }
    }

    afterInit(server: Server) {
        if ((process.env.USE_WS_REDIS_ADAPTER || 'false').toLowerCase() === 'true') {
            try {
                const url = process.env.REDIS_URL || 'redis://localhost:6379';
                const pub = new Redis(url);
                const sub = pub.duplicate();
                server.adapter(createAdapter(pub as any, sub as any));
                this.logger.log('Redis adapter enabled for WebSocket scaling');
            } catch (err: any) {
                this.logger.error(`Failed to init Redis adapter: ${err.message}`);
            }
        }
        server.on('connection', (socket: any) => {
            socket.onAny(async (event: string, ...args: any[]) => {
                if (!(await this.allowInbound(socket, event))) {
                    this.logger.warn(`Inbound rate limited event=${event} user=${socket.data?.userId}`);
                    return;
                }
            });
        });
    }

    async handleConnection(socket: any) {
        try {
            const cookieHeader: string | undefined = socket.handshake?.headers?.cookie;
            if (!cookieHeader) {
                this.logger.warn(`No cookies on handshake for ${socket.id}`);
                socket.disconnect(true);
                return;
            }
            const sessionCookieName = this.config.get<string>('app.jwt.cookieName') || 'mt_session';
            const rawToken = this.extractCookie(cookieHeader, sessionCookieName);
            if (!rawToken) {
                this.logger.warn(`Missing session cookie ${sessionCookieName} for ${socket.id}`);
                socket.disconnect(true);
                return;
            }
            const payload: any = await this.jwt.verifyAsync(rawToken).catch(() => null);
            if (!payload?.sub) {
                this.logger.warn(`Invalid JWT on websocket for ${socket.id}`);
                socket.disconnect(true);
                return;
            }
            socket.data.userId = payload.sub;
            this.joinUserRoom(socket, payload.sub);
            const userMemberships = await this.memberships.listByUser(payload.sub);
            userMemberships.forEach(m => this.joinCompanyRoom(socket, m.companyId));
            this.logger.debug(`WS auth ok user=${payload.sub} rooms=${userMemberships.length}`);
            this.activeConnections++;
            this.metricConnections.set(this.activeConnections);
        } catch (err: any) {
            this.logger.error(`WS connection error: ${err?.message}`);
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: any) {
        this.logger.debug(`Client disconnected ${socket.id}`);
        if (this.activeConnections > 0) {
            this.activeConnections--;
            this.metricConnections.set(this.activeConnections);
        }
    }

    async emitToCompany(companyId: string, event: string, payload: any) {
        if (!(await this.allowEmit(companyId, event))) return;
        this.server.to(`company:${companyId}`).emit(event, payload);
        this.metricEmits.inc({event});
    }

    async emitToUser(userId: string, event: string, payload: any) {
        if (!(await this.allowEmit(userId, event))) return;
        this.server.to(`user:${userId}`).emit(event, payload);
        this.metricEmits.inc({event});
    }

    async broadcast(event: string, payload: any) {
        if (!(await this.allowEmit('broadcast', event))) return;
        this.server.emit(event, payload);
        this.metricEmits.inc({event});
    }

    joinUserRoom(socket: any, userId: string) {
        socket.join(`user:${userId}`);
    }

    joinCompanyRoom(socket: any, companyId: string) {
        socket.join(`company:${companyId}`);
    }

    private extractCookie(cookieHeader: string, name: string): string | undefined {
        const parts = cookieHeader.split(/;\s*/);
        for (const part of parts) {
            const [k, ...rest] = part.split('=');
            if (k === name) {
                return rest.join('=');
            }
        }
        return undefined;
    }

    private async allowEmit(key: string, event: string): Promise<boolean> {
        if (!this.redisClient) return true;
        const bucketKey = `ws:rate:${key}:${event}`;
        const ttlSeconds = Math.ceil(this.rateWindowMs / 1000);
        let current: number;
        try {
            current = await this.redisClient.incr(bucketKey);
            if (current === 1) {
                await this.redisClient.expire(bucketKey, ttlSeconds);
            }
        } catch (e: any) {
            this.logger.warn(`Rate limit Redis failure => allow: ${e.message}`);
            return true;
        }
        const eventMax = this.perEventMax[event] ?? this.rateMax;
        this.metricRateUsage.observe({event}, current / eventMax);
        if (current > eventMax) {
            this.metricRateLimited.inc({event});
            return false;
        }
        return true;
    }

    private async allowInbound(socket: any, event: string): Promise<boolean> {
        if (!this.redisClient) return true;
        const userId = socket.data?.userId || 'anon';
        const key = `ws:inbound:${userId}:${event}`;
        const ttlSeconds = Math.ceil(this.inboundWindowMs / 1000);
        let current: number;
        try {
            current = await this.redisClient.incr(key);
            if (current === 1) await this.redisClient.expire(key, ttlSeconds);
        } catch (e: any) {
            this.logger.warn(`Inbound rate limit Redis fail => allow: ${e.message}`);
            return true;
        }
        if (current > this.inboundRateMax) {
            this.metricRateLimited.inc({event});
            return false;
        }
        return true;
    }
}

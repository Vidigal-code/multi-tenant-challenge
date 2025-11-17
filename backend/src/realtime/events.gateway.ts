import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Inject, Injectable } from "@nestjs/common";
import { Server } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import {
  MEMBERSHIP_REPOSITORY,
  MembershipRepository,
} from "@domain/repositories/memberships/membership.repository";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import { Counter, Gauge, Registry, Summary } from "prom-client";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { DeliveryConfirmationService } from "@infrastructure/messaging/services/delivery-confirmation.service";

export const RT_EVENT = {
  COMPANY_UPDATED: "companys.updated",
  MEMBER_JOINED: "member.joined",
  MEMBER_LEFT: "member.left",
  NOTIFICATION_CREATED: "notifications.created",
  INVITE_REJECTED: "invites.rejected",
  NOTIFICATION_READ: "notifications.read",
  FRIEND_REQUEST_SENT: "friend.request.sent",
  FRIEND_REQUEST_ACCEPTED: "friend.request.accepted",
  FRIEND_REMOVED: "friend.removed",
  NOTIFICATION_DELIVERED: "notifications.delivered",
  NOTIFICATION_DELIVERY_FAILED: "notifications.delivery.failed",
};

/**
 * EventsGateway - WebSocket gateway for real-time event broadcasting
 *
 * Architecture for millions of users:
 * - Redis adapter enables horizontal scaling across multiple server instances
 * - Rate limiting prevents abuse and ensures fair resource usage
 * - JWT-based authentication for secure connections
 * - Room-based message routing (user:{userId}, company:{companyId})
 *
 * Redis Integration:
 * - Redis Pub/Sub for multi-instance message broadcasting
 * - Redis-based rate limiting for connection and message throttling
 * - Configurable via USE_WS_REDIS_ADAPTER and REDIS_URL environment variables
 *
 * For high-scale deployments:
 * - Always enable Redis adapter in production (USE_WS_REDIS_ADAPTER=true)
 * - Use Redis Cluster for high availability
 * - Monitor WebSocket connection counts and message rates
 * - Adjust rate limits based on application load
 *
 * Gateway WebSocket para transmissão de eventos em tempo real
 *
 * Arquitetura para milhões de usuários:
 * - Adaptador Redis permite escalonamento horizontal entre múltiplas instâncias de servidor
 * - Limitação de taxa previne abuso e garante uso justo de recursos
 * - Autenticação baseada em JWT para conexões seguras
 * - Roteamento de mensagens baseado em salas (user:{userId}, company:{companyId})
 *
 * Integração Redis:
 * - Redis Pub/Sub para transmissão de mensagens multi-instância
 * - Limitação de taxa baseada em Redis para throttling de conexões e mensagens
 * - Configurável via variáveis de ambiente USE_WS_REDIS_ADAPTER e REDIS_URL
 *
 * Para deployments de alta escala:
 * - Sempre habilite o adaptador Redis em produção (USE_WS_REDIS_ADAPTER=true)
 * - Use Redis Cluster para alta disponibilidade
 * - Monitore contagens de conexões WebSocket e taxas de mensagens
 * - Ajuste limites de taxa baseado na carga da aplicação
 */
function parseWsCorsOrigins(): string[] | "*" | true {
  const wsCorsOriginAll = process.env.WS_CORS_ORIGIN_ALL === "true";
  if (wsCorsOriginAll) {
    return true;
  }

  const wsCorsOrigin = process.env.WS_CORS_ORIGIN;
  if (!wsCorsOrigin) {
    return "*";
  }

  const origins = wsCorsOrigin
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => {
      if (!origin.startsWith("http://") && !origin.startsWith("https://")) {
        return `http://${origin}`;
      }
      return origin;
    });

  return origins.length > 0 ? origins : "*";
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: parseWsCorsOrigins(),
    credentials: true,
  },
  namespace: process.env.WS_NAMESPACE || "/rt",
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;
  private readonly logger: LoggerService;
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
    @Inject(MEMBERSHIP_REPOSITORY)
    private readonly memberships: MembershipRepository,
    @Inject(DeliveryConfirmationService)
    private readonly deliveryConfirmation: DeliveryConfirmationService,
  ) {
    this.logger = new LoggerService(EventsGateway.name, config);
    const registry = new Registry();

    this.metricConnections = new Gauge({
      name: "ws_connections_active",
      help: "Active websocket connections",
      registers: [registry],
    });

    this.metricEmits = new Counter({
      name: "ws_events_emitted_total",
      help: "Total websocket events emitted",
      labelNames: ["event"],
      registers: [registry],
    });

    this.metricRateLimited = new Counter({
      name: "ws_events_rate_limited_total",
      help: "Total websocket events blocked by rate limiting",
      labelNames: ["event"],
      registers: [registry],
    });

    this.rateWindowMs = parseInt(
      process.env.WS_RATE_LIMIT_WINDOW_MS || "1000",
      10,
    );
    this.rateMax = parseInt(process.env.WS_RATE_LIMIT_MAX || "50", 10);
    this.inboundWindowMs = parseInt(
      process.env.WS_INBOUND_RATE_LIMIT_WINDOW_MS || "1000",
      10,
    );
    this.inboundRateMax = parseInt(
      process.env.WS_INBOUND_RATE_LIMIT_MAX || "30",
      10,
    );

    Object.values(RT_EVENT).forEach((ev) => {
      const envKey = `WS_RATE_LIMIT_MAX_${ev.toUpperCase().replace(/\./g, "_")}`;
      const v = process.env[envKey];
      if (v) {
        const num = parseInt(v, 10);
        if (!Number.isNaN(num) && num > 0) this.perEventMax[ev] = num;
      }
    });

    this.metricRateUsage = new Summary({
      name: "ws_events_rate_usage_ratio",
      help: "Ratio (current/window max) sampled each emit for distribution (p95).",
      percentiles: [0.5, 0.9, 0.95, 0.99],
      labelNames: ["event"],
      registers: [registry],
    });

    const url = process.env.REDIS_URL;

    if (url) {
      try {
        this.redisClient = new Redis(url, { lazyConnect: true });
        this.redisClient.on("error", (e) =>
          this.logger.error(`Redis rate-limit error: ${e.message}`),
        );
        this.redisClient
          .connect()
          .catch((err) =>
            this.logger.warn(`Redis rate-limit connect failed: ${err.message}`),
          );
      } catch (e: any) {
        this.logger.warn(`Rate limit Redis init skipped: ${e.message}`);
      }
    }
  }

  /**
   * EN -
   * Determines whether Redis adapter should be used based on environment configuration.
   * Redis adapter is required for production environments and can be enabled via USE_WS_REDIS_ADAPTER.
   *
   * PT -
   * Determina se o adaptador Redis deve ser usado com base na configuração do ambiente.
   * O adaptador Redis é obrigatório para ambientes de produção e pode ser habilitado via USE_WS_REDIS_ADAPTER.
   *
   * @returns True if Redis adapter should be used, false otherwise
   */
  private shouldUseRedisAdapter(): boolean {
    return (
      process.env.NODE_ENV === "production" ||
      (process.env.USE_WS_REDIS_ADAPTER || "false").toLowerCase() === "true"
    );
  }

  /**
   * EN -
   * Creates a retry strategy for Redis connections with exponential backoff.
   * Implements progressive delay: 50ms, 100ms, 150ms... up to maximum of 2000ms.
   *
   * PT -
   * Cria uma estratégia de retry para conexões Redis com backoff exponencial.
   * Implementa delay progressivo: 50ms, 100ms, 150ms... até máximo de 2000ms.
   *
   * @param times - Number of retry attempts made so far
   * @returns Delay in milliseconds before next retry attempt
   */
  private createRedisRetryStrategy(): (times: number) => number {
    return (times: number): number => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    };
  }

  /**
   * EN -
   * Sanitizes Redis URL by masking password in connection string for logging purposes.
   * Replaces password portion with asterisks to prevent credential exposure in logs.
   *
   * PT -
   * Sanitiza URL do Redis mascarando senha na string de conexão para fins de log.
   * Substitui a porção da senha com asteriscos para prevenir exposição de credenciais nos logs.
   *
   * @param url - Redis connection URL
   * @returns Sanitized URL with masked password
   */
  private sanitizeRedisUrl(url: string): string {
    return url.replace(/:[^:@]+@/, ":****@");
  }

  /**
   * EN -
   * Initializes Redis adapter for WebSocket server to enable horizontal scaling.
   * Creates Redis pub/sub clients and configures Socket.IO adapter for multi-instance communication.
   * Throws error in production if initialization fails, as Redis adapter is required.
   *
   * PT -
   * Inicializa adaptador Redis para servidor WebSocket para permitir escalonamento horizontal.
   * Cria clientes Redis pub/sub e configura adaptador Socket.IO para comunicação multi-instância.
   * Lança erro em produção se inicialização falhar, pois adaptador Redis é obrigatório.
   *
   * @param server - Socket.IO server instance
   */
  private initializeRedisAdapter(server: Server): void {
    try {
      const url = process.env.REDIS_URL || "redis://localhost:6379";
      const sanitizedUrl = this.sanitizeRedisUrl(url);

      this.logger.websocket(
        `Initializing Redis adapter for WebSocket: ${sanitizedUrl}`,
      );

      const pub = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: this.createRedisRetryStrategy(),
      });

      const sub = pub.duplicate();
      server.adapter(createAdapter(pub as any, sub as any));

      this.logger.websocket(
        "Redis adapter enabled for WebSocket horizontal scaling",
      );
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      this.logger.websocket(`Failed to init Redis adapter: ${errorMessage}`);
      this.logger.error(`Failed to init Redis adapter: ${errorMessage}`);

      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "Redis adapter is required for production WebSocket scaling",
        );
      }
    }
  }

  /**
   * EN -
   * Validates that a socket is authenticated by checking for userId in socket data.
   * Logs warning if socket is not authenticated.
   *
   * PT -
   * Valida que um socket está autenticado verificando userId nos dados do socket.
   * Registra aviso se socket não estiver autenticado.
   *
   * @param socket - Socket.IO socket instance
   * @param socketId - Socket identifier for logging
   * @returns True if socket is authenticated, false otherwise
   */
  private validateSocketAuthentication(socket: any, socketId: string): boolean {
    const userId = socket.data?.userId;
    if (!userId) {
      this.logger.websocket(`Unauthenticated socket: ${socketId}`);
      return false;
    }
    return true;
  }

  /**
   * EN -
   * Validates delivery payload contains required messageId field.
   * Logs warning if messageId is missing.
   *
   * PT -
   * Valida que payload de entrega contém campo messageId obrigatório.
   * Registra aviso se messageId estiver ausente.
   *
   * @param payload - Delivery payload object
   * @param userId - User identifier for logging
   * @returns True if payload is valid, false otherwise
   */
  private validateDeliveryPayload(
    payload: any,
    userId: string | undefined,
  ): boolean {
    if (!payload?.messageId) {
      this.logger.websocket(
        `Invalid delivery payload: missing messageId, user=${userId}`,
      );
      return false;
    }
    return true;
  }

  /**
   * EN -
   * Handles notification delivery confirmation event from client.
   * Validates payload and socket authentication, then confirms delivery with delivery confirmation service.
   * Logs success or failure status of delivery confirmation.
   *
   * PT -
   * Trata evento de confirmação de entrega de notificação do cliente.
   * Valida payload e autenticação do socket, então confirma entrega com serviço de confirmação de entrega.
   * Registra status de sucesso ou falha da confirmação de entrega.
   *
   * @param socket - Socket.IO socket instance
   * @param payload - Delivery confirmation payload containing messageId
   */
  private async handleNotificationDelivered(
    socket: any,
    payload: { messageId: string },
  ): Promise<void> {
    try {
      const userId = socket.data?.userId;

      if (!this.validateDeliveryPayload(payload, userId)) {
        return;
      }

      if (!this.validateSocketAuthentication(socket, socket.id)) {
        this.logger.websocket(
          `Delivery confirmation from unauthenticated socket: ${socket.id}`,
        );
        return;
      }

      const confirmed = await this.deliveryConfirmation.confirmDelivery(
        payload.messageId,
      );

      if (confirmed) {
        this.logger.websocket(
          `Delivery confirmed: messageId=${payload.messageId}, user=${userId}`,
        );
      } else {
        this.logger
          .websocket(`Delivery confirmation failed (expired or already confirmed): 
                messageId=${payload.messageId}, user=${userId}`);
      }
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      this.logger.error(
        `Error processing delivery confirmation: ${errorMessage}`,
      );
    }
  }

  /**
   * EN -
   * Handles notification delivery failure event from client.
   * Validates payload and socket authentication, then removes pending delivery from confirmation service.
   * Logs delivery failure with error details if available.
   *
   * PT -
   * Trata evento de falha na entrega de notificação do cliente.
   * Valida payload e autenticação do socket, então remove entrega pendente do serviço de confirmação.
   * Registra falha na entrega com detalhes do erro se disponível.
   *
   * @param socket - Socket.IO socket instance
   * @param payload - Delivery failure payload containing messageId and optional error message
   */
  private async handleNotificationDeliveryFailed(
    socket: any,
    payload: { messageId: string; error?: string },
  ): Promise<void> {
    try {
      const userId = socket.data?.userId;

      if (!this.validateDeliveryPayload(payload, userId)) {
        return;
      }

      if (!this.validateSocketAuthentication(socket, socket.id)) {
        this.logger.websocket(
          `Delivery failure from unauthenticated socket: ${socket.id}`,
        );
        return;
      }

      await this.deliveryConfirmation.removePendingDelivery(payload.messageId);

      const errorMessage = payload.error || "unknown";
      this.logger.websocket(
        `Delivery failed: messageId=${payload.messageId}, user=${userId}, error=${errorMessage}`,
      );
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      this.logger.error(`Error processing delivery failure: ${errorMessage}`);
    }
  }

  /**
   * EN -
   * Registers inbound event handlers for socket connections.
   * Sets up rate-limited event logging and delivery confirmation handlers.
   * Handles all incoming events with rate limiting and logs event details.
   *
   * PT -
   * Registra handlers de eventos inbound para conexões de socket.
   * Configura logging de eventos com limitação de taxa e handlers de confirmação de entrega.
   * Trata todos os eventos recebidos com limitação de taxa e registra detalhes dos eventos.
   *
   * @param socket - Socket.IO socket instance
   */
  private registerInboundEventHandlers(socket: any): void {
    socket.onAny(async (event: string, ...args: any[]) => {
      if (!(await this.allowInbound(socket, event))) {
        const userId = socket.data?.userId;
        this.logger.websocket(
          `Rate limit inbound: evento=${event}, usuário=${userId}`,
        );
        this.logger.websocket(
          `Rate limit inbound: event=${event}, user=${userId}`,
        );
        return;
      }

      const userId = socket.data?.userId;
      const argsPreview = JSON.stringify(args).substring(0, 100);
      this.logger.websocket(
        `Evento recebido: ${event}, usuário=${userId}, args=${argsPreview}`,
      );
      this.logger.websocket(
        `Event received: ${event}, user=${userId}, args=${argsPreview}`,
      );
    });

    socket.on(
      RT_EVENT.NOTIFICATION_DELIVERED,
      async (payload: { messageId: string }) => {
        await this.handleNotificationDelivered(socket, payload);
      },
    );

    socket.on(
      RT_EVENT.NOTIFICATION_DELIVERY_FAILED,
      async (payload: { messageId: string; error?: string }) => {
        await this.handleNotificationDeliveryFailed(socket, payload);
      },
    );
  }

  /**
   * EN -
   * Registers connection event handler for new socket connections.
   * Sets up inbound event handlers when a new client connects to the WebSocket server.
   *
   * PT -
   * Registra handler de evento de conexão para novas conexões de socket.
   * Configura handlers de eventos inbound quando um novo cliente conecta ao servidor WebSocket.
   *
   * @param server - Socket.IO server instance
   */
  private registerConnectionHandlers(server: Server): void {
    server.on("connection", (socket: any) => {
      this.registerInboundEventHandlers(socket);
    });
  }

  /**
   * EN -
   * Initialize WebSocket server with Redis adapter for horizontal scaling.
   *
   * This enables multiple WebSocket server instances to communicate via Redis Pub/Sub,
   * allowing horizontal scaling across multiple nodes.
   *
   * Configuration:
   * - USE_WS_REDIS_ADAPTER=true (required for multi-instance deployments)
   * - REDIS_URL=redis://host:port (Redis instance for Pub/Sub)
   *
   * For production with millions of users:
   * - Always enable Redis adapter (USE_WS_REDIS_ADAPTER=true)
   * - Use Redis Cluster for high availability
   * - Configure Redis with appropriate memory and persistence settings
   * - Monitor Redis Pub/Sub performance
   *
   * Inicializar servidor WebSocket com adaptador Redis para escalonamento horizontal.
   *
   * Isto permite que múltiplas instâncias de servidor WebSocket se comuniquem via Redis Pub/Sub,
   * permitindo escalonamento horizontal entre múltiplos nós.
   *
   * Configuração:
   * - USE_WS_REDIS_ADAPTER=true (requerido para deployments multi-instância)
   * - REDIS_URL=redis://host:port (instância Redis para Pub/Sub)
   *
   * Para produção com milhões de usuários:
   * - Sempre habilite o adaptador Redis (USE_WS_REDIS_ADAPTER=true)
   * - Use Redis Cluster para alta disponibilidade
   * - Configure Redis com configurações apropriadas de memória e persistência
   * - Monitore performance do Redis Pub/Sub
   *
   * @param server - Socket.IO server instance
   */
  afterInit(server: Server): void {
    if (this.shouldUseRedisAdapter()) {
      this.initializeRedisAdapter(server);
    } else {
      this.logger.websocket(
        "Redis adapter disabled - WebSocket will not scale horizontally. Set USE_WS_REDIS_ADAPTER=true for production.",
      );
    }

    this.registerConnectionHandlers(server);
  }

  async handleConnection(socket: any) {
    try {
      this.logger.websocket(`New WebSocket connection: ${socket.id}`);
      const cookieHeader: string | undefined =
        socket.handshake?.headers?.cookie;
      if (!cookieHeader) {
        this.logger.websocket(`No cookies on handshake for: ${socket.id}`);
        socket.disconnect(true);
        return;
      }
      const sessionCookieName =
        this.config.get<string>("app.jwt.cookieName") || "mt_session";
      const rawToken = this.extractCookie(cookieHeader, sessionCookieName);
      if (!rawToken) {
        this.logger.websocket(
          `Missing session cookie: ${sessionCookieName} for: ${socket.id}`,
        );
        socket.disconnect(true);
        return;
      }
      const payload: any = await this.jwt
        .verifyAsync(rawToken)
        .catch(() => null);
      if (!payload?.sub) {
        this.logger.websocket(`Invalid JWT on websocket for: ${socket.id}`);
        socket.disconnect(true);
        return;
      }
      socket.data.userId = payload.sub;
      this.joinUserRoom(socket, payload.sub);
      const userMemberships = await this.memberships.listByUser(payload.sub);
      userMemberships.forEach((m) => this.joinCompanyRoom(socket, m.companyId));
      this.logger.websocket(
        `WebSocket authenticated: user=${payload.sub}, rooms=${userMemberships.length}, socket=${socket.id}`,
      );
      this.activeConnections++;
      this.metricConnections.set(this.activeConnections);
      this.logger.websocket(`Active connections: ${this.activeConnections}`);
    } catch (err: any) {
      this.logger.websocket(
        `WebSocket connection error: ${err?.message}, socket=${socket.id}`,
      );
      this.logger.error(`WS connection error: ${err?.message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: any) {
    this.logger.websocket(
      `Client disconnected: ${socket.id}, user=${socket.data?.userId}`,
    );
    if (this.activeConnections > 0) {
      this.activeConnections--;
      this.metricConnections.set(this.activeConnections);
    }
    this.logger.websocket(`Active connections: ${this.activeConnections}`);
  }

  async emitToCompany(companyId: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.error(
        `WebSocket server not initialized. Cannot emit to company: ${companyId}, event: ${event}`,
      );
      return;
    }
    if (!(await this.allowEmit(companyId, event))) {
      this.logger.websocket(
        `Rate limit: emit to company blocked, company=${companyId}, event=${event}`,
      );
      return;
    }
    this.logger
      .websocket(`Emitting to company: company=${companyId}, event=${event}, 
        payload=${JSON.stringify(payload).substring(0, 100)}`);
    this.server.to(`company:${companyId}`).emit(event, payload);
    this.metricEmits.inc({ event });
  }

  async emitToUser(userId: string, event: string, payload: any) {
    if (!this.server) {
      this.logger.error(
        `WebSocket server not initialized. Cannot emit to user: ${userId}, event: ${event}`,
      );
      return;
    }
    if (!(await this.allowEmit(userId, event))) {
      this.logger.websocket(
        `Rate limit: emit to user blocked, user=${userId}, event=${event}`,
      );
      return;
    }
    this.logger.websocket(`Emitting to user: user=${userId}, event=${event}, 
        payload=${JSON.stringify(payload).substring(0, 100)}`);
    this.server.to(`user:${userId}`).emit(event, payload);
    this.metricEmits.inc({ event });
  }

  async broadcast(event: string, payload: any) {
    if (!this.server) {
      this.logger.error(
        `WebSocket server not initialized. Cannot broadcast event: ${event}`,
      );
      return;
    }
    if (!(await this.allowEmit("broadcast", event))) {
      this.logger.websocket(`Rate limit: broadcast blocked, event=${event}`);
      return;
    }
    this.logger.websocket(
      `Broadcast: event=${event}, payload=${JSON.stringify(payload).substring(0, 100)}`,
    );
    this.server.emit(event, payload);
    this.metricEmits.inc({ event });
  }

  joinUserRoom(socket: any, userId: string) {
    this.logger.websocket(
      `Joining user room: user=${userId}, socket=${socket.id}`,
    );
    socket.join(`user:${userId}`);
  }

  joinCompanyRoom(socket: any, companyId: string) {
    this.logger.websocket(
      `Joining company room: company=${companyId}, socket=${socket.id}`,
    );
    socket.join(`company:${companyId}`);
  }

  private extractCookie(
    cookieHeader: string,
    name: string,
  ): string | undefined {
    const parts = cookieHeader.split(/;\s*/);
    for (const part of parts) {
      const [k, ...rest] = part.split("=");
      if (k === name) {
        return rest.join("=");
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
      this.logger.websocket(
        `Rate limit Redis: key=${bucketKey}, current=${current}`,
      );
    } catch (e: any) {
      this.logger.websocket(`Rate limit Redis failure: ${e.message}`);
      return true;
    }
    const eventMax = this.perEventMax[event] ?? this.rateMax;
    this.metricRateUsage.observe({ event }, current / eventMax);
    if (current > eventMax) {
      this.logger.websocket(
        `Rate limit exceeded: key=${key}, event=${event}, current=${current}, max=${eventMax}`,
      );
      this.metricRateLimited.inc({ event });
      return false;
    }
    return true;
  }

  private async allowInbound(socket: any, event: string): Promise<boolean> {
    if (!this.redisClient) return true;
    const userId = socket.data?.userId || "anon";
    const key = `ws:inbound:${userId}:${event}`;
    const ttlSeconds = Math.ceil(this.inboundWindowMs / 1000);
    let current: number;
    try {
      current = await this.redisClient.incr(key);
      if (current === 1) await this.redisClient.expire(key, ttlSeconds);
      this.logger.websocket(
        `Inbound rate limit Redis: user=${userId}, event=${event}, current=${current}`,
      );
    } catch (e: any) {
      this.logger.websocket(`Inbound rate limit Redis failure: ${e.message}`);
      return true;
    }
    if (current > this.inboundRateMax) {
      this.logger.websocket(
        `Inbound rate limit exceeded: user=${userId}, event=${event}, current=${current}, max=${this.inboundRateMax}`,
      );
      this.metricRateLimited.inc({ event });
      return false;
    }
    return true;
  }
}

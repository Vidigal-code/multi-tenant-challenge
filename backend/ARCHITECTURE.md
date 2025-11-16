# Arquitetura para Suporte a Milhões de Usuários Simultâneos

Este documento descreve a arquitetura do sistema projetada para suportar milhões de usuários simultâneos.

## Visão Geral

A arquitetura é baseada em princípios de escalabilidade horizontal, processamento assíncrono e alta disponibilidade.

## Componentes Principais

### 5.1 WebSocket Distribuído (NestJS)

**Implementação:**
- Múltiplas instâncias do servidor WebSocket podem ser executadas
- Comunicação entre instâncias via Redis Pub/Sub usando `@socket.io/redis-adapter`
- Conexões tratadas de forma stateless (sem estado no servidor)
- Cada evento real-time é distribuído entre os nós do cluster

**Configuração:**
```env
USE_WS_REDIS_ADAPTER=true  # Habilitado automaticamente em produção
REDIS_URL=redis://host:port
```

**Características:**
- Rate limiting por usuário e por evento usando Redis
- Métricas Prometheus para monitoramento
- Reconexão automática com retry
- Autenticação via JWT (stateless)

**Arquivos:**
- `backend/src/realtime/events.gateway.ts` - Gateway WebSocket principal
- Redis adapter habilitado automaticamente em produção

### 5.2 RabbitMQ – Processamento em Filas

**Implementação:**
- Filas dedicadas para cada tipo de evento:
  - `events.invites` - Eventos de convites (consumed by InvitesEventsConsumer)
  - `events.members` - Eventos de membros (consumed by MembersEventsConsumer)
  - `notifications.realtimes` - Notificações em tempo real
  - `invites` - Processamento de convites (legacy)
  - `events` - Eventos genéricos
- Dead Letter Queues (DLQ) para mensagens falhadas
- Retry automático com contador de tentativas
- Deduplicação de mensagens usando Redis
- Prefetch configurável para processamento paralelo

**Configuração:**
```env
RABBITMQ_URL=amqp://user:pass@host:port
RABBITMQ_PREFETCH=50  # Mensagens processadas em paralelo por worker
RABBITMQ_RETRY_MAX=5  # Máximo de tentativas antes de DLQ
```

**Características:**
- Filas duráveis (sobrevivem a reinicializações)
- Mensagens persistentes (escritas em disco)
- Múltiplos workers podem consumir da mesma fila
- Processamento assíncrono não bloqueia o WebSocket

**Arquivos:**
- `backend/src/infrastructure/messaging/services/rabbitmq.service.ts`
- `backend/src/interfaces/consumers/base.resilient.consumer.ts`
- `backend/src/interfaces/consumers/events/*.consumer.ts`

### 5.3 Redis – Cache, Sessões e Coordenação

**Usos:**
1. **Cache de Validação de Email** - Reduz chamadas a APIs externas
2. **Rate Limiting** - Limita eventos por usuário/evento
3. **Deduplicação de Mensagens** - Evita processamento duplicado
4. **WebSocket Pub/Sub** - Sincroniza eventos entre instâncias
5. **Presença de Usuários** - Gerenciamento de online/offline (futuro)

**Configuração:**
```env
REDIS_URL=redis://host:port
```

**Para Alta Escala:**
- Use Redis Cluster para alta disponibilidade
- Configure memória e persistência adequadas
- Monitore performance do Pub/Sub

**Arquivos:**
- `backend/src/infrastructure/cache/redis-email-validation.service.ts`
- `backend/src/realtime/events.gateway.ts` (rate limiting)
- `backend/src/interfaces/consumers/base.resilient.consumer.ts` (deduplicação)

### 5.4 API Backend (NestJS)

**Características:**
- Arquitetura stateless (sem estado no servidor)
- Autenticação via JWT (cookies httpOnly)
- Processamento assíncrono via RabbitMQ
- Integração com banco de dados via Prisma

**Escalabilidade:**
- Múltiplas instâncias podem ser executadas
- Load balancer distribui requisições
- Sem dependências entre instâncias

**Arquivos:**
- `backend/src/app.module.ts` - Módulo principal
- `backend/src/main.ts` - Bootstrap da aplicação

### 5.5 Banco de Dados Escalável

**PostgreSQL com Prisma:**
- Connection pooling via DATABASE_URL
- Índices otimizados nas tabelas principais
- Transações isoladas e consistentes

**Configuração de Connection Pooling:**
```env
DATABASE_URL=postgresql://user:pass@host:port/db?connection_limit=10&pool_timeout=20
```

**Recomendações para Alta Escala:**
- Use PgBouncer para transaction-level pooling
- Configure réplicas de leitura para queries read-only
- Particione tabelas grandes (notifications, etc.)
- Monitore e otimize índices

**Schema:**
- `backend/prisma/schema.prisma` - Schema do banco de dados
- Índices já configurados em:
  - `User.activeCompanyId`
  - `Membership.companyId, userId`
  - `Notification.companyId, senderUserId, recipientUserId`
  - `Friendship.requesterId, addresseeId, status`

**Arquivos:**
- `backend/src/infrastructure/prisma/services/prisma.service.ts`
- `backend/prisma/schema.prisma`

### 5.6 Load Balancer

**Recomendações de Infraestrutura:**
- **Nginx** - Para balanceamento HTTP/WebSocket
- **HAProxy** - Alternativa para alta performance
- **AWS ELB/ALB** - Para deployments na AWS
- **Cloudflare** - Para CDN e proteção DDoS

**Configuração WebSocket:**
```nginx
# Nginx example
upstream backend {
    ip_hash;  # Sticky sessions para WebSocket
    server backend1:4000;
    server backend2:4000;
    server backend3:4000;
}

server {
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Fluxo de Eventos

1. **Evento de Domínio Ocorre** (ex: convite criado, membro removido)
2. **WsDomainEventsBridgeService.publish()** é chamado
3. **RabbitMQDomainEventsService** roteia o evento para a fila correta:
   - `invites.*` → `events.invites` queue
   - `memberships.*` → `events.members` queue
   - Outros → `events` queue
4. **RabbitMQ** recebe o evento (não bloqueia)
5. **NotificationCreatorService** cria notificação no banco
6. **WebSocket** emite evento em tempo real
7. **Workers** (InvitesEventsConsumer, MembersEventsConsumer) processam eventos assincronamente
8. Workers enviam para `notifications.realtimes` queue para processamento adicional

## Monitoramento

**Métricas Prometheus:**
- `ws_connections_active` - Conexões WebSocket ativas
- `ws_events_emitted_total` - Total de eventos emitidos
- `ws_events_rate_limited_total` - Eventos bloqueados por rate limit

**Health Checks:**
- `GET /health` - Verifica PostgreSQL, RabbitMQ, Redis

## Configuração de Produção

**Variáveis de Ambiente Essenciais:**
```env
# WebSocket
USE_WS_REDIS_ADAPTER=true
REDIS_URL=redis://redis-cluster:6379
WS_CORS_ORIGIN=https://yourdomain.com

# RabbitMQ
RABBITMQ_URL=amqp://user:pass@rabbitmq-cluster:5672
RABBITMQ_PREFETCH=50
RABBITMQ_RETRY_MAX=5

# Database
DATABASE_URL=postgresql://user:pass@postgres-primary:5432/db?connection_limit=10
# Para réplicas de leitura:
DATABASE_READ_REPLICA_URL=postgresql://user:pass@postgres-replica:5432/db

# Redis
REDIS_URL=redis://redis-cluster:6379
```

## Escalabilidade Horizontal

**Para escalar:**
1. Adicione mais instâncias do backend (API + WebSocket)
2. Configure load balancer para distribuir tráfego
3. Adicione mais workers RabbitMQ
4. Use Redis Cluster para alta disponibilidade
5. Configure réplicas de leitura do PostgreSQL

**Limites Teóricos:**
- WebSocket: ~10k conexões por instância (depende de recursos)
- RabbitMQ: Milhões de mensagens/segundo (com cluster)
- PostgreSQL: Depende de hardware e configuração
- Redis: Milhões de operações/segundo (com cluster)

## Boas Práticas

1. **Sempre habilite Redis adapter em produção** (`USE_WS_REDIS_ADAPTER=true`)
2. **Use RabbitMQ Cluster** para alta disponibilidade
3. **Configure connection pooling** no PostgreSQL
4. **Monitore queue depths** no RabbitMQ
5. **Use Redis Cluster** para alta disponibilidade
6. **Configure health checks** e alertas
7. **Implemente circuit breakers** para resiliência
8. **Use CDN** para assets estáticos


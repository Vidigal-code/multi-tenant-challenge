# Arquitetura - RabbitMQ & WebSocket

## Visão Geral

Este documento descreve a arquitetura do sistema de notificações em tempo real usando RabbitMQ para filas de mensagens e WebSocket para comunicação em tempo real.

## Fluxo de Mensagens

```
Evento → Fila RabbitMQ → Worker → notifications.realtimes → Worker Realtime → WebSocket → Frontend → BD
```

### Fluxo Completo

1. **Evento Gerado** - Evento de domínio (mudança de membro, convite, notificação, etc.)
2. **RabbitMQ Producer** - Publica evento para fila específica (`events.members`, `events.invites`, `events`)
3. **Worker Intermediário** - Consome da fila de origem, encaminha para `notifications.realtimes`
4. **Worker Realtime** - Consome de `notifications.realtimes`, processa com confirmação de entrega
5. **Emissão WebSocket** - Emite notificação para usuários conectados via WebSocket
6. **Confirmação Frontend** - Frontend confirma entrega via WebSocket
7. **Persistência BD** - Notificação salva no banco apenas após confirmação
8. **Auto-cleanup** - Entregas pendentes expiradas são limpas automaticamente

## Filas RabbitMQ

### Filas de Origem

| Fila | Propósito | DLQ | Worker |
|------|-----------|-----|--------|
| `events.members` | Eventos de membros (mudanças de cargo, entradas, saídas) | `dlq.events.members` | `worker:members` |
| `events.invites` | Eventos de convites (criados, aceitos, rejeitados) | `dlq.events.invites` | `worker:invites` |
| `events` | Eventos genéricos (notificações, amizades) | `dlq.events` | `worker:generic` |

### Fila de Destino

| Fila | Propósito | DLQ | Worker |
|------|-----------|-----|--------|
| `notifications.realtimes` | Fila unificada de notificações para processamento em tempo real | `dlq.notifications.realtimes` | `worker:realtime` |

### Recursos das Filas

- **Durabilidade**: Sobrevive a reinicializações do broker
- **Mensagens Persistentes**: Escritas em disco para confiabilidade
- **DLQ (Dead Letter Queue)**: Mensagens falhadas após máximo de tentativas
- **Prefetch**: 50 mensagens por worker (configurável)
- **Retry**: Até 5 tentativas (configurável) com backoff exponencial
- **Desduplicação**: Baseada em Redis para prevenir processamento duplicado

## Workers

### 1. Workers Intermediários

**Propósito**: Consumir de filas de origem e encaminhar para `notifications.realtimes`

- **`worker:invites`** (`invites.events.consumer.ts`)
  - Consome: `events.invites`
  - Encaminha: → `notifications.realtimes`
  
- **`worker:members`** (`members.events.consumer.ts`)
  - Consome: `events.members`
  - Encaminha: → `notifications.realtimes`
  
- **`worker:generic`** (`generic.events.consumer.ts`)
  - Consome: `events`
  - Encaminha: → `notifications.realtimes` (apenas para eventos de notificação/amizade)

### 2. Worker Realtime

**Propósito**: Processar notificações com confirmação de entrega

- **`worker:realtime`** (`realtime-notifications.consumer.ts`)
  - Consome: `notifications.realtimes`
  - Recursos:
    - Confirmação de entrega via WebSocket
    - Rastreamento de entregas pendentes baseado em Redis
    - Persistência no banco apenas após confirmação
    - Tratamento de timeout (60s padrão)
    - Auto-cleanup de entregas expiradas

### Arquitetura dos Workers

- **Classe Base**: `BaseResilientConsumer`
  - Retry automático com backoff exponencial
  - Roteamento DLQ para mensagens falhadas
  - Desduplicação Redis
  - Controle de prefetch
  
- **Delivery-Aware**: `BaseDeliveryAwareConsumer` (estende `BaseResilientConsumer`)
  - Adiciona etapa de confirmação de entrega
  - Aguarda confirmação do frontend antes de reconhecer
  - Trata lógica de timeout e retry

## Arquitetura WebSocket

### EventsGateway

**Propósito**: Transmissão de eventos em tempo real para clientes conectados

- **Namespace**: `/rt`
- **Autenticação**: Baseada em JWT via cookies
- **Salas**: 
  - `user:{userId}` - Notificações específicas do usuário
  - `company:{companyId}` - Notificações da empresa

### Fluxo de Conexão

1. Cliente conecta → Handshake WebSocket
2. Extrai JWT dos cookies
3. Valida JWT → autentica usuário
4. Entra em salas: `user:{userId}` + `company:{companyId}`
5. Pronto para receber eventos em tempo real

### Eventos

- `notifications.created` - Nova notificação
- `notifications.delivered` - Confirmação de entrega (cliente → servidor)
- `notifications.delivery.failed` - Falha de entrega (cliente → servidor)
- `companys.updated` - Atualizações da empresa
- `member.joined` - Membro entrou
- `member.left` - Membro saiu
- `invites.rejected` - Convite rejeitado
- `notifications.read` - Notificação lida
- `friend.request.sent` - Solicitação de amizade enviada
- `friend.request.accepted` - Solicitação de amizade aceita
- `friend.removed` - Amigo removido

### Recursos

- **Rate Limiting**: Baseado em Redis por usuário/tipo de evento
- **Adaptador Redis**: Escalonamento horizontal entre instâncias (opcional)
- **Métricas**: Métricas Prometheus para conexões e eventos

## Sistema de Confirmação de Entrega

### Propósito

Garantir que notificações sejam entregues com sucesso aos clientes antes de persistir no banco de dados.

### Fluxo

1. **Worker recebe mensagem** de `notifications.realtimes`
2. **Gera messageId** - Identificador único para esta entrega
3. **Armazena entrega pendente** no Redis com TTL (60s padrão)
4. **Emite evento WebSocket** para usuário com `messageId`
5. **Aguarda confirmação** - Consulta Redis por confirmação (intervalo 500ms)
6. **Frontend confirma** - Cliente envia `notifications.delivered` com `messageId`
7. **Salva no banco** - Apenas após confirmação recebida
8. **Remove do Redis** - Limpa entrega pendente
9. **Reconhece RabbitMQ** - ACK mensagem (remove da fila)

### Tratamento de Timeout

- Se nenhuma confirmação em 60s → Salva no BD mesmo assim (degradação elegante)
- Remove entrega pendente do Redis
- Registra timeout para monitoramento

### Chaves Redis

- `delivery:pending:{messageId}` - Entrega pendente com payload e metadados
- TTL: 60 segundos (configurável via `DELIVERY_CONFIRMATION_TTL`)
- Auto-cleanup: A cada 60 segundos (remove entradas expiradas)

## Uso do Redis

### 1. Desduplicação de Mensagens

**Propósito**: Prevenir processamento duplicado de mensagens

**Chaves**: 
- `evt:{eventId}:user:{userId}:ts:{timestamp}:uid:{uniqueId}:{oldRole}->{newRole}`
- `realtime:evt:{eventId}:...` (para worker realtime)

**TTL**: 60 segundos (configurável via `dedupTtlSeconds`)

### 2. Confirmação de Entrega

**Propósito**: Rastrear entregas pendentes aguardando confirmação do cliente

**Chaves**: `delivery:pending:{messageId}`

**TTL**: 60 segundos (configurável via `DELIVERY_CONFIRMATION_TTL`)

**Auto-cleanup**: A cada 60 segundos

### 3. Rate Limiting

**Propósito**: Prevenir abuso do WebSocket

**Chaves**: `ws:rate:{userId}:{event}`

**Janela**: 1 segundo (configurável)

**Limite**: 50 eventos por janela (configurável)

## Diagrama

```
┌─────────────┐
│   Evento    │ (Mudança de membro, convite, notificação, etc.)
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│      RabbitMQ Producer              │
│  (events.producer.ts)               │
└──────┬──────────────────────────────┘
       │
       ├──────► events.members ───────┐
       ├──────► events.invites ───────┤
       └──────► events ───────────────┤
                                       │
┌──────────────────────────────────────┴──────────┐
│        Workers Intermediários                  │
│  worker:members | worker:invites | worker:generic│
└──────┬──────────────────────────────────────────┘
       │ Encaminha para
       ▼
┌────────────────────────────┐
│ notifications.realtimes   │
└──────┬─────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Worker Realtime                  │
│   (realtime-notifications.consumer) │
│                                     │
│   1. Gera messageId                 │
│   2. Armazena no Redis (pendente)   │
│   3. Emite WebSocket                │
│   4. Aguarda confirmação            │
│   5. Salva no BD (se confirmado)    │
│   6. Limpa                          │
└──────┬──────────────────────────────┘
       │
       ├──────► WebSocket ───────────► Frontend
       │                                  │
       │                                  │ Confirma
       │                                  │
       ▼                                  ▼
┌─────────────────────────────────────────┐
│      Confirmação de Entrega            │
│      (Redis + WebSocket)                │
└──────┬──────────────────────────────────┘
       │
       ▼
┌────────────────────────────┐
│   Banco de Dados (PostgreSQL)│
│   (Notificação salva)      │
└────────────────────────────┘
```

## Recursos de Escalabilidade

### Escalonamento Horizontal

- **Múltiplos Workers**: Faça deploy de múltiplas instâncias de cada tipo de worker
- **Distribuição de Filas**: RabbitMQ distribui mensagens entre workers
- **Escalonamento WebSocket**: Adaptador Redis permite transmissão multi-instância
- **Redis Cluster**: Suporte para Redis Cluster para alta disponibilidade

### Configuração

- **Prefetch**: Ajuste baseado no tempo de processamento (padrão: 50)
- **Retry Max**: Configure tentativas de retry (padrão: 5)
- **Delivery TTL**: Ajuste timeout de confirmação (padrão: 60s)
- **Dedup TTL**: Configure janela de desduplicação (padrão: 60s)
- **Rate Limits**: Limitação de taxa por evento (configurável via env vars)

## Monitoramento

### Endpoints

- `GET /workers/status` - Status de todos os workers
- `GET /workers/:workerType/status` - Status de worker específico
- `GET /workers/:workerType/overloaded` - Verifica se worker está sobrecarregado
- `GET /workers/:workerType/count` - Contagem de workers ativos

### Métricas

- Profundidade de filas RabbitMQ
- Contagens de entregas pendentes (Redis)
- Contagens de conexões WebSocket
- Taxas de emissão de eventos
- Taxas de confirmação de entrega
- Taxas de timeout

## Tratamento de Erros

### Estratégia de Retry

- Retry automático com backoff exponencial
- Máximo de tentativas: 5 (configurável)
- Após máximo de tentativas → DLQ

### Dead Letter Queue (DLQ)

- Mensagens falhadas após máximo de tentativas
- Inspeção manual e reprocessamento
- Previne perda de mensagens

### Degradação Elegante

- Se WebSocket indisponível → Salva no BD mesmo assim após timeout
- Se Redis indisponível → Desduplicação desabilitada (pode processar duplicatas)
- Se RabbitMQ indisponível → Mensagens enfileiradas localmente (se producer suportar)

## Variáveis de Ambiente

```env
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_PREFETCH=50
RABBITMQ_RETRY_MAX=5

# Redis
REDIS_URL=redis://localhost:6379

# Confirmação de Entrega
DELIVERY_CONFIRMATION_TTL=60
DELIVERY_POLLING_INTERVAL_MS=1000

# WebSocket
WORKER_PORT=4001
WS_NAMESPACE=/rt
WS_CORS_ORIGIN=http://localhost:3000
USE_WS_REDIS_ADAPTER=false

# Rate Limiting
WS_RATE_LIMIT_WINDOW_MS=1000
WS_RATE_LIMIT_MAX=50
```

## Componentes Principais

### Serviços

- **RabbitMQService** - Conexão RabbitMQ e gerenciamento de filas
- **DeliveryConfirmationService** - Rastreamento de entrega baseado em Redis
- **EventsGateway** - Transmissão de eventos WebSocket
- **NotificationCreatorService** - Criação de notificações no banco

### Producers

- **EventsProducer** - Publica eventos para filas RabbitMQ
- **InviteProducer** - Publica eventos de convite

### Consumers

- **BaseResilientConsumer** - Classe base com retry, DLQ, dedup
- **BaseDeliveryAwareConsumer** - Estende com confirmação de entrega
- **RealtimeNotificationsConsumer** - Processamento de notificações em tempo real
- **MembersEventsConsumer** - Encaminhamento de eventos de membros
- **InvitesEventsConsumer** - Encaminhamento de eventos de convites
- **GenericEventsConsumer** - Encaminhamento de eventos genéricos

## Resumo

A arquitetura fornece:

✅ **Confiabilidade** - Filas persistentes, lógica de retry, DLQ
✅ **Escalabilidade** - Múltiplos workers, escalonamento horizontal
✅ **Tempo Real** - WebSocket para notificações instantâneas
✅ **Confirmação** - Confirmação de entrega antes de persistir no BD
✅ **Desduplicação** - Baseada em Redis para prevenir duplicatas
✅ **Monitoramento** - Endpoints de status e métricas
✅ **Tolerância a Falhas** - Degradação elegante e tratamento de erros

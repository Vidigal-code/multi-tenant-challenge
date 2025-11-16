# Configuração do RabbitMQ - Processamento em Filas e Auto-Escalabilidade

## ✅ Correções Implementadas

### 1. Roteamento de Eventos Corrigido

**Antes:**
- `invites.created` → `invites` queue (não tinha consumer)
- `memberships.removed` → `events` queue (não tinha consumer)

**Agora:**
- `invites.created`, `invites.accepted`, `invites.rejected` → `events.invites` queue ✅
- `memberships.joined`, `memberships.removed`, `memberships.role.updated`, `memberships.left` → `events.members` queue ✅

### 2. Producers Atualizados

**InviteProducer:**
- `emitInviteCreated()` - Envia para `invites` queue (legacy)
- `emitInviteEvent()` - **NOVO** - Envia para `events.invites` queue (workers)

**EventsProducer:**
- `emitGenericEvent()` - Envia para `events` queue
- `emitMemberEvent()` - **NOVO** - Envia para `events.members` queue (workers)

### 3. Domain Events Service

Agora roteia corretamente todos os eventos:
- Eventos de convites → `events.invites`
- Eventos de membros → `events.members`
- Outros eventos → `events`

## 📋 Eventos Ativados

### Eventos de Convites (→ `events.invites`)
- ✅ `invites.created` - Quando um convite é criado
- ✅ `invites.accepted` - Quando um convite é aceito
- ✅ `invites.rejected` - Quando um convite é rejeitado

### Eventos de Membros (→ `events.members`)
- ✅ `memberships.joined` - Quando um membro entra na empresa
- ✅ `memberships.removed` - Quando um membro é removido
- ✅ `memberships.role.updated` - Quando o cargo de um membro muda
- ✅ `memberships.left` - Quando um membro sai da empresa

## 🚀 Como Funciona

### Fluxo Completo:

1. **Evento é Publicado**
   ```typescript
   await domainEvents.publish({
       name: "invites.created",
       payload: { ... }
   });
   ```

2. **WsDomainEventsBridgeService** recebe o evento
   - Publica no RabbitMQ (via RabbitMQDomainEventsService)
   - Cria notificação
   - Emite via WebSocket

3. **RabbitMQDomainEventsService** roteia para a fila correta
   - `invites.*` → `events.invites`
   - `memberships.*` → `events.members`

4. **Workers Processam**
   - `InvitesEventsConsumer` consome `events.invites`
   - `MembersEventsConsumer` consome `events.members`
   - Workers enviam para `notifications.realtimes` para processamento adicional

## 🔧 Configuração Necessária

### 1. Variáveis de Ambiente

```env
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
RABBITMQ_PREFETCH=50
RABBITMQ_RETRY_MAX=5

# Redis (para deduplicação)
REDIS_URL=redis://localhost:6379
```

### 2. Workers em Execução

**Terminal 1 - Invites Worker:**
```bash
npm run worker:invites
```

**Terminal 2 - Members Worker:**
```bash
npm run worker:members
```

### 3. Verificar Filas no RabbitMQ

Acesse o RabbitMQ Management UI (geralmente em `http://localhost:15672`):
- Verifique as filas: `events.invites`, `events.members`
- Verifique as DLQs: `dlq.events.invites`, `dlq.events.members`
- Monitore o processamento de mensagens

## ✅ Checklist de Funcionamento

- [x] Roteamento de eventos corrigido
- [x] Producers atualizados com novos métodos
- [x] Workers configurados e rodando
- [x] DLQs configuradas
- [x] Deduplicação via Redis
- [x] Retry automático
- [x] Prefetch configurável

## 📊 Monitoramento

### Verificar se está funcionando:

1. **Criar um convite** → Deve aparecer em `events.invites`
2. **Remover um membro** → Deve aparecer em `events.members`
3. **Verificar logs dos workers** → Devem processar as mensagens
4. **Verificar RabbitMQ UI** → Filas devem processar mensagens

### Métricas importantes:

- **Queue Depth** - Quantidade de mensagens na fila
- **Consumer Count** - Número de workers consumindo
- **Message Rate** - Taxa de mensagens processadas
- **DLQ Size** - Mensagens que falharam (deve ser 0 ou baixo)

## 🔄 Auto-Escalabilidade

Para escalar horizontalmente:

1. **Adicione mais workers:**
   ```bash
   # Terminal 3
   npm run worker:invites
   
   # Terminal 4
   npm run worker:members
   ```

2. **RabbitMQ distribui automaticamente** as mensagens entre os workers

3. **Cada worker processa até `prefetch` mensagens** simultaneamente

4. **Redis deduplica** para evitar processamento duplicado

## 🐛 Troubleshooting

### Mensagens não estão sendo processadas:

1. Verifique se os workers estão rodando
2. Verifique se o RabbitMQ está conectado
3. Verifique os logs dos workers
4. Verifique a fila no RabbitMQ UI

### Mensagens indo para DLQ:

1. Verifique os logs dos workers para erros
2. Verifique se o Redis está conectado (para deduplicação)
3. Aumente `RABBITMQ_RETRY_MAX` se necessário

### Performance lenta:

1. Aumente `RABBITMQ_PREFETCH` (cuidado com memória)
2. Adicione mais workers
3. Verifique se o Redis está rápido
4. Monitore o uso de CPU/memória


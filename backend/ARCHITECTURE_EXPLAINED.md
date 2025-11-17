# 🏗️ Arquitetura Explicada - RabbitMQ, WebSocket e Redis

## 📋 Visão Geral

Este documento explica como funciona a arquitetura de notificações em tempo real usando **RabbitMQ**, **WebSocket** e **Redis**, com exemplos práticos usando personagens reais.

---

## 🎭 Personagens do Exemplo

- **Kauan** - Proprietário (OWNER) da empresa "TechCorp"
- **Pedro** - Administrador (ADMIN) da empresa "TechCorp"  
- **Ana** - Membro (MEMBER) da empresa "TechCorp"

---

## 📖 Exemplo Prático: Ana Mudou de Cargo

### Cenário
Kauan (OWNER) decide promover Ana de MEMBER para ADMIN na empresa TechCorp.

### Fluxo Completo Passo a Passo

#### 1️⃣ **Evento Gerado** (Backend API)
```
Kauan clica em "Promover Ana para ADMIN"
↓
POST /company/techcorp-id/members/ana-id/role
↓
ChangeMemberRoleUseCase.execute()
```

**Regras de Negócio Aplicadas:**
- ✅ Kauan é OWNER → Pode alterar cargos
- ✅ Ana é MEMBER → Pode ser promovida
- ✅ Verifica se não é o último OWNER (não aplicável aqui)
- ✅ Atualiza role de Ana: MEMBER → ADMIN

#### 2️⃣ **Evento Publicado no RabbitMQ**
```typescript
// EventPayloadBuilderService.build() cria payload:
{
  eventId: "ROLE_CHANGED",
  sender: {
    id: "kauan-id",
    name: "Kauan",
    email: "kauan@email.com"
  },
  receiver: {
    id: "ana-id", 
    name: "Ana",
    email: "ana@email.com"
  },
  company: {
    id: "techcorp-id",
    name: "TechCorp"
  },
  additionalData: {
    previousRole: "MEMBER",
    newRole: "ADMIN"
  }
}
```

**RabbitMQ Producer** publica na fila `events.members`:
```
events.members ← Evento ROLE_CHANGED
```

**Por que `events.members`?**
- Eventos de mudança de cargo/membros → fila dedicada
- Isolamento: problemas em uma fila não afetam outras
- Escalabilidade: workers específicos para cada tipo

#### 3️⃣ **Worker Intermediário Consome**
```
Worker:members (MembersEventsConsumer)
↓
Consome de: events.members
↓
Processa: Verifica se é evento de membro/cargo
↓
Encaminha para: notifications.realtimes
```

**O que acontece:**
- Worker pega mensagem da fila `events.members`
- Valida que é evento de mudança de cargo
- Reencaminha para fila unificada `notifications.realtimes`
- **ACK** na mensagem original (remove de `events.members`)

#### 4️⃣ **Worker Realtime Processa**
```
Worker:realtime (RealtimeNotificationsConsumer)
↓
Consome de: notifications.realtimes
↓
1. Gera messageId único: "msg-abc123"
2. Armazena no Redis: delivery:pending:msg-abc123
3. Emite WebSocket para Ana
4. Aguarda confirmação...
```

**Redis - Entrega Pendente:**
```redis
SET delivery:pending:msg-abc123 {
  "messageId": "msg-abc123",
  "receiverId": "ana-id",
  "payload": { ... },
  "timestamp": "2025-11-16T12:34:56Z"
}
EXPIRE delivery:pending:msg-abc123 60
```

**Por que Redis aqui?**
- ⚡ Rápido: consulta em milissegundos
- 🔄 TTL automático: expira em 60s se não confirmar
- 📊 Rastreamento: sabe quais entregas estão pendentes

#### 5️⃣ **WebSocket Emite para Ana**
```
EventsGateway.emit('notifications.created', {
  messageId: "msg-abc123",
  notification: {
    title: "ROLE_CHANGED:[your_role_in_the_company_has_been_changed.]",
    body: "Seu cargo em TechCorp foi alterado de Membro para Administrador por Kauan (kauan@email.com)",
    meta: {
      kind: "role.changed",
      companyName: "TechCorp",
      role: "ADMIN",
      previousRole: "MEMBER",
      sender: { name: "Kauan", email: "kauan@email.com" }
    }
  }
})
```

**Salas WebSocket:**
- `user:ana-id` ← Ana recebe notificação pessoal
- `company:techcorp-id` ← Outros membros da empresa também podem receber (se configurado)

**Por que WebSocket?**
- ⚡ Tempo real: Ana vê notificação instantaneamente
- 🔄 Bidirecional: Ana pode confirmar recebimento
- 📡 Escalável: Redis adapter permite múltiplos servidores

#### 6️⃣ **Frontend de Ana Recebe**
```javascript
// Ana está online, navegador conectado via WebSocket
socket.on('notifications.created', (data) => {
  // Mostra popup de notificação
  showNotification({
    message: "Seu cargo em TechCorp foi alterado de Membro para Administrador por Kauan",
    icon: "refresh"
  });
  
  // Confirma recebimento
  socket.emit('notifications.delivered', {
    messageId: data.messageId
  });
});
```

**Confirmação Enviada:**
```javascript
socket.emit('notifications.delivered', {
  messageId: "msg-abc123"
});
```

#### 7️⃣ **Worker Realtime Recebe Confirmação**
```
Worker:realtime detecta confirmação no Redis
↓
Redis: GET delivery:pending:msg-abc123 → Encontrado!
↓
1. Remove do Redis: DEL delivery:pending:msg-abc123
2. Salva notificação no PostgreSQL
3. ACK na mensagem RabbitMQ
```

**Notificação Salva no Banco:**
```sql
INSERT INTO Notification (
  id, title, body, recipientUserId, companyId, 
  senderUserId, createdAt, read, meta
) VALUES (
  'notif-xyz789',
  'ROLE_CHANGED:[your_role_in_the_company_has_been_changed.]',
  'Seu cargo em TechCorp foi alterado...',
  'ana-id',  -- Ana recebeu
  'techcorp-id',
  'kauan-id', -- Kauan enviou
  NOW(),
  false,
  '{"kind":"role.changed","role":"ADMIN","previousRole":"MEMBER"}'
);
```

#### 8️⃣ **Ana Vê Notificação Persistida**
- Ana pode ver no histórico de notificações
- Notificação aparece na página `/notifications`
- Pode marcar como lida, responder, etc.

---

## 🔄 Fluxo Visual Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. EVENTO GERADO                                            │
│    Kauan promove Ana (MEMBER → ADMIN)                      │
│    POST /company/techcorp-id/members/ana-id/role           │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. RABBITMQ PRODUCER                                        │
│    Publica em: events.members                               │
│    Payload: { eventId: "ROLE_CHANGED", ... }                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. WORKER:members (Intermediário)                          │
│    Consome: events.members                                   │
│    Encaminha: → notifications.realtimes                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. WORKER:realtime                                          │
│    Consome: notifications.realtimes                         │
│    Gera: messageId = "msg-abc123"                           │
│    Redis: SET delivery:pending:msg-abc123 (TTL 60s)        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. WEBSOCKET (EventsGateway)                                │
│    Emite: notifications.created                             │
│    Sala: user:ana-id                                        │
│    Payload: { messageId, notification }                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. FRONTEND (Ana)                                           │
│    Recebe: notifications.created                          │
│    Mostra: Popup de notificação                            │
│    Confirma: socket.emit('notifications.delivered')        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. WORKER:realtime (Confirmação)                           │
│    Detecta: Confirmação no Redis                            │
│    Remove: DEL delivery:pending:msg-abc123                 │
│    Salva: INSERT INTO Notification                          │
│    ACK: Mensagem removida de notifications.realtimes       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. PERSISTÊNCIA                                             │
│    PostgreSQL: Notificação salva                            │
│    Ana pode ver no histórico                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Componentes e Suas Funções

### 🐰 **RabbitMQ** - Sistema de Filas

**Função:** Garantir que eventos sejam processados de forma confiável e assíncrona.

**Filas Principais:**
- `events.members` - Eventos de membros/cargos
- `events.invites` - Eventos de convites
- `events` - Eventos genéricos
- `notifications.realtimes` - Fila unificada para notificações

**Recursos:**
- ✅ **Durabilidade**: Mensagens sobrevivem a reinicializações
- ✅ **DLQ (Dead Letter Queue)**: Mensagens falhadas vão para fila especial
- ✅ **Retry**: Até 5 tentativas com backoff exponencial
- ✅ **Prefetch**: 50 mensagens por worker (processamento paralelo)

**Exemplo:**
```
Se o worker:realtime cair, as mensagens ficam na fila.
Quando voltar, processa tudo que ficou pendente.
```

### 🔌 **WebSocket** - Comunicação em Tempo Real

**Função:** Enviar notificações instantaneamente para usuários conectados.

**Salas (Rooms):**
- `user:{userId}` - Notificações pessoais
- `company:{companyId}` - Notificações da empresa

**Eventos:**
- `notifications.created` - Nova notificação
- `notifications.delivered` - Confirmação de recebimento
- `notifications.delivery.failed` - Falha na entrega

**Recursos:**
- ✅ **Rate Limiting**: Máximo 50 eventos/segundo por usuário
- ✅ **Redis Adapter**: Escalamento horizontal (múltiplos servidores)
- ✅ **Autenticação JWT**: Apenas usuários autenticados

**Exemplo:**
```
Ana está online → Recebe notificação instantaneamente
Ana está offline → Notificação fica no banco, vê quando voltar
```

### 🔴 **Redis** - Cache e Rastreamento

**Função:** Armazenar dados temporários e rastrear entregas.

**Uso 1: Desduplicação**
```redis
# Previne processar o mesmo evento duas vezes
SET evt:ROLE_CHANGED:user:ana-id:ts:1234567890:uid:xyz
EXPIRE evt:... 60
```

**Uso 2: Confirmação de Entrega**
```redis
# Rastreia entregas pendentes
SET delivery:pending:msg-abc123 {
  "messageId": "msg-abc123",
  "receiverId": "ana-id",
  "payload": {...}
}
EXPIRE delivery:pending:msg-abc123 60
```

**Uso 3: Rate Limiting**
```redis
# Limita eventos WebSocket por usuário
INCR ws:rate:ana-id:notifications.created
EXPIRE ws:rate:ana-id:notifications.created 1
# Se > 50 → Bloqueia
```

**Recursos:**
- ✅ **TTL Automático**: Dados expiram automaticamente
- ✅ **Performance**: Consultas em milissegundos
- ✅ **Cluster**: Suporta Redis Cluster para alta disponibilidade

---

## 📊 Regras de Negócio Aplicadas

### Exemplo: Mudança de Cargo

**Regra 1: Permissões**
```
✅ OWNER pode alterar qualquer cargo
✅ ADMIN pode alterar MEMBER para ADMIN
❌ ADMIN não pode alterar OWNER
❌ MEMBER não pode alterar ninguém
```

**Regra 2: Último Proprietário**
```
❌ Não pode remover último OWNER
✅ Precisa ter pelo menos 1 OWNER sempre
```

**Regra 3: Notificação**
```
✅ Sempre notifica quem teve cargo alterado
✅ Inclui quem fez a alteração (sender)
✅ Inclui cargo anterior e novo cargo
```

**Regra 4: Confirmação de Entrega**
```
✅ Aguarda até 60s por confirmação
✅ Se não confirmar, salva mesmo assim (degradação elegante)
✅ Remove do Redis após confirmar ou timeout
```

---

## 🔍 Casos Especiais

### Caso 1: Ana Está Offline

```
1. Evento gerado → RabbitMQ
2. Worker processa → WebSocket tenta enviar
3. Ana não está conectada → WebSocket não entrega
4. Worker aguarda 60s → Timeout
5. Worker salva no banco mesmo assim
6. Ana volta online → Vê notificação no histórico
```

### Caso 2: Múltiplas Instâncias

```
Servidor 1: Worker:realtime processa evento
Servidor 2: Worker:realtime também processa?
❌ NÃO! RabbitMQ distribui mensagens entre workers
✅ Cada mensagem é processada por apenas 1 worker
```

### Caso 3: Mensagem Duplicada

```
Evento chega duas vezes no RabbitMQ?
✅ Redis desduplica: mesma chave = ignora segunda vez
✅ Previne processar evento duplicado
```

### Caso 4: Worker Cai Durante Processamento

```
Worker:realtime cai após emitir WebSocket mas antes de salvar?
✅ Mensagem volta para fila (NACK)
✅ Outro worker pega e processa novamente
✅ Redis desduplica se já foi processado
```

---

## 🚀 Escalabilidade

### Escalonamento Horizontal

**Workers:**
```
1 worker:members → Processa 50 mensagens/vez
10 workers:members → Processa 500 mensagens/vez
✅ Adicione workers conforme necessário
```

**WebSocket:**
```
1 servidor → 10.000 conexões
10 servidores → 100.000 conexões
✅ Redis adapter sincroniza entre servidores
```

**Redis:**
```
1 instância Redis → 100.000 operações/segundo
Redis Cluster → Milhões de operações/segundo
✅ Escale conforme carga
```

---

## 📈 Monitoramento

### Métricas Importantes

1. **Profundidade de Filas RabbitMQ**
   - Se crescer muito → Adicione workers

2. **Entregas Pendentes no Redis**
   - Se muitas pendentes → Verifique WebSocket

3. **Taxa de Confirmação**
   - Se baixa → Usuários podem estar offline

4. **Taxa de Timeout**
   - Se alta → Aumente TTL ou verifique conectividade

---

## ✅ Resumo

**RabbitMQ:**
- 🐰 Garante processamento confiável
- 📦 Filas persistentes e duráveis
- 🔄 Retry automático e DLQ

**WebSocket:**
- ⚡ Notificações em tempo real
- 🔌 Conexão bidirecional
- 📡 Escalável com Redis adapter

**Redis:**
- 🔴 Cache rápido
- 🔄 Desduplicação
- ⏱️ Rastreamento de entregas
- 🚦 Rate limiting

**Arquitetura de Código:**
- 🏗️ **Princípios SOLID aplicados**: Todos os consumidores refatorados seguindo Single Responsibility Principle
- 📚 **Documentação completa**: Métodos documentados em inglês e português usando padrão JSDoc `/** EN - / PT - */`
- 🔧 **Manutenibilidade**: Código organizado em métodos pequenos e focados, facilitando testes e evolução

**Resultado:**
- ✅ Notificações entregues com confiabilidade
- ✅ Sistema escalável para milhões de usuários
- ✅ Tolerante a falhas
- ✅ Tempo real quando possível
- ✅ Código limpo e bem documentado

---

## 🎓 Aprendizado

**Por que essa arquitetura?**

1. **RabbitMQ** → Garante que eventos não sejam perdidos
2. **WebSocket** → Entrega instantânea quando usuário está online
3. **Redis** → Rastreia entregas e previne duplicatas
4. **Workers** → Processamento assíncrono não bloqueia API
5. **Confirmação** → Garante que notificação foi recebida antes de salvar

**Benefícios:**
- 🚀 Performance: API não bloqueia
- 🔒 Confiabilidade: Eventos não se perdem
- 📈 Escalabilidade: Adicione workers/servidores
- ⚡ Tempo Real: Notificações instantâneas
- 🛡️ Resiliência: Tolerante a falhas


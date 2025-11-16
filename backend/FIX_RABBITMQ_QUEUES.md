# Como Corrigir o Erro de Configuração de Filas RabbitMQ

## Erro

```
Error: Channel closed by server: 406 (PRECONDITION-FAILED) with message 
"PRECONDITION_FAILED - inequivalent arg 'x-dead-letter-exchange' for queue 'events.members' 
in vhost '/': received none but current is the value '' of type 'longstr'"
```

## Causa

As filas `events.members` e `events.invites` já existem no RabbitMQ com uma configuração diferente (sem DLQ ou com DLQ diferente) do que o código está tentando criar.

## Solução

### Opção 1: Deletar as Filas no RabbitMQ UI (Recomendado)

1. Acesse o RabbitMQ Management UI: `http://localhost:15672`
   - Usuário: `guest`
   - Senha: `guest`

2. Vá para a aba **Queues**

3. Delete as seguintes filas:
   - `events.members`
   - `events.invites`
   - `dlq.events.members` (se existir)
   - `dlq.events.invites` (se existir)

4. Reinicie os workers:
   ```bash
   npm run worker:invites
   npm run worker:members
   ```

5. As filas serão criadas automaticamente com a configuração correta (com DLQ)

### Opção 2: Deletar via CLI RabbitMQ

```bash
# Conecte ao container RabbitMQ (se usando Docker)
docker exec -it <rabbitmq-container> rabbitmqctl delete_queue events.members
docker exec -it <rabbitmq-container> rabbitmqctl delete_queue events.invites
docker exec -it <rabbitmq-container> rabbitmqctl delete_queue dlq.events.members
docker exec -it <rabbitmq-container> rabbitmqctl delete_queue dlq.events.invites
```

### Opção 3: Usar RabbitMQ Management API

```bash
# Deletar events.members
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/events.members

# Deletar events.invites
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/events.invites

# Deletar DLQs
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/dlq.events.members
curl -u guest:guest -X DELETE http://localhost:15672/api/queues/%2F/dlq.events.invites
```

## Verificação

Após deletar as filas, verifique:

1. **Workers criam as filas automaticamente:**
   - Inicie os workers
   - Verifique os logs - devem mostrar "Consuming queue=events.members" e "Consuming queue=events.invites"

2. **Verifique no RabbitMQ UI:**
   - As filas devem aparecer com a configuração correta
   - Devem ter `x-dead-letter-exchange` configurado

3. **Teste enviando um evento:**
   - Crie um convite ou remova um membro
   - Verifique se a mensagem aparece na fila
   - Verifique se o worker processa a mensagem

## Prevenção

O código foi atualizado para:
- Usar `assertEventQueue()` que garante a configuração correta (com DLQ)
- Tratar erros de configuração e tentar enviar mensagens mesmo se houver conflito
- Logar avisos quando detectar conflito de configuração

## Nota

Se você continuar tendo problemas, certifique-se de que:
- O RabbitMQ está rodando
- Os workers estão rodando
- As filas foram deletadas antes de reiniciar
- Não há outras instâncias tentando criar as filas com configuração diferente


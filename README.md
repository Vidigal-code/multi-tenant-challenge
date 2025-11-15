# Multi-Tenant Platform (SaaS Multi-Tenant)

<details>
<summary><strong>Resumo rápido</strong></summary>

- ✅ Isolamento multi-tenant por `companyId`
- ✅ JWT httpOnly + RBAC (OWNER/ADMIN/MEMBER)
- ✅ Convite com expiração, RabbitMQ e seed idempotente
- ✅ Next.js com rotas protegidas e UX responsiva
- ✅ Arquitetura DDD + Hex + CQRS + EDA pronta para escala
- ✅ Stack inteira sob Docker Compose
- ✅ Empresas públicas/privadas com descrição e logo fallback
- ✅ Notificações globais e interativas
- ✅ Sair da empresa e exclusão permanente de conta
- ✅ Sistema de amizades com validação de notificações
- ✅ Busca de usuários e gerenciamento de amizades
- ✅ Preferências de notificação configuráveis por usuário (Company Invitations, Friend Requests, Company Messages, Membership Changes, Role Changes, Popups em Tempo Real)
- ✅ Popups de notificações em tempo real (configurável) - aparecem em qualquer rota quando habilitado
- ✅ Sistema de convites simplificado (apenas Created/Received) - rejeitados ficam ocultos para receptores mas visíveis para remetentes
- ✅ Request to Join para empresas públicas com campo de contatos (envia apenas para owners/admins válidos)
- ✅ Envio global e seletivo de mensagens para amigos com throttling
- ✅ Formatação de datas corrigida (UTC → timezone local pt-BR)
- ✅ Email completo exibido no perfil (sem máscara)
- ✅ Toggle público/privado na criação e edição de empresas
- ✅ Interface completamente em português
- ✅ Modo claro/escuro (design estilo GitHub)
- ✅ Menu hambúrguer responsivo para mobile
- ✅ Página home comercial com demo SaaS
- ✅ Componente Footer reutilizável com créditos
- ✅ 100% responsivo e sincronizado com API

</details>

## Visão Geral

Aplicação fullstack pensada para escala global: NestJS orquestra o domínio com princípios de Clean Code, SOLID, DDD, arquitetura hexagonal e CQRS. Eventos de convite são publicados no RabbitMQ (EDA) e processados por um worker. O frontend Next.js App Router consome a API com sessão persistente via cookie httpOnly. Redis assume rate limiting, PostgreSQL garante consistência multi-tenant e toda a stack sobe com Docker Compose.

**Frontend moderno**: Interface completamente em português com modo claro/escuro (estilo GitHub), menu hambúrguer responsivo, página home comercial com demo SaaS, e componente Footer reutilizável. 100% responsivo e sincronizado com a API sem erros de renderização.

## Arquitetura e Padrões

- **Domain-Driven Design + Hexagonal**: camadas Domain/Application/Infrastructure/Interfaces com dependências orientadas a portas/adaptadores.
- **CQRS**: casos de uso separados para leitura e escrita (ex.: `CreateCompany`, `ListCompanies`, `SelectCompany`).
- **Event-Driven**: convites enviam eventos para RabbitMQ; worker trata fila com retry.
- **RBAC + Tenant Guard**: guards validam JWT, empresa ativa (`activeCompanyId`) e papel permitido.
- **Segurança**: JWT em cookie httpOnly, Helmet, CORS restrito, rate limiting com Redis, senhas com bcrypt.
- **Observabilidade**: filtros globais padronizam erros, logs estruturados e backoff para serviços externos.

## Decisões de Arquitetura

### Multi-tenant por companyId
Isolamento em nível de linha simples e eficiente: toda query é escopada por `companyId` e validada por guards. Facilita indexação, mantém o schema enxuto e permite evoluir para RLS no Postgres se necessário.

### DDD + Arquitetura Hexagonal
Separa domínio de infraestrutura (portas/adaptadores), reduz acoplamento e melhora testabilidade. Casos de uso não dependem de Prisma, HTTP ou filas, o que facilita manutenção e evolução tecnológica.

### CQRS (Command Query Responsibility Segregation)
Leitura e escrita caminham de forma independente, preparando o terreno para otimizações específicas (cache, read models, replicação) sem afetar transações de escrita.

### EDA com RabbitMQ (Event-Driven Architecture)
Processos assíncronos (como convites) não bloqueiam a experiência do usuário. Fila traz desacoplamento, retry e backpressure, além de observabilidade do fluxo de eventos.

### RBAC + Tenant Guard
Autorização por papéis (OWNER/ADMIN/MEMBER) e escopo de sessão por `activeCompanyId` evitam acesso indevido entre empresas e deixam regras de permissão explícitas e auditáveis.

### JWT em cookie httpOnly
Mitiga XSS e simplifica SSR/CSR. Com SameSite=Lax e CORS restrito, reduz superfícies de ataque. Expiração e rotação são fáceis de aplicar.

### Prisma + PostgreSQL
Schema tipado, migrações confiáveis e consistência transacional. Índices eficientes para consultas por usuário e `companyId`. Ferramentas maduras e ampla adoção.

### Redis para rate limiting
Protege contra abuso/brute force com latência baixíssima e escalabilidade horizontal. Mantém a API estável sob tráfego irregular.

### Next.js (App Router)
**Next.js 14 (App Router)**, **React 18**, **TypeScript**, **TailwindCSS**, **Redux Toolkit**, **React Query**, **Axios** e **Jest/Testing Library** em uma arquitetura híbrida que mescla **Clean Architecture** e **Feature-Sliced Design (FSD)** para máxima escalabilidade, previsibilidade e manutenção simples.

### Swagger (OpenAPI)
Contrato vivo da API: facilita QA, integrações e debugging. Reduz ambiguidade e acelera onboarding de terceiros.

### Seed idempotente
Permite ambiente previsível a cada subida de stack (dev/demo/CI), sem efeitos colaterais em reexecuções.

### Docker Compose
Reprodutibilidade local em um comando, com serviços isolados e paridade próxima ao ambiente de produção.

### Logs estruturados (Pino)
Logs em JSON (ou pretty no dev) para melhor correlação e análise em produção. Integra facilmente com agregadores (ELK, Loki, etc.).

### Métricas (Prometheus)
Exposição de métricas de processo e HTTP em `/metrics` para observabilidade (dashboards, alertas e SLOs) e melhoria contínua.

## Serviços Docker

| Serviço | Porta(s) | Função |
|---------|----------|--------|
| `api` | 4000 | NestJS + Prisma + Swagger (v1.4) + JWT (migrações automáticas no startup) |
| `worker-invites` | — | Consumer RabbitMQ resiliente (events.invites → notifications.realtime) |
| `worker-members` | — | Consumer RabbitMQ resiliente (events.members → notifications.realtime) |
| `web` | 3000 | Next.js App Router (SSR/CSR) |
| `db` | 5432 | PostgreSQL 16 com schema Prisma |
| `redis` | 6379 | Cache e rate limiting |
| `rabbitmq` | 5672 / 15672 | Mensageria AMQP e painel de monitoramento |

## Fluxos Principais

1. **Onboarding**: signup (`POST /auth/signup`) cria usuário, hash seguro e cookie JWT.
2. **Criação de empresa**: OWNER cria via `POST /company`, torna-se OWNER e ativa o tenant.
3. **Seleção de tenant**: `/company/:id/select` atualiza `activeCompanyId` (somente membros).
4. **Convite**: OWNER/ADMIN chama `/company/:id/invite`. Token expira em 7 dias e convites duplicados são tratados.
5. **Aceitar convite**: `/auth/accept-invite` cria ou associa usuário, gera membership e cookie.
6. **Governança**: `/company/:id/members` lista membros; delete respeita invariantes (último OWNER, ADMIN vs OWNER, limpeza de `activeCompanyId`).

## Endpoints

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/auth/signup` | Cria usuário e retorna sessão segura |
| POST | `/auth/login` | Autentica usuário existente |
| POST | `/auth/accept-invite` | Aceita convite e associa à empresa |
| POST | `/company` | Cria empresa (agora inclui description e is_public) |
| GET | `/companies` | Lista empresas do usuário (pagina) |
| POST | `/company/:id/invite` | Gera convite |
| POST | `/company/:id/select` | Define empresa ativa |
| GET | `/company/:id` | Retorna empresa ativa (lógica público/privado) |
| GET | `/company/:id/public-info` | Retorna informações públicas da empresa (sem autenticação, apenas empresas públicas) |
| GET | `/company/:id/members` | Lista membros |
| GET | `/company/:id/members/role` | Retorna o papel do usuário na empresa |
| PATCH | `/company/:id` | Atualiza empresa (nome/logo/description/is_public) — OWNER/ADMIN |
| DELETE | `/company/:id` | Exclui empresa — OWNER |
| DELETE | `/company/:id/members/:userId` | Remove membro com invariantes |
| PATCH | `/company/:id/members/:userId/role` | Altera papel de membro (OWNER/ADMIN regras) |
| POST | `/company/:id/members/:userId/leave` | Usuário sai da empresa |
| GET | `/health` | Status de serviços (postgres, rabbitmq, redis) |
| GET | `/metrics` | Métricas Prometheus (processo + HTTP) |
| GET | `/auth/profile` | Perfil do usuário autenticado (inclui preferências de notificação) |
| POST | `/auth/profile` | Atualiza nome, e-mail, senha ou preferências de notificação (requer senha atual para e-mail/senha) |
| GET | `/auth/account/primary-owner-companies` | Lista empresas onde usuário é owner principal (criador) - paginado |
| DELETE | `/auth/account` | Exclui definitivamente a conta do usuário (requer deletar empresas se for owner principal) |
| POST | `/notifications` | Cria notificação interna (ADMIN/OWNER) - envia para membros ou amigos |
| GET | `/notifications` | Lista notificações visíveis ao usuário |
| PATCH | `/notifications/:id/read` | Marca notificação como lida |
| POST | `/notifications/:id/reply` | Responde a uma notificação |
| DELETE | `/notifications/:id` | Exclui notificação |
| GET | `/invites/rejected` | Lista convites rejeitados com razão |
| GET | `/realtime/rooms` | Retorna rooms e catálogo de eventos para conexão WebSocket |
| GET | `/invites` | Lista convites recebidos (paginação) |
| GET | `/invites/{inviteCode}` | Detalhes de convite por código |
| POST | `/invites/{inviteCode}/accept` | Aceita convite por código |
| POST | `/invites/{inviteCode}/reject` | Recusa convite por código |
| GET | `/friendships` | Lista amizades do usuário (pendentes e aceitas) |
| GET | `/friendships/search` | Busca usuários por nome |
| POST | `/friendships/request` | Envia solicitação de amizade por email |
| POST | `/friendships/:id/accept` | Aceita solicitação de amizade |
| DELETE | `/friendships/:id` | Rejeita ou remove amizade |
| POST | `/auth/logout` | Encerra sessão limpa cookie |

## Frontend (Next.js – Arquitetura)

**Next.js 14 (App Router)**, **React 18**, **TypeScript**, **TailwindCSS**, **Redux Toolkit**, **React Query**, **Axios** e **Jest/Testing Library** em uma arquitetura híbrida que mescla **Clean Architecture** e **Feature-Sliced Design (FSD)** para máxima escalabilidade, previsibilidade e manutenção simples.

### Stack e Camadas
| Camada | Responsabilidade | Tecnologias |
|--------|------------------|-------------|
| Interface (UI) | Páginas e composição visual | Next.js App Router, React, TailwindCSS |
| Estado Global | Sessão, preferências, flags | Redux Toolkit |
| Estado Assíncrono | Data fetching, cache, revalidação | React Query |
| Comunicação | HTTP resiliente, auth, interceptors | Axios (instância única) |
| Observabilidade UX | Web Vitals, métricas customizadas | Beacon + API interna `/api/metrics` |
| Testes | Unit/Integration | Jest + Testing Library |

### Padrões Arquiteturais
1. **Clean Architecture**: separação clara de responsabilidades (interface / domínio / infraestrutura). Lógica de negócio e contratos independem do framework, permitindo evolução sem refactors invasivos.
2. **Feature-Sliced Design (FSD)**: organização orientada ao domínio e funcionalidade. Facilita trabalho paralelo entre squads e crescimento incremental. Estrutura base adaptada para App Router:
	 - `shared/` (ou equivalente em `lib/`, `components/`, `hooks/`): utilidades, tipos, componentes reutilizáveis.
	 - `entities/`: modelos centrais (ex.: Company, User, Membership) – podem evoluir conforme complexidade.
	 - `features/`: blocos com lógica própria (auth, invites, dashboard) – encapsulam casos de uso da interface.
	 - `widgets/`: composição de múltiplas features/entities em unidades reutilizáveis (ex.: TopBar, TenantSwitcher).
	 - `app/` (pages): coordenação final, roteamento, boundary de SSR.
3. **Single Source of Truth de HTTP**: instância Axios em `src/api/apiClient.ts`, interceta 401, aplica headers (CSRF), normaliza erros, mede latência e garante consistência de cookies (withCredentials).
4. **Redux + React Query**: complementaridade estratégica — Redux mantém estado global síncrono (auth, flags) enquanto React Query gerencia cache, concorrência, staleness, invalidação e revalidação em segundo plano para dados remotos.
5. **SSR→CSR Hydration de Autenticação**: estado inicial de sessão derivado do cookie (`layout.tsx` via `cookies()`) e injetado ao Redux no primeiro render para evitar flicker ou re-render desnecessário.
6. **Resiliência de Logout**: rota Next interna `/api/logout` limpa cookie e redireciona para `/login` mesmo sob erro 500 do backend – não bloqueia UX.
7. **Proteção de Rotas**: `middleware.ts` aplica política de acesso (auth vs público) antes da renderização, reduzindo trabalho desnecessário no cliente.
8. **Fallback e Erros**: `error.tsx` global fornece reinicialização segura; erros operacionais traduzidos em mensagens amigáveis via sistema de toasts.
9. **Skeleton Loading**: placeholders (component `Skeleton`) para respostas visuais instantâneas enquanto React Query realiza fetch, otimizando percepção de performance.
10. **Métricas UX**: Web Vitals coletadas por `reportWebVitals` e enviadas para `/api/metrics` (beacon ou POST) em produção, possibilitando dashboards de experiência real.

### Principais Funcionalidades de Frontend
- Autenticação segura com cookie httpOnly JWT + redirecionamentos inteligentes.
- Seleção de empresa (tenant) e isolamento de dados por sessão.
- Convites com feedback em tempo real e invalidação de cache após aceitar.
- Perfil do usuário (atualização, exclusão de conta, validações fortes).
- Lista paginada de empresas (React Query + paginação controlada).
- Página 404 customizada com retorno rápido e design leve.
- Logout resiliente (limpa estado local e cookie mesmo com falha de servidor).
- Página de Empresa com ações condicionais por papel:
	- OWNER: Editar, Gerenciar Membros, Excluir
	- ADMIN: Editar, Gerenciar Membros
	- MEMBER: somente leitura

### Princípios Técnicos Aplicados
| Princípio | Implementação |
|-----------|---------------|
| High Cohesion / Low Coupling | Separação clara entre UI, estado global e data fetching |
| Predictable State | Redux Toolkit com actions tipadas e slice dedicado a auth |
| Declarative Data Dependencies | Query keys compostas em `queryKeys.ts` garantem consistência |
| Fail-Fast & Resilient UX | Interceptor 401 redireciona para login; logout não depende do backend |
| Progressive Rendering | Skeletons durante `isLoading` e hidratação de auth para evitar flicker |
| Observabilidade | Latência logada por interceptors + Web Vitals enviados via beacon |
| Testabilidade | Refatorações preservam seletores/ids; instância QueryClient configurada em testes quando necessário |
| Performance | Cache + staleness (React Query), memoização seletiva de listas, efeitos controlados |
| Security by Default | httpOnly cookie, CSRF header (quando disponível), redirecionamento de rotas não autorizadas |

### Estrutura de Pastas (Simplificada)
```
frontend/
	src/
		app/                # Páginas (App Router) + error/not-found/api routes
		api/                # Instância Axios e integrações HTTP
		store/              # Redux store + slices (auth, futuros domains)
		lib/                # Config, queryKeys, erros, web-vitals
		components/         # Componentes reutilizáveis (UI + Skeleton)
		contexts/           # ToastContext
		hooks/              # useAuth, useToast
		tests/              # Testes Jest + RTL
```

### Ciclo de Dados (Exemplo: Empresas)
1. Usuário acessa `/dashboard` (SSR middleware valida cookie).
2. Query React Query (`companies`) dispara fetch usando Axios central.
3. Resposta populada em cache; erro padronizado aciona toast amigável.
4. Seleção de empresa dispara `mutation` → sucesso redireciona para `/company/[id]`.
5. Página de empresa carrega membros com query `company-members` e mostra skeleton até pronta.

### Tratamento de Erros e Sucessos
- **Backend**: Centralização de códigos via `ErrorCode` enum e `SuccessCode` enum para type safety e consistência.
  - `ApplicationError` class usa `ErrorCode` enum.
  - `SuccessMessage` class usa `SuccessCode` enum.
  - Todos os use cases retornam códigos genéricos, não mensagens localizadas.
  - **Notificações**: Backend sempre envia códigos genéricos em `title` e `body` (ex: `FRIEND_REQUEST_SENT`, `INVITE_CREATED`, `MEMBER_REMOVED`).
  - Exceção: Mensagens manuais do usuário (via `POST /notifications` ou `POST /friendships/message`) contêm texto do usuário, não códigos.
- **Frontend**: Tradução de códigos para mensagens amigáveis em `src/lib/messages.ts`.
  - `getErrorMessage(code)` e `getSuccessMessage(code)` com suporte a parâmetros.
  - Sistema de tradução para códigos de notificação (ex: `FRIEND_REQUEST_SENT` → "You received a new friend request").
  - Emojis e formatação adicionados no frontend, não no backend.
  - Separação clara de responsabilidades: backend = códigos, frontend = tradução.
- Axios normaliza casos genéricos para fallback.
- UI nunca exibe stacktrace; somente mensagens amigáveis.
- `error.tsx` fornece fallback global com botão de retry.

### Testes e Qualidade
- **Backend TDD**: Testes unitários e de integração atualizados para usar `ErrorCode` enum e `SuccessCode` enum.
  - Testes verificam `ApplicationError` instances e códigos específicos.
  - Cobertura completa de use cases: signup, invites, members, notifications, friendships.
- **Frontend TDD**: Testes de componentes e páginas usando Jest + Testing Library.
  - Mocks de HTTP e QueryClient isolados.
  - Testes de roles e permissões (OWNER/ADMIN/MEMBER).
- Todos testes anteriores continuam passando (estratégia de refatoração preservou interfaces e seletores).
- Novas dependências (React Query / Redux) integradas sem alterar a API pública dos componentes.

### Evolução Futura
- Introdução de camadas `entities/`, `features/` e `widgets/` completas conforme escopo expandir.
- Implementação de normalização de dados (ex.: Entity Adapter para coleções grandes) no Redux quando necessário.
- Observabilidade ampliada (Tracing OpenTelemetry + correl IDs entre frontend e backend).
- Edge caching (Next.js Middleware + CDN) e otimização de imagens com `next/image`.
- Feature flags para lançamentos graduais.

### Benefícios da Arquitetura
| Benefício | Resultado |
|-----------|-----------|
| Escalabilidade | Fácil adicionar novas features sem refatorar núcleo |
| Performance | Cache, revalidação e skeletons melhoram tempo de resposta percebido |
| Manutenção | Código legível, módulos coesos, responsabilidades claras |
| Testabilidade | Estado previsível e queries isoláveis em testes |
| Resiliência | Fluxo de logout e proteção de rotas não dependem de chamadas críticas |
| Observabilidade | Métricas de UX e logs de latência prontos para ingestão |

## Realtime WebSocket (/rt)

Uma camada de atualização em tempo real foi adicionada usando **Socket.IO** no namespace `/rt`.

### Eventos Disponíveis
| Evento | Payload Base | Sala (room) |
|--------|--------------|-------------|
| `company.updated` | `{ id, name?, logoUrl?, description?, isPublic? }` | `company:{companyId}` |
| `member.joined` | `{ companyId, userId, role }` | `company:{companyId}` |
| `member.left` | `{ companyId, userId }` | `company:{companyId}` |
| `notification.created` | `{ notificationId, companyId, recipientUserId? }` | `company:{companyId}` + `user:{recipientUserId}` |
| `invite.rejected` | `{ inviteId, companyId }` | `company:{companyId}` |
| `notification.read` | `{ notificationId, companyId, recipientUserId? }` | `company:{companyId}` + `user:{recipientUserId}` |

### Como Assinar no Frontend
```ts
import { subscribe, RT_EVENTS, whenReady } from '@/lib/realtime';

useEffect(() => {
	whenReady().then(() => {
		const off = subscribe(RT_EVENTS.NOTIFICATION_CREATED, (payload) => {
			queryClient.invalidateQueries(['notifications']);
		});
		return off;
	});
}, []);
```

### Estratégia de Rooms
- Usuário entra em `user:{userId}` após autenticação (handshake futuro).
- Para cada empresa ativa / listada, pode ingressar em `company:{companyId}`.

### Compatibilidade com RabbitMQ
Eventos de domínio continuam sendo publicados no RabbitMQ. Um serviço bridge (`WsDomainEventsBridgeService`) reencaminha eventos relevantes para o WebSocket sem quebrar consumidores já existentes.

### Tradução de Mensagens
- **Backend**: Centralização via `ErrorCode` enum e `SuccessCode` enum.
  - `ApplicationError` class para erros com type safety.
  - `SuccessMessage` class para sucessos (opcional, pode retornar código diretamente).
  - Todos os use cases retornam códigos genéricos, não mensagens localizadas.
  - **Notificações**: Backend sempre envia códigos genéricos em `title` e `body` (ex: `FRIEND_REQUEST_SENT`, `INVITE_CREATED`, `MEMBER_REMOVED`).
  - Exceção: Mensagens manuais do usuário contêm texto do usuário, não códigos.
- **Frontend**: Tradução de códigos para mensagens amigáveis em `src/lib/messages.ts`.
  - `getErrorMessage(code, params?)` e `getSuccessMessage(code, params?)` com suporte a parâmetros.
  - Sistema de tradução para códigos de notificação (ex: `FRIEND_REQUEST_SENT` → "You received a new friend request").
  - Emojis e formatação adicionados no frontend, não no backend.
  - Separação clara de responsabilidades: backend = códigos, frontend = tradução.
- Garante flexibilidade para i18n futuro (apenas atualizar `messages.ts`).


## Segurança e Escalabilidade Realtime
- Em produção configure `origin` CORS estrito no gateway.
- Rate limiting pode ser estendido a eventos via contadores em Redis.
- Sharding horizontal suportado pois Socket.IO rooms podem ser propagadas via adapter Redis (futuro).
- Adapter Redis opcional habilitado via `USE_WS_REDIS_ADAPTER=true` para escalar múltiplas instâncias.

### Rate Limiting de Emissão WebSocket
Implementado mecanismo de janela fixa em Redis para controlar explosões de eventos outbound. Cada chave `ws:rate:<key>:<event>`:

| Conceito | Detalhe |
|----------|---------|
| key      | `user:{userId}`, `company:{companyId}` ou `broadcast` (agregado) |
| window   | `WS_RATE_LIMIT_WINDOW_MS` (ex.: 1000 ms) |
| max      | `WS_RATE_LIMIT_MAX` (ex.: 50) |
| storage  | Redis `INCR` + `EXPIRE` (primeiro hit inicializa TTL) |
| fallback | Sem Redis → tudo permitido (graceful degradation) |
| métricas | `ws_events_emitted_total` e `ws_events_rate_limited_total` |

Fluxo:
1. Incrementa contador da combinação `(key,event)`.
2. Se excede o limite → bloqueia emissão do payload e incrementa métrica de bloqueio.
3. TTL expira chave e reinicia janela automaticamente.

Futuras melhorias possíveis:
- Sliding window exato (ZSET timestamps) para distribuição mais justa.
- Token bucket com regeneração gradual por segundo.
- Limite adicional por IP ou por origem (CORS) para mitigação de flood cross-tenant.
- Quotas diferenciadas por evento (ex.: `notification.read` pode ter limiares maiores que `company.updated`).

### Overrides por Evento & Inbound

Além do limite global (`WS_RATE_LIMIT_MAX`), cada evento pode ter override específico via variável:
```
WS_RATE_LIMIT_MAX_COMPANY_UPDATED=20
WS_RATE_LIMIT_MAX_NOTIFICATION_CREATED=100
```
Regra de transformação: nome do evento maiúsculo e `.` substituído por `_`.

Inbound (mensagens do cliente → servidor) já possui ganchos para futura expansão e aplica limites separados:
| Var | Default | Descrição |
|-----|---------|-----------|
| WS_INBOUND_RATE_LIMIT_WINDOW_MS | 1000 | Janela para eventos inbound |
| WS_INBOUND_RATE_LIMIT_MAX | 30 | Máx eventos inbound por usuário/janela |

Métrica de utilização relativa por emissão: `ws_events_rate_usage_ratio` (Summary) com percentis (p50, p90, p95, p99) para observar pressão nas janelas.

## Testes e Integridade
Suite de testes backend permanece 100% verde após introdução do realtime. Mudanças foram feitas de maneira aditiva (novos providers e arquivos) sem modificar contratos existentes.


### Fluxo de Logout (Resiliente)
1. Usuário clica “Sair” (botão client-side dispara `logout()` → atualiza Redux e chama `fetch('/api/logout', { method: 'POST' })`).
2. Rota interna tenta backend `/auth/logout` (best-effort, sem bloquear UX).
3. Cookie é limpo localmente e redireciona para `/login` sempre.
4. Redux recebe `logoutState` assegurando estado consistente imediato (menu atualiza sem recarregar).
5. Nota: Removemos `<form action="/api/logout">` para evitar o erro de produção “Failed to find Server Action 'null' / Missing 'next-action' header” em alguns ambientes.

### Segurança de Acesso
- SSR middleware analisa cookie e aplica política de redirecionamento.
- Endpoints protegidos não são renderizados em estado não autenticado.
- 401 em chamadas API → redirect imediato (interceptor) sem loops.

### Métricas de UX
- `reportWebVitals` captura FID, LCP, CLS etc.
- Envio assíncrono para `/api/metrics` (beacon) sem bloquear thread principal.
- Base para dashboards internos de qualidade de experiência.

### Contribuição (Frontend)
1. Usar `apiClient` para qualquer requisição HTTP.
2. Criar chave padronizada em `queryKeys.ts` para novas queries.
3. Adicionar testes para mutations críticas e estados de erro.
4. Evitar duplicar lógica de parsing de erro: usar `getErrorMessage`.
5. Manter nomes públicos (classes/ids) para estabilidade dos testes existentes.
6. Para novos estados globais, criar slice coeso em `store/slices/*`.

### Auditoria e Segurança Proativa
Executar periodicamente `npm audit` e avaliar correções antes de aplicar `--force`. Selecionar somente upgrades que não introduzam breaking changes em produção.

---

> A arquitetura atual entrega uma base sólida para crescimento sustentável: baixo acoplamento, alta coesão, previsibilidade de estado e rastreabilidade operacional facilitam a evolução contínua do produto sem retrabalho estrutural.

## Como Rodar (Windows PowerShell)

```powershell
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up -d --build
# Apply Prisma schema, generate client, then seed
# If this is the first run (no tables yet), run dev with a name; otherwise, deploy existing migrations
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma generate
docker compose exec api npm run seed
```

Nota docker-compose (serviço web): o Dockerfile já define `CMD ["npm","run","start"]`. A linha `command: sh -c "npm run start"` é opcional; pode ser removida para usar a configuração padrão do container. Garanta que `frontend/.env` está configurado (por exemplo, `NEXT_PUBLIC_API_URL=http://api:4000` dentro da rede Docker) para evitar chamadas a `localhost` entre contêineres.

- API: `http://localhost:4000` (Swagger em `/doc`).
- Frontend: `http://localhost:3000`.

As migrações Prisma são aplicadas automaticamente no boot da API (`migrate deploy` com fallback `migrate dev --name init`). O seed é idempotente.

## Smoke Test

1. Signup via Swagger.
2. Criar empresa (`POST /company`).
3. Listar (`GET /companies?page=1&pageSize=10`).
4. Selecionar empresa (`POST /company/:id/select`).
5. Gerar convite (`POST /company/:id/invite`) e copiar link (`inviteUrl`).
6. Abrir `http://localhost:3000/invite/{token}` para visualizar e aceitar ou recusar.
7. Conferir `/company/:id/members`.
8. Remover membro (não OWNER único) e checar `activeCompanyId` limpo.

## Variáveis de Ambiente

### Backend

| Nome | Descrição | Exemplo |
|------|-----------|---------|
| PORT | Porta HTTP | 4000 |
| NODE_ENV | Ambiente | development |
| DATABASE_URL | PostgreSQL | postgresql://postgres:postgres@db:5432/multitenant?schema=public |
| JWT_SECRET | Segredo JWT | supersecretjwt |
| JWT_EXPIRES_IN | Expiração | 7d |
| COOKIE_NAME | Cookie de sessão | mt_session |
| INVITE_TOKEN_BYTES | Entropia | 24 |
| INVITE_EXPIRES_DAYS | Validade convite | 7 |
| RATE_LIMIT_WINDOW_MS | Janela rate limit | 60000 |
| RATE_LIMIT_MAX | Limite por janela | 100 |
| BCRYPT_COST | Custo bcrypt | 10 |
| REDIS_URL | Redis | redis://redis:6379 |
| RABBITMQ_URL | RabbitMQ | amqp://guest:guest@rabbitmq:5672 |
| FRONTEND_BASE_URL | Base para geração de links | http://localhost:3000 |
| RABBITMQ_PREFETCH | Prefetch de consumidores | 50 |
| RABBITMQ_RETRY_MAX | Tentativas de retry | 5 |
| WS_NAMESPACE | Namespace WebSocket | /rt |
| WS_CORS_ORIGIN | Origem permitida CORS WS | http://localhost:3000 |
| USE_WS_REDIS_ADAPTER | Habilita adapter Redis | false |
| WS_RATE_LIMIT_WINDOW_MS | Janela fixa rate limit WS | 1000 |
| WS_RATE_LIMIT_MAX | Máx emits por janela (por chave) | 50 |

### Frontend

| Nome | Descrição | Exemplo |
|------|-----------|---------|
| NEXT_PUBLIC_API_URL | Base API | http://localhost:4000 |
| NEXT_PUBLIC_COOKIE_NAME | Cookie esperado | mt_session |
| NEXT_PUBLIC_WS_URL | Base WebSocket | http://localhost:4000 |
| NEXT_PUBLIC_DEFAULT_COMPANY_LOGO | Logo padrão fallback | /logo-fallback.png |

## Qualidade e Testes

| Área | Comando |
|------|---------|
| Backend | `npm run test` |
| Frontend | `npm run test` |
| Observabilidade | `curl http://localhost:4000/health`, `curl http://localhost:4000/metrics` |
| CI | Workflow `ci/workflow.yml` executa lint + testes |

### Testes via Docker Compose

Para rodar os testes em contêineres (sem instalar devDependencies localmente):

```powershell
# Backend tests em contêiner
docker compose run --rm --profile test api-test

# Frontend tests em contêiner
docker compose run --rm --profile test web-test
```

Os testes de backend utilizam repositórios em memória, não exigindo banco/redis. Para testes integrados com infraestrutura, acrescente dependências nos serviços de teste e execute com os serviços necessários ativos.

Testes cobrem convites, seleção de tenant, invariantes de OWNER e falhas de autenticação. Prisma migrations incluem índices para `User.activeCompanyId` e `Membership(companyId,userId)`.

## Escalabilidade e Resiliência

- Rate limiting distribuído com Redis.
- JWT leve e cookie SameSite=Lax.
- Estrutura modular apta a sharding por tenant e múltiplos workers.
- Consumers resilientes e idempotentes (prefetch, retry, DLQ, deduplicação Redis):
	- `interfaces/consumers/invites.events.consumer.ts` (INVITE_* → realtime)
	- `interfaces/consumers/members.events.consumer.ts` (USER_* → realtime)
- Filas:
	- `events.invites`: INVITE_CREATED / INVITE_ACCEPTED / INVITE_REJECTED
	- `events.members`: USER_REMOVED / USER_STATUS_UPDATED
	- `notifications.realtime`: payload bruto entregue ao gateway (SSE/WS)
	- DLQs: `dlq.events.invites` e `dlq.events.members`
- Padrão de mensagens: `{ eventId: string, ...meta }` sem texto humano (frontend traduz via `src/lib/error.ts#getEventMessage`).
 - Relação de convite inclui `inviterId` (campo opcional) e relação inversa `User.invitesSent` para auditoria futura e métricas (quem convidou quem).
- Métricas HTTP + sistema (Prometheus) expostas em `/metrics` para scraping (ex.: Prometheus/Grafana).
- Endpoint `/health` para checagens básicas de disponibilidade.

## Autenticação e Proteção de Rotas (Frontend) - Extras

Middleware (`src/middleware.ts`):
- Não autenticado ⇒ qualquer rota protegida redireciona para `/login`.
- Autenticado ⇒ acesso a `/login` ou `/signup` redireciona para `/dashboard`.
- Rotas públicas: `/invite/[token]`, `/login`, `/signup`, `/api/*`.

Logout: botão em layout dispara POST interno `/api/logout` que chama backend `/auth/logout`, expira cookie e redireciona.

404 customizada: exibida para rotas inexistentes com opções de voltar ou ir ao início.

Perfil (`/profile`):
- **Aba Profile**: Atualiza nome, e-mail e senha (e-mail/senha exigem `currentPassword`).
- **Aba Privacy Settings**: Gerencia preferências de notificação (Company Invitations, Friend Requests, Company Messages, Membership Changes, Role Changes).
- Exibe mensagens de sucesso/erro.
- Exclusão de conta via `DELETE /auth/account` (confirmação obrigatória).
- **Proteção de Owner Principal**: Se usuário é owner principal (criador) de empresas, deve deletar todas essas empresas antes de deletar a conta. O sistema exibe modal com lista paginada de empresas e opção para selecionar e deletar todas.

Convites (`/invites` + `/invite/[token]`):
- Paginação (`page`, `pageSize`).
- Página pública `/invite/[token]` exibe detalhes e permite aceitar/recusar (autenticado).
- Endpoints: `GET /invites/{inviteCode}`, `POST /invites/{inviteCode}/accept`, `POST /invites/{inviteCode}/reject`.
- Backend retorna `inviteUrl` ao criar (`POST /company/:id/invite`).
- Realtime: eventos publicados são encaminhados brutos para `notifications.realtime` e a UI traduz `eventId` via `getEventMessage`.

Exemplo `GET /invites?page=2&pageSize=10`:
```json
{
	"data": [
		{
			"id": "inv_123",
			"companyId": "comp_456",
			"email": "user@example.com",
			"role": "MEMBER",
			"status": "PENDING",
			"token": "abc123",
			"createdAt": "2025-11-12T10:00:00.000Z",
			"expiresAt": "2025-11-19T10:00:00.000Z"
		}
	],
	"total": 17,
	"page": 2,
	"pageSize": 10
}
```

Exemplo `GET /invites/{inviteCode}`:
```json
{
	"id": "inv_123",
	"companyId": "comp_456",
	"email": "user@example.com",
	"status": "PENDING",
	"role": "MEMBER",
	"createdAt": "2025-11-12T10:00:00.000Z",
	"expiresAt": "2025-11-19T10:00:00.000Z"
}
```

Exemplo atualização de perfil:
```json
{
	"email": "novo@example.com",
	"currentPassword": "SenhaAntiga123",
	"newPassword": "NovaSenha#2025"
}
```

Exemplo atualização de preferências de notificação:
```json
{
	"notificationPreferences": {
		"companyInvitations": true,
		"friendRequests": false,
		"companyMessages": true,
		"membershipChanges": true,
		"roleChanges": false
	}
}
```
Erros possíveis: `CURRENT_PASSWORD_REQUIRED`, `EMAIL_ALREADY_IN_USE`, `INVALID_CURRENT_PASSWORD`, `NO_FIELDS_TO_UPDATE`.

Exemplo exclusão de conta:

**Cenário 1: Usuário NÃO é owner principal**
```bash
DELETE /auth/account
```
Response: `{"success":true}` (cookie limpo)
- Remove usuário de todas as empresas
- Deleta todas as informações do usuário
- Remove todas as empresas criadas pelo usuário (se for único owner)

**Cenário 2: Usuário É owner principal (criador) de empresas**
```bash
# Primeiro, listar empresas onde é owner principal
GET /auth/account/primary-owner-companies?page=1&pageSize=10

# Response:
{
  "data": [
    {
      "id": "comp_123",
      "name": "My Company",
      "logoUrl": "...",
      "description": "...",
      "isPublic": true,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 10
}

# Depois, deletar conta informando IDs das empresas a deletar
DELETE /auth/account
Body: { "deleteCompanyIds": ["comp_123"] }
```
Response: `{"success":true}` (cookie limpo)
- Deleta todas as empresas especificadas
- Remove usuário de todas as outras empresas
- Deleta todas as informações do usuário

**Erros possíveis:**
- `CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES`: Usuário é owner principal e não forneceu IDs de empresas para deletar
- `CANNOT_DELETE_LAST_OWNER`: Usuário é último owner de uma empresa (não pode deletar sem transferir)
- `FORBIDDEN_ACTION`: Tentou deletar empresa que não é owner principal

Logout:
`POST /auth/logout` ⇒ `{"success":true}`.

## Membership Role Management & Events

### Regras de Permissão

| Papel Atual | Pode remover | Pode alterar papel de |
|-------------|-------------|-----------------------|
| OWNER | ADMIN, MEMBER | OWNER, ADMIN, MEMBER |
| ADMIN | MEMBER | ADMIN, MEMBER (não promove a OWNER) |
| MEMBER | — | — |

### Regras de Owner Principal (Primary Owner)

**Definição**: O owner principal é o primeiro membro OWNER criado em uma empresa (identificado pelo `createdAt` mais antigo entre todos os owners).

**Regras de Negócio**:

1. **Identificação**: O sistema identifica o owner principal verificando qual membro OWNER tem o `createdAt` mais antigo para cada empresa.

2. **Exclusão de Conta**:
   - **Se usuário NÃO é owner principal**: Pode deletar conta normalmente. O sistema remove o usuário de todas as empresas e deleta todas as informações.
   - **Se usuário É owner principal**: Deve deletar TODAS as empresas onde é owner principal antes de deletar a conta. O sistema exige que o usuário selecione e confirme a deleção de todas essas empresas.

3. **Proteção de Owner Principal**:
   - Owner principal não pode deletar conta sem deletar todas as empresas onde é criador
   - Frontend exibe modal com lista paginada de empresas onde é owner principal
   - Usuário deve selecionar todas as empresas para deletar antes de prosseguir
   - Mensagens explicativas informam o motivo da restrição

4. **Transferência de Ownership**:
   - Owner principal pode transferir ownership para outro membro
   - Após transferência, não é mais considerado owner principal (mas pode continuar como OWNER se não transferir)

5. **Deleção de Empresa**:
   - Apenas OWNER pode deletar empresa
   - Se owner principal deletar empresa, pode então deletar conta
   - Deleção de empresa remove todos os membros, convites e dados relacionados

Erros de permissão retornam:
```json
{
	"statusCode": 403,
	"code": "FORBIDDEN_ACTION",
	"message": "Você não possui permissão para remover este usuário.",
	"timestamp": "...",
	"path": "/company/{id}/members/{userId}"
}
```

### PATCH /company/{id}/members/{userId}/role
Request Body:
```json
{ "role": "ADMIN" }
```
Responses:
 - 200 `{ "success": true }`
 - 403 `FORBIDDEN_ACTION`
 - 404 `TARGET_NOT_MEMBER`

### Eventos Genéricos (RabbitMQ queue: `events`)

Sem texto natural: apenas identificadores interpretados pelo frontend.

`USER_REMOVED`:
```json
{
	"eventId": "USER_REMOVED",
	"companyId": "uuid",
	"userId": "uuid",
	"timestamp": "2025-11-12T13:00:00Z"
}
```

`USER_STATUS_UPDATED`:
```json
{
	"eventId": "USER_STATUS_UPDATED",
	"companyId": "uuid",
	"userId": "uuid",
	"oldRole": "MEMBER",
	"newRole": "ADMIN",
	"timestamp": "2025-11-12T13:00:00Z"
}
```

Frontend traduz:
 - `USER_REMOVED` ⇒ “Você foi removido da empresa.”
 - `USER_STATUS_UPDATED` ⇒ “Seu status foi atualizado.”

### curl Examples
```bash
curl -X DELETE http://localhost:4000/company/COMPANY_ID/members/USER_ID \
	-H "Cookie: mt_session=..."

curl -X PATCH http://localhost:4000/company/COMPANY_ID/members/USER_ID/role \
	-H "Content-Type: application/json" -H "Cookie: mt_session=..." \
	-d '{"role":"ADMIN"}'
```

## Testes Adicionais

Backend (jest):
 - OWNER remove ADMIN/MEMBER (sucesso)
 - ADMIN remove MEMBER (sucesso)
 - ADMIN tenta remover ADMIN/OWNER (403)
 - OWNER altera qualquer papel (sucesso)
 - ADMIN tenta promover MEMBER a OWNER (403)
 - Publicação de eventos USER_REMOVED / USER_STATUS_UPDATED (mock DomainEventsService)

Frontend (jest + RTL):
 - Botões de ação exibidos/ocultos conforme papel atual
 - Lista de membros revalida ao receber eventos (simular eventsClient.emit)
 - Mensagens traduzidas na página de convites ao receber eventos do usuário autenticado

## Swagger 

Documentação atualizada acessível em `/doc` incluindo:
- Endpoint PATCH /company/{id}/members/{userId}/role
- Schemas de eventos (descrição em texto) USER_REMOVED / USER_STATUS_UPDATED
- Respostas 403/404 padronizadas com campos `{ statusCode, code, message, timestamp, path }`
- **ErrorCode e SuccessCode**: Documentação reflete uso de enums centralizados
- **Friendships**: Endpoints de busca, solicitação, aceitação e remoção de amizades
- **Notificações**: Endpoints de leitura e resposta a notificações
- **Realtime**: Catálogo completo de eventos WebSocket incluindo eventos de amizades
- Todas as descrições e exemplos em inglês (100% English Swagger)


## Checklist do Desafio

- [x] Paginação em `/companies` (testado em `backend/src/tests/unit/list-companies.usecase.spec.ts`).
- [x] Selecionar empresa sem ser membro → 403/erro (`backend/src/tests/unit/select-company.usecase.spec.ts`).
- [x] Empresa nunca fica sem OWNER (`backend/src/tests/unit/remove-member.usecase.spec.ts`).
- [x] OWNER não pode ser removido por ADMIN (`backend/src/tests/unit/remove-member.usecase.spec.ts`).
- [x] Usuário removido tem `activeCompanyId` limpo (`backend/src/tests/unit/active-company-cleanup.usecase.spec.ts`).
- [x] Convite expira (7 dias) (`backend/src/tests/unit/accept-invite.usecase.spec.ts`).
- [x] Convite duplicado → reusa/ invalida anterior (`backend/src/tests/unit/invite-user.usecase.spec.ts`).
- [x] Docker Compose orquestra API/Web/DB/Redis/RabbitMQ/Worker.
- [x] CI com lint + test + build (`.github/workflows/ci.yml`).
- [x] Endpoint `/health` e métricas `/metrics` para monitoramento.

## Troubleshooting

- **RabbitMQ ECONNREFUSED**: aguarde retries ou verifique `docker compose logs rabbitmq`.
- **Prisma libssl mismatch**: `docker compose build api` recompila com alvo `debian-openssl-3.0.x`.
- **Seed repetido**: script usa upsert e permanece idempotente.
- **400 no signup/login**: inputs normalizados + mensagens detalhadas da API (ex.: e-mail já cadastrado).

## Tempo total investido

- Aproximadamente 32 horas distribuídas entre arquitetura, implementação, testes end-to-end, tuning de infraestrutura Docker e documentação.

## Extras

Foram adicionados recursos além do escopo original, com cobertura de testes:

- Backend
	- GET/POST `/auth/profile`: obter/atualizar perfil (senha atual obrigatória para troca de e-mail/senha)
	- POST `/auth/logout`: encerra sessão e limpa cookie
	- DELETE `/auth/account`: exclusão de conta
	- GET `/invites`: lista convites do usuário autenticado com paginação
	- Campo `notificationPreferences` (JSON) no modelo `User` para gerenciar preferências de notificação
- Frontend
	- Páginas `/profile` e `/invites`, botão "Sair" no layout, middleware protegendo rotas e redirecionando `/login`/`/signup` quando autenticado
	- Página 404 customizada
	- Aba "Privacy Settings" na página de perfil para gerenciar preferências de notificação
	- Interface intuitiva com checkboxes para cada tipo de notificação
	- Salvamento automático de preferências
- Observabilidade
	- `/health` e `/metrics` + logs estruturados

Como executar os testes:

- Backend: dentro de `backend/` execute `npm test`
- Frontend: dentro de `frontend/` execute `npm test`

Em Docker, use os serviços de profile de teste descritos acima para executar em contêineres sem instalar dependências locais.

---

## Próximos Passos

- Envio real de e-mail (SMTP) com templates.
- Observabilidade completa (Prometheus, Grafana, OpenTelemetry).
- Auditoria e trilhas por tenant.
- Feature flags e experimentation.
- Deploy em Kubernetes com auto scaling horizontal.

## Fallback de Logo de Empresa

Para garantir uma experiência consistente quando o logo de uma empresa não está definido ou falha ao carregar (erro de rede, asset removido, etc.), o frontend usa uma imagem de fallback definida pela variável de ambiente `NEXT_PUBLIC_DEFAULT_COMPANY_LOGO`.

Como funciona:
1. Se `company.logoUrl` estiver ausente ou vazio, renderiza diretamente o fallback.
2. Se houver URL, mas o evento `onError` do `<img>` for disparado, substitui para o fallback e evita loops de reload.
3. O fallback deve estar disponível no `public/` (ex.: `public/logo-fallback.png`) ou apontar para uma CDN confiável.

Configuração recomendada em `frontend/.env`:
```
NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=/logo-fallback.png
```

**Para Docker:**
A variável `NEXT_PUBLIC_DEFAULT_COMPANY_LOGO` precisa ser passada como build arg durante a construção da imagem. O `docker-compose.yml` já está configurado para ler do arquivo `.env` do frontend ou usar um valor padrão. Para personalizar, você pode:

1. Definir a variável no arquivo `frontend/.env` (recomendado)
2. Ou definir como variável de ambiente do sistema antes de executar `docker-compose build`
3. Ou criar um arquivo `docker-compose.override.yml` para sobrescrever o valor

Boas práticas:
- Prefira SVG ou PNG otimizado (<= 15KB) para carregamento rápido.
- Mantenha proporção quadrada ou utilize um container com `object-fit: contain`.
- Versione o asset se estiver em CDN (ex.: `https://cdn.example.com/v1/logo-fallback.svg`).

Exemplo de uso (pseudo):
```tsx
<img
	src={company.logoUrl || process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO}
	onError={(e) => { e.currentTarget.src = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO || '/logo-fallback.png'; }}
	alt={company.name}
	className="h-10 w-10 object-contain"
/>
```

Isso evita espaços em branco ou ícones quebrados na UI em dashboards e listagens.
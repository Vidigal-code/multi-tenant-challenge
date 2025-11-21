# Backend - Multi-Tenant Challenge

API REST desenvolvida com NestJS seguindo arquitetura hexagonal (DDD) e princípios de Clean Architecture.

## 📋 Índice

- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Módulos](#módulos)
- [Configuração](#configuração)
- [Scripts](#scripts)
- [Banco de Dados](#banco-de-dados)
- [Testes](#testes)
- [Docker](#docker)
- [API Endpoints](#api-endpoints)

## 🛠 Tecnologias

### Core
- **NestJS** (v10.4.5) - Framework Node.js
- **TypeScript** (v5.5.4) - Linguagem
- **Prisma** (v5.22.0) - ORM
- **PostgreSQL** - Banco de dados

### Autenticação & Segurança
- **Passport JWT** - Autenticação JWT
- **bcryptjs** - Hash de senhas
- **Helmet** - Segurança HTTP
- **express-rate-limit** - Rate limiting
- **cookie-parser** - Gerenciamento de cookies

### Comunicação
- **Socket.IO** - WebSockets para tempo real
- **RabbitMQ** (amqplib) - Message broker
- **Redis** (ioredis) - Cache e sessões

### Observabilidade
- **Pino** - Logging estruturado
- **Prometheus** (prom-client) - Métricas

### Documentação
- **Swagger** - Documentação da API

## 🏗 Arquitetura

O projeto segue **Arquitetura Hexagonal (Ports & Adapters)** e **Domain-Driven Design (DDD)**:

```
┌─────────────────────────────────────────────────┐
│           Interfaces (HTTP/WebSocket)           │
├─────────────────────────────────────────────────┤
│           Application (Use Cases)               │
├─────────────────────────────────────────────────┤
│           Domain (Entities, Repositories)        │
├─────────────────────────────────────────────────┤
│      Infrastructure (Prisma, Redis, RabbitMQ)   │
└─────────────────────────────────────────────────┘
```

### Camadas

1. **Domain Layer** (`src/domain/`)
   - Entidades de negócio
   - Interfaces de repositórios
   - Value Objects
   - Enums
   - Serviços de domínio

2. **Application Layer** (`src/application/`)
   - Use Cases organizados por domínio (auth, company, membership, notification, friendship, user)
   - DTOs (Data Transfer Objects)
   - Serviços de aplicação
   - Ports (interfaces)
   - Sistema de erros padronizado (ErrorCode enum)

3. **Infrastructure Layer** (`src/infrastructure/`)
   - Implementações Prisma
   - Redis
   - RabbitMQ
   - Autenticação

4. **Interfaces Layer** (`src/interfaces/`)
   - Controllers HTTP
   - WebSocket Gateway
   - Consumers (RabbitMQ)

## 📁 Estrutura do Projeto

> **Nota**: Os use cases estão organizados por domínio para melhor separação de responsabilidades e manutenibilidade do código.

```
backend/
├── prisma/
│   ├── schema.prisma          # Schema do banco de dados
│   ├── migrations/            # Migrações do Prisma
│   └── seed.ts                # Seed do banco
├── src/
│   ├── app.module.ts          # Módulo raiz
│   ├── main.ts                # Entry point
│   ├── swagger.ts             # Configuração Swagger
│   │
│   ├── domain/                # Camada de Domínio
│   │   ├── entities/         # Entidades de negócio
│   │   ├── repositories/     # Interfaces de repositórios
│   │   ├── enums/            # Enumeradores
│   │   ├── services/         # Serviços de domínio
│   │   └── value-objects/    # Value Objects
│   │
│   ├── application/           # Camada de Aplicação
│   │   ├── use-cases/        # Casos de uso organizados por domínio
│   │   │   ├── auth/        # Autenticação (login, signup)
│   │   │   ├── company/     # Empresas (create, update, delete, etc.)
│   │   │   ├── membership/  # Membros e convites
│   │   │   ├── notification/# Notificações
│   │   │   ├── friendship/  # Amizades
│   │   │   └── user/        # Usuários (search, delete-account)
│   │   ├── dto/              # Data Transfer Objects
│   │   ├── services/         # Serviços de aplicação
│   │   ├── ports/            # Ports (interfaces)
│   │   ├── errors/           # Erros de aplicação (ErrorCode enum padronizado)
│   │   └── success/          # Mensagens de sucesso
│   │
│   ├── infrastructure/       # Camada de Infraestrutura
│   │   ├── prisma/           # Implementações Prisma
│   │   ├── auth/             # Autenticação
│   │   ├── cache/            # Redis
│   │   └── messaging/        # RabbitMQ
│   │
│   ├── interfaces/           # Camada de Interfaces
│   │   ├── http/             # Controllers HTTP
│   │   ├── consumers/        # Consumers RabbitMQ
│   │   └── websocket/        # WebSocket Gateway
│   │
│   ├── modules/              # Módulos NestJS
│   │   ├── auth/             # Autenticação
│   │   ├── company/          # Empresas
│   │   ├── membership/       # Membros
│   │   ├── friendship/       # Amizades
│   │   ├── users/            # Usuários
│   │   ├── realtime/         # Tempo real
│   │   └── observability/    # Observabilidade
│   │
│   ├── common/               # Utilitários comuns
│   │   ├── decorators/       # Decorators
│   │   ├── guards/           # Guards (JWT, Roles, Tenant)
│   │   ├── filters/          # Exception filters
│   │   ├── interceptors/     # Interceptors
│   │   └── utils/            # Utilitários
│   │
│   ├── realtime/             # WebSocket
│   │   ├── events.gateway.ts
│   │   └── ws-domain-events.service.ts
│   │
│   └── tests/                # Testes
│       ├── unit/             # Testes unitários
│       ├── integration/      # Testes de integração
│       └── support/          # Suporte para testes
│
├── scripts/                  # Scripts auxiliares
├── Dockerfile                # Docker para produção
├── jest.config.ts           # Configuração Jest
├── nest-cli.json            # Configuração NestJS CLI
├── tsconfig.json            # Configuração TypeScript
└── package.json             # Dependências
```

## 📦 Módulos

### AuthModule
Gerencia autenticação e autorização:
- Signup/Login
- JWT tokens
- Perfil do usuário (email completo, preferências de notificação)
- Exclusão de conta (com proteção para primary owners)

### CompanyModule
Gerencia empresas:
- Criar/Editar/Excluir empresas
- **Toggle público/privado** na criação e edição
- Listar empresas do usuário (apenas empresas onde é membro)
- Transferir propriedade
- **Empresas públicas**: não-membros podem ver informações e solicitar ingresso
- **Empresas privadas**: não-membros recebem "Access Denied"

### MembershipModule
Gerencia membros e convites:
- **Sistema simplificado**: apenas Created/Received (rejeitados ocultos para receptores)
- Criar/Aceitar/Rejeitar convites
- Gerenciar membros
- Alterar roles
- Remover membros
- **Solicitar ingresso (Request to Join)**: envia apenas para owners/admins válidos (com validação de cargo em tempo real)

### FriendshipModule
Gerencia amizades:
- Enviar/Aceitar/Rejeitar solicitações
- Listar amigos
- Remover amizade
- Enviar mensagens

### NotificationModule
- Envio de notificações para membros (broadcast, request to join, respostas)
- Envio de notificações para amigos a partir de amizades aceitas
- **Jobs de listagem** (`POST /notifications/listing` + `GET /notifications/listing/{jobId}`) para recuperar grandes volumes de notificações em lotes paginados por cursor
- **Jobs de broadcast para amigos** (`POST /notifications/friend-broadcast-jobs`) que aceitam modo seletivo (`recipientsEmails`) ou global (todos os amigos aceitos), com acompanhamento via `GET /notifications/friend-broadcast-jobs/{jobId}`
- Exclusão em lote e marcação como lida com validações idempotentes

### UsersModule
Gerencia usuários:
- Buscar usuários
- Atualizar perfil
- Selecionar empresa ativa

### RealtimeModule
Gerencia comunicação em tempo real:
- WebSocket Gateway
- Eventos de domínio
- Notificações em tempo real

### ObservabilityModule
Gerencia observabilidade:
- Métricas Prometheus
- Logging estruturado
- Request tracking

## 🎯 Use Cases (29)

Os use cases estão organizados por domínio em `src/application/use-cases/`:

### Autenticação (`auth/`)
- `signup.usecase.ts` - Cadastro de usuário
- `login.usecase.ts` - Login

### Empresas (`company/`)
- `create-company.usecase.ts` - Criar empresa
- `update-company.usecase.ts` - Atualizar empresa
- `delete-company.usecase.ts` - Excluir empresa
- `get-company.usecase.ts` - Obter empresa
- `list-companies.usecase.ts` - Listar empresas
- `select-company.usecase.ts` - Selecionar empresa ativa
- `transfer-ownership.usecase.ts` - Transferir propriedade
- `list-primary-owner-companies.usecase.ts` - Listar empresas como owner principal

### Membros e Convites (`membership/`)
- `invite-user.usecase.ts` - Convidar usuário
- `accept-invite.usecase.ts` - Aceitar convite
- `reject-invite.usecase.ts` - Rejeitar convite
- `change-member-role.usecase.ts` - Alterar role do membro
- `remove-member.usecase.ts` - Remover membro
- `leave-company.usecase.ts` - Sair da empresa

### Amizades (`friendship/`)
- `send-friend-request.usecase.ts` - Enviar solicitação
- `accept-friend-request.usecase.ts` - Aceitar solicitação
- `reject-friend-request.usecase.ts` - Rejeitar solicitação
- `delete-friendship.usecase.ts` - Remover amizade
- `list-friendships.usecase.ts` - Listar amigos
- `send-friend-message.usecase.ts` - Enviar mensagem

### Notificações (`notification/`)
- `send-notification.usecase.ts` - Enviar notificação
- `list-notifications.usecase.ts` - Listar notificações
- `mark-notification-read.usecase.ts` - Marcar como lida
- `delete-notification.usecase.ts` - Excluir notificação
- `reply-to-notification.usecase.ts` - Responder notificação

### Usuários (`user/`)
- `search-users.usecase.ts` - Buscar usuários
- `delete-account.usecase.ts` - Exclusão de conta

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do backend:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/multitenant?schema=public"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
JWT_ALGORITHM="HS256"
JWT_PRIVATE_KEY=""
JWT_PUBLIC_KEY=""

# Worker JWT / JWE
WORKER_JWT_SECRET="worker-secret"
WORKER_JWT_ALGORITHM="HS256"
WORKER_JWT_PRIVATE_KEY=""
WORKER_JWT_PUBLIC_KEY=""
WORKER_JWT_EXPIRES_IN="7d"
WORKER_JWT_COOKIE_NAME="worker_session"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# RabbitMQ
RABBITMQ_URL="amqp://guest:guest@localhost:5672"

# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# HTTP CORS
CORS_SITES_ENABLES="http://localhost:3000,https://app.example.com"
CORS_SITES_ENABLES_ALL=false

# WebSocket CORS
WS_CORS_ORIGIN="http://localhost:3000"
WS_CORS_ORIGIN_ALL=false
```

#### Autenticação de Workers (JWT/JWE)

- Os endpoints `GET /workers/**` agora são protegidos e aceitam tokens enviados via `Authorization: Bearer <token>` ou pelo cookie `WORKER_JWT_COOKIE_NAME`.
- O backend valida **JWTs assinados** (HS/RS/ES/EdDSA conforme `WORKER_JWT_ALGORITHM`) e também **JWEs no formato compact** (5 partes). O conteúdo do JWE pode ser um JWT assinado ou um payload JSON contendo `sub`.
- Para ambientes simétricos (HS*), o mesmo `WORKER_JWT_SECRET` serve para assinar e criptografar (`alg=dir`, `enc=A256GCM`). Para chaves assimétricas (ES*, RS*, PS*), configure `WORKER_JWT_PRIVATE_KEY`/`PUBLIC_KEY`; o JWE é desencriptado com a chave privada (ex.: `alg=ECDH-ES+A256KW`).
- Exemplo rápido com `jose`:

```ts
import {EncryptJWT, SignJWT} from "jose";

async function generateWorkerTokens() {
  const secret = new TextEncoder().encode(process.env.WORKER_JWT_SECRET!);
  const claims = {sub: "ops-bot", scope: ["workers:read"]};

  const jwt = await new SignJWT(claims)
    .setProtectedHeader({alg: "HS256"})
    .setExpirationTime(process.env.WORKER_JWT_EXPIRES_IN || "7d")
    .sign(secret);

  const jwe = await new EncryptJWT({jwt})
    .setProtectedHeader({alg: "dir", enc: "A256GCM"})
    .encrypt(secret);

  return {jwt, jwe};
}

// Envie um dos tokens retornados em Authorization: Bearer <token>.
```

## 📜 Scripts

```bash
# Desenvolvimento
npm run dev              # Inicia em modo watch

# Build
npm run build            # Compila TypeScript
npm run start            # Inicia produção

# Prisma
npm run prisma:migrate   # Cria migração
npm run prisma:generate  # Gera Prisma Client
npm run seed             # Popula banco

# Testes
npm test                 # Executa testes
npm run test:watch       # Testes em watch mode

# Workers
npm run worker:invites   # Worker de convites
npm run worker:members   # Worker de membros
npm run worker:invites-list # Listagem massiva de convites
npm run worker:companies-list # Listagem massiva de empresas (owner/member)
npm run worker:invites-bulk # Exclusão/rejeição em lote de convites
npm run worker:notifications-list # Job de listagem de notificações
npm run worker:notifications-delete # Exclusão em lote de notificações
npm run worker:notifications-broadcast # Broadcast corporativo
npm run worker:notifications-friends-broadcast # Broadcast seletivo/global para amigos
npm run worker:friendships-list # Listagem em lote de amizades
npm run worker:users-search # Pré-processamento de buscas
npm run worker:users-delete # Exclusão em lote de usuários
npm run worker:generic   # Eventos genéricos (DLQ)
npm run worker:realtime  # Relay de eventos para WebSocket
```

## 🗄 Banco de Dados

### Schema Principal

- **User** - Usuários
- **Company** - Empresas
- **Membership** - Membros de empresas
- **Invite** - Convites
- **Notification** - Notificações
- **Friendship** - Amizades

### Enums

- **Role**: `OWNER`, `ADMIN`, `MEMBER`
- **InviteStatus**: `PENDING`, `ACCEPTED`, `EXPIRED`, `CANCELED`, `REJECTED`
- **FriendshipStatus**: `PENDING`, `ACCEPTED`, `BLOCKED`

### Migrações

```bash
# Criar nova migração
npm run prisma:migrate

# Aplicar migrações
npx prisma migrate deploy

# Resetar banco (desenvolvimento)
npx prisma migrate reset
```

## 🧪 Testes

### Estrutura

- **Unit Tests** (`src/tests/unit/`) - Testes unitários de use cases e controllers
- **Integration Tests** (`src/tests/integration/`) - Testes de integração de fluxos completos

### Executar

```bash
# Todos os testes
npm test

# Watch mode
npm run test:watch

# Arquivo específico
npm test -- invites.controller.spec.ts
```

### Cobertura

Os testes utilizam:
- **Jest** - Framework de testes
- **Supertest** - Testes HTTP
- **In-memory repositories** - Mocks de repositórios

## 🐳 Docker

### Dockerfile

Multi-stage build otimizado:
1. **deps** - Instala dependências
2. **builder** - Compila TypeScript e gera Prisma Client
3. **production** - Imagem final otimizada

### Build

```bash
docker build -t backend:latest .
```

### Executar

```bash
docker run -p 4000:4000 --env-file .env backend:latest
```

> No `docker-compose.yml` os workers ficam em um profile opcional (`workers`). Execute `docker compose --profile workers up worker-notifications-list` para rodá-los quando necessário sem sobrecarregar o ambiente padrão.

## 🔌 API Endpoints

### Autenticação
- `POST /auth/signup` - Cadastro
- `POST /auth/login` - Login
- `GET /auth/profile` - Perfil do usuário (com `notificationPreferences`)
- `POST /auth/profile` - Atualizar perfil e preferências de notificação
- `DELETE /auth/account` - Excluir conta (com proteção para primary owners)
- `GET /auth/account/primary-owner-companies` - Listar empresas onde usuário é owner principal

### Empresas
- `GET /companies` - Listar empresas (apenas empresas onde usuário é membro)
- `POST /company` - Criar empresa (com campo `is_public` para toggle público/privado)
- `GET /company/:id` - Obter empresa (empresa pública mostra info para não-membros, privada retorna erro)
- `GET /company/:id/public-info` - Obter informações públicas da empresa (sem autenticação, apenas para empresas públicas)
- `PATCH /company/:id` - Atualizar empresa (incluindo `is_public` para alterar status)
- `DELETE /company/:id` - Excluir empresa

### Convites
- `GET /invites/created` - Convites criados
- `GET /invites` - Convites recebidos
- `POST /invites` - Criar convite
- `POST /invites/:code/accept` - Aceitar convite
- `POST /invites/:code/reject` - Rejeitar convite
- `DELETE /invites/:id` - Excluir convite

### Membros
- `GET /memberships/:companyId` - Listar membros
- `PATCH /memberships/:id/role` - Alterar role
- `DELETE /memberships/:id` - Remover membro
- `POST /memberships/:companyId/leave` - Sair da empresa

### Amizades
- `GET /friendships` - Listar amigos
- `POST /friendships/request` - Enviar solicitação
- `POST /friendships/:id/accept` - Aceitar solicitação
- `POST /friendships/:id/reject` - Rejeitar solicitação
- `DELETE /friendships/:id` - Remover amizade

### Notificações
- `GET /notifications` - Listar notificações
- `POST /notifications` - Criar notificação (com campo `onlyOwnersAndAdmins` para Request to Join)
- `POST /notifications/:id/read` - Marcar como lida
- `DELETE /notifications/:id` - Excluir notificação
- `POST /notifications/:id/reply` - Responder notificação
- **Request to Join**: `POST /notifications` com `onlyOwnersAndAdmins: true` envia solicitação apenas para owners/admins válidos

### Usuários
- `GET /users/search` - Buscar usuários
- `PATCH /users/profile` - Atualizar perfil
- `POST /users/select-company` - Selecionar empresa ativa

### Tempo Real
- `GET /realtime/events` - Listar eventos disponíveis
- WebSocket: `/` - Conexão WebSocket

## ⚙️ Jobs Assíncronos

| Fluxo | Criação | Consulta | Worker |
|-------|---------|----------|--------|
| Listagem de notificações | `POST /notifications/listing` | `GET /notifications/listing/{jobId}` | `worker:notifications-list` |
| Broadcast para membros | `POST /notifications/broadcast-jobs` | `GET /notifications/broadcast-jobs/{jobId}` | `worker:notifications-broadcast` |
| Broadcast para amigos | `POST /notifications/friend-broadcast-jobs` | `GET /notifications/friend-broadcast-jobs/{jobId}` | `worker:notifications-friends-broadcast` |
| Exclusão em lote de notificações | `POST /notifications/deletion-jobs` | `GET /notifications/deletion-jobs/{jobId}` | `worker:notifications-delete` |

- Todos retornam `jobId`, `status (pending|processing|completed|failed)`, `processed`, `done`, `error`.
- O frontend realiza polling até `done=true`; em caso de falha, basta recriar o job (idempotente).
- Os workers registram progresso no Redis para dashboards/monitoramento.

## 🔐 Segurança

- **JWT** em cookies httpOnly
- **Helmet** para headers de segurança
- **Rate Limiting** com Redis
- **CORS** configurado
- **Validação** de inputs com class-validator
- **RBAC** (Role-Based Access Control)
- **Tenant Guard** para isolamento multi-tenant

## ⚠️ Tratamento de Erros

O projeto utiliza um sistema padronizado de códigos de erro através do enum `ErrorCode`:

- **Erros padronizados**: Todos os use cases utilizam `ErrorCode` ao invés de strings literais
- **Mapeamento HTTP**: O `AllExceptionsFilter` mapeia automaticamente códigos de erro para status HTTP apropriados
- **Códigos organizados por categoria**: Validation, Authentication, User, Company, Invitations, Members, Notifications, Friendships

Exemplo de uso:
```typescript
throw new ApplicationError(ErrorCode.NOTIFICATION_NOT_FOUND);
```

O filtro de exceções (`all-exceptions.filter.ts`) converte automaticamente para a resposta HTTP apropriada.

## 📊 Observabilidade

- **Logging** estruturado com Pino
- **Métricas** Prometheus em `/metrics`
- **Request tracking** com interceptors

## 🚀 Deploy

1. Configure variáveis de ambiente
2. Execute migrações: `npx prisma migrate deploy`
3. Gere Prisma Client: `npx prisma generate`
4. Build: `npm run build`
5. Inicie: `npm run start`

## 📝 Licença

Este projeto faz parte do desafio multi-tenant.


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
- **Swagger (OpenAPI v1.5)** - Documentação completa da API acessível em `/doc`
  - Todos os endpoints documentados com exemplos
  - Autenticação cookie-based documentada
  - Catálogo completo de eventos WebSocket
  - Error codes e success codes documentados

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
- **Worker Status Monitoring**: Endpoints protegidos por JWS ES256 para monitorar status de workers
  - `GET /workers/status` - Status de todos os workers
  - `GET /workers/:workerType/status` - Status de worker específico
  - `GET /workers/:workerType/overloaded` - Verifica se worker está sobrecarregado
  - `GET /workers/:workerType/count` - Contagem de workers ativos

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

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""

# RabbitMQ
RABBITMQ_URL="amqp://guest:guest@localhost:5672"

# Server
PORT=4000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# CORS
CORS_ORIGIN="http://localhost:3000"

# Worker Configuration
WORKER_CAPACITY_SHARING_FACTOR=256
WORKER_OVERLOAD_THRESHOLD=1000

# Worker JWT (JWS with ES256)
WORKER_JWT_ALGORITHM=ES256
WORKER_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
WORKER_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WORKER_JWT_SECRET=""  # Optional, fallback for HS256
WORKER_JWT_EXPIRES_IN=7d
WORKER_JWT_COOKIE_NAME=session
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

### CI/CD
O workflow de CI (`/.github/workflows/ci.yml`) executa apenas testes unitários para velocidade:
- `pnpm test:unit` - Executa apenas testes unitários (exclui integração)

Testes de integração devem ser executados localmente antes de fazer commit.

### Estrutura

- **Unit Tests (TDD)** (`src/tests/unit/`) - Testes unitários seguindo TDD
  - Use cases
  - Services
  - Guards
  - Controllers
  - Todos documentados com padrão EN/PT
- **Integration Tests** (`src/tests/integration/`) - Testes de integração de fluxos completos

### Executar

```bash
# Todos os testes
npm test

# Apenas testes TDD (unitários, não integrados)
npm run test:tdd

# Apenas testes unitários
npm run test:unit

# Apenas testes de integração
npm run test:integration

# Watch mode
npm run test:watch

# Arquivo específico
npm test -- invites.controller.spec.ts
```

### Padrão de Documentação TDD

Todos os testes seguem o padrão JSDoc bilingue:

```typescript
/**
 * EN -
 * Description of what the test suite covers in English.
 * 
 * PT -
 * Descrição do que a suíte de testes cobre em português.
 */
describe("ClassName", () => {
    /**
     * EN -
     * Description of individual test case in English.
     * 
     * PT -
     * Descrição do caso de teste individual em português.
     */
    it("should do something", () => {
        // Test implementation
    });
});
```

### Padrões de Teste

#### Testes Unitários (TDD)

Os testes unitários (`src/tests/unit/`) seguem TDD puro:

1. **Red**: Escrever teste que falha
2. **Green**: Implementar código mínimo para passar
3. **Refactor**: Melhorar código mantendo testes verdes

**Exemplo de estrutura**:
```typescript
describe('UpdateCompanyUseCase', () => {
  it('should update company name', async () => {
    // Arrange
    const company = createMockCompany();
    const repository = createMockRepository();
    
    // Act
    const result = await useCase.execute({ name: 'New Name' });
    
    // Assert
    expect(result.name).toBe('New Name');
    expect(repository.update).toHaveBeenCalledWith(...);
  });
});
```

#### Testes de Integração

Os testes de integração (`src/tests/integration/`) verificam fluxos completos:

- **Controllers**: Testes HTTP end-to-end com Supertest
- **Use Cases**: Integração com repositórios reais (em memória)
- **Eventos**: Verificação de publicação de eventos de domínio

**Padrões**:
- Usar repositórios em memória para isolamento
- Mockar serviços externos (ex: DomainEventsService)
- Verificar códigos de erro específicos (`ErrorCode` enum)
- Validar invariantes de domínio (ex: empresa sempre tem OWNER)

### Cobertura

Os testes utilizam:
- **Jest** - Framework de testes
- **Supertest** - Testes HTTP
- **In-memory repositories** - Mocks de repositórios
- **Mock factories** - Para criar dados de teste
- **TDD Principles** - Test-Driven Development

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

### Workers (Protegido por JWS ES256)
- `GET /workers/status` - Status de todos os workers
- `GET /workers/:workerType/status` - Status de worker específico (realtime, invites, members, generic)
- `GET /workers/:workerType/overloaded` - Verifica se worker está sobrecarregado
- `GET /workers/:workerType/count` - Contagem de workers ativos
  - Query params: `method` (pending, load, combined)

## 🔐 Segurança

- **JWT** em cookies httpOnly
- **Helmet** para headers de segurança
- **Rate Limiting** com Redis
- **CORS** configurado
- **Validação** de inputs com class-validator
- **RBAC** (Role-Based Access Control)
- **Tenant Guard** para isolamento multi-tenant
- **Worker Endpoints**: Protegidos por **JWS (JSON Web Signature) com ES256**
  - Algoritmo ES256 (ECDSA P-256 + SHA-256) para segurança assimétrica
  - Configuração separada via variáveis `WORKER_JWT_*`
  - Suporte a chaves públicas/privadas em formato PEM

## 🏗️ Arquitetura de Consumidores

O projeto utiliza uma arquitetura de consumidores RabbitMQ resiliente e escalável:

### Classes Base

- **`BaseResilientConsumer`**: Classe base abstrata para todos os consumidores
  - Retry automático com backoff exponencial
  - Dead Letter Queue (DLQ) para mensagens falhadas
  - Desduplicação usando Redis
  - Controle de prefetch para processamento paralelo
  - **Refatorado seguindo SOLID**: Métodos separados por responsabilidade única
  - **Documentação completa**: Todos os métodos documentados em inglês e português

- **`BaseDeliveryAwareConsumer`**: Estende `BaseResilientConsumer` para consumidores que aguardam confirmação de entrega
  - Confirmação de entrega via WebSocket
  - Rastreamento de entregas pendentes no Redis
  - Tratamento de timeout
  - **Documentação completa**: Todos os métodos protegidos documentados

### Consumidores Específicos

Todos os consumidores seguem princípios SOLID e estão completamente documentados:

- **`RealtimeNotificationsConsumer`**: Processa notificações em tempo real com confirmação de entrega
- **`MembersEventsConsumer`**: Encaminha eventos de membros para fila realtime
- **`InvitesEventsConsumer`**: Encaminha eventos de convites para fila realtime
- **`GenericEventsConsumer`**: Encaminha eventos genéricos (amizades, notificações) para fila realtime
- **`InviteConsumer`**: Consumer legacy para fila de convites (monitoramento)

### Padrão de Documentação

Todos os métodos seguem o padrão JSDoc:
```typescript
/**
 * EN -
 * English description of the method
 * 
 * PT -
 * Descrição em português do método
 * 
 * @param param - Parameter description
 */
```

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

## 🎯 Princípios SOLID Aplicados

O projeto segue rigorosamente os princípios SOLID, especialmente nos consumidores RabbitMQ:

- **Single Responsibility**: Cada método tem uma única responsabilidade clara
- **Open/Closed**: Classes base extensíveis sem modificação
- **Liskov Substitution**: Subclasses podem substituir classes base
- **Interface Segregation**: Interfaces específicas e focadas
- **Dependency Inversion**: Dependências injetadas via construtor

### Exemplo de Refatoração

**Antes:**
```typescript
async start() {
    // 100+ linhas de código misturando responsabilidades
}
```

**Depois:**
```typescript
async start(): Promise<void> {
    await this.initializeQueues(channel);
    await this.setupPrefetch();
    await this.beginConsumption(channel);
}

private async initializeQueues(channel: any): Promise<void> { /* ... */ }
private async setupPrefetch(): Promise<void> { /* ... */ }
private async beginConsumption(channel: any): Promise<void> { /* ... */ }
```

Cada método é pequeno, testável e documentado em inglês e português.

## 🚀 Deploy

1. Configure variáveis de ambiente
2. Execute migrações: `npx prisma migrate deploy`
3. Gere Prisma Client: `npx prisma generate`
4. Build: `npm run build`
5. Inicie: `npm run start`

## 📝 Licença

Este projeto faz parte do desafio multi-tenant.


# Frontend - Multi-Tenant Challenge

Aplicação web desenvolvida com Next.js 16 (App Router), React 19, TypeScript e TailwindCSS.

## 📋 Índice

- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Páginas](#páginas)
- [Componentes](#componentes)
- [Configuração](#configuração)
- [Scripts](#scripts)
- [Testes](#testes)
- [Docker](#docker)
- [Features](#features)

## 🛠 Tecnologias

### Core
- **Next.js** (v16.0.3) - Framework React
- **React** (v19.2.0) - Biblioteca UI
- **TypeScript** (v5.9.3) - Linguagem
- **TailwindCSS** (v3.4.17) - Estilização

### Estado e Dados
- **Redux Toolkit** (v2.10.1) - Gerenciamento de estado
- **React Query** (v5.90.9) - Cache e sincronização de dados
- **Axios** (v1.13.2) - Cliente HTTP

### Comunicação
- **Socket.IO Client** (v4.8.1) - WebSocket para tempo real
- **React Icons** (v5.5.0) - Biblioteca de ícones

### Testes
- **Jest** (v30.2.0) - Framework de testes
- **Testing Library** (v16.3.0) - Testes de componentes
- **Jest DOM** (v6.9.1) - Matchers para DOM

## 🏗 Arquitetura

O projeto segue a arquitetura do **Next.js App Router** com separação clara de responsabilidades:

```
┌─────────────────────────────────────────────────┐
│              Pages (App Router)                  │
├─────────────────────────────────────────────────┤
│           Components (UI Reutilizável)           │
├─────────────────────────────────────────────────┤
│      Services & Hooks (Lógica de Negócio)       │
├─────────────────────────────────────────────────┤
│      Store & Context (Estado Global)            │
├─────────────────────────────────────────────────┤
│      Lib (Utilitários, Config, HTTP)            │
└─────────────────────────────────────────────────┘
```

### Camadas

1. **Pages** (`src/app/`)
   - Rotas do Next.js App Router
   - Server Components e Client Components
   - Layouts e templates

2. **Components** (`src/components/`)
   - Componentes reutilizáveis
   - UI components
   - Popups e modais

3. **Services** (`src/services/`)
   - Serviços de API
   - Lógica de negócio

4. **Store** (`src/store/`)
   - Redux slices (auth, theme)
   - Estado global

5. **Lib** (`src/lib/`)
   - Utilitários
   - Configurações
   - Cliente HTTP
   - Helpers

6. **Hooks** (`src/hooks/`)
   - Custom hooks
   - Lógica reutilizável

7. **Contexts** (`src/contexts/`)
   - React Contexts
   - Providers

## 📁 Estrutura do Projeto

```
frontend/
├── public/                 # Arquivos estáticos
├── src/
│   ├── app/               # Next.js App Router
│   │   ├── layout.tsx     # Layout raiz
│   │   ├── page.tsx       # Página inicial
│   │   ├── providers.tsx  # Providers (Redux, React Query)
│   │   ├── globals.css    # Estilos globais
│   │   ├── error.tsx      # Página de erro
│   │   ├── not-found.tsx  # Página 404
│   │   │
│   │   ├── api/           # API Routes
│   │   │   ├── logout/
│   │   │   └── metrics/
│   │   │
│   │   ├── dashboard/     # Dashboard
│   │   ├── login/         # Login
│   │   ├── signup/        # Cadastro
│   │   ├── profile/       # Perfil do usuário
│   │   ├── company/       # Empresas
│   │   │   ├── [id]/      # Detalhes da empresa
│   │   │   └── new/       # Criar empresa
│   │   ├── invites/       # Convites
│   │   ├── invite/        # Aceitar convite
│   │   │   └── [token]/
│   │   ├── friends/       # Amigos
│   │   └── notifications/# Notificações
│   │
│   ├── components/        # Componentes React (organizados por categoria)
│   │   ├── companys/
│   │   │   └── CompanyList.tsx
│   │   ├── members/
│   │   │   └── MemberList.tsx
│   │   ├── invites/
│   │   │   └── InviteForm.tsx
│   │   ├── nav/
│   │   │   ├── NavAuthMenu.tsx
│   │   │   └── MobileMenu.tsx
│   │   ├── modals/
│   │   │   ├── Modal.tsx
│   │   │   └── ConfirmModal.tsx
│   │   ├── skeleton/
│   │   │   └── Skeleton.tsx
│   │   ├── notification/
│   │   │   ├── NotificationPopup.tsx
│   │   │   ├── NotificationPopupManager.tsx
│   │   │   └── NotificationPopupWrapper.tsx
│   │   ├── themes/
│   │   │   └── ThemeToggle.tsx
│   │   ├── footer/
│   │   │   └── Footer.tsx
│   │   └── ui/
│   │       └── Toast.tsx
│   │
│   ├── services/          # Serviços
│   │   ├── api.ts
│   │   ├── auth.service.ts
│   │   ├── company.service.ts
│   │   └── invite.service.ts
│   │
│   ├── store/             # Redux Store
│   │   ├── index.ts
│   │   └── slices/
│   │       ├── authSlice.ts
│   │       └── themeSlice.ts
│   │
│   ├── contexts/          # React Contexts
│   │   ├── AuthContext.tsx
│   │   └── ToastContext.tsx
│   │
│   ├── hooks/             # Custom Hooks
│   │   ├── useAuth.tsx
│   │   └── useToast.ts
│   │
│   ├── lib/               # Utilitários
│   │   ├── api.ts
│   │   ├── config.ts
│   │   ├── date-utils.ts
│   │   ├── error.ts
│   │   ├── http.ts
│   │   ├── messages.ts
│   │   ├── notification-messages.tsx
│   │   ├── queryKeys.ts
│   │   ├── realtime.ts
│   │   └── web-vitals.ts
│   │
│   ├── types/             # TypeScript Types
│   │   ├── index.ts       # Types e constantes (ex: DEFAULT_COMPANY_LOGO)
│   │   └── global.d.ts
│   │
│   ├── middleware.ts      # Next.js Middleware
│   │
│   └── tests/             # Testes (organizados por categoria)
│       ├── setup.ts
│       ├── companys/
│       │   └── company.page.roles.test.tsx
│       ├── invites/
│       │   └── invites.page.test.tsx
│       ├── profiles/
│       │   └── profile.page.test.tsx
│       ├── logouts/
│       │   └── layout.logout.test.tsx
│       ├── pages/
│       │   ├── dashboard.spec.tsx
│       │   └── not-found.test.tsx
│       ├── middlewares/
│       │   └── middleware.test.ts
│       ├── realtimes/
│       │   └── realtime.client.test.ts
│       ├── components/
│       │   ├── invites/
│       │   │   └── inviteForm.spec.tsx
│       │   └── members/
│       │       └── memberList.spec.tsx
│       └── integration/
│           ├── auths/
│           ├── companys/
│           ├── friendships/
│           ├── invites/
│           └── notifications/
│
├── Dockerfile             # Docker para produção
├── jest.config.ts         # Configuração Jest
├── tailwind.config.ts     # Configuração TailwindCSS
├── postcss.config.js      # Configuração PostCSS
├── tsconfig.json          # Configuração TypeScript
└── package.json           # Dependências
```

## 📄 Páginas

### Autenticação
- **`/`** - Página inicial comercial (home page com demo SaaS)
- **`/login`** - Login
- **`/signup`** - Cadastro

### Dashboard
- **`/dashboard`** - Dashboard principal com lista de empresas

### Perfil
- **`/profile`** - Perfil do usuário e configurações

### Empresas
- **`/company/new`** - Criar nova empresa
- **`/company/[id]`** - Detalhes da empresa, membros, convites

### Convites
- **`/invites`** - Lista de convites (criados e recebidos)
- **`/invite/[token]`** - Aceitar/rejeitar convite via link

### Amigos
- **`/friends`** - Lista de amigos e envio de mensagens

### Notificações
- **`/notifications`** - Feed de notificações

## 🧩 Componentes

Os componentes estão organizados em pastas por categoria:

### Empresas (`components/companys/`)
- **`CompanyList`** - Lista de empresas do usuário

### Membros (`components/members/`)
- **`MemberList`** - Lista de membros de uma empresa

### Convites (`components/invites/`)
- **`InviteForm`** - Formulário de convite

### Navegação (`components/nav/`)
- **`NavAuthMenu`** - Menu de navegação com autenticação (desktop + mobile)
- **`MobileMenu`** - Menu hambúrguer responsivo para mobile

### Modais (`components/modals/`)
- **`Modal`** - Modal genérico
- **`ConfirmModal`** - Modal de confirmação

### Loading (`components/skeleton/`)
- **`Skeleton`** - Loading skeleton

### Notificações (`components/notification/`)
- **`NotificationPopup`** - Popup de notificação em tempo real
- **`NotificationPopupManager`** - Gerenciador de popups
- **`NotificationPopupWrapper`** - Wrapper client-side

### Temas (`components/themes/`)
- **`ThemeToggle`** - Toggle de modo claro/escuro

### Footer (`components/footer/`)
- **`Footer`** - Footer reutilizável com créditos e links

### UI (`components/ui/`)
- **`Toast`** - Sistema de toasts/notificações

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do frontend:

```env
# API
NEXT_PUBLIC_API_URL=http://localhost:4000

# WebSocket
NEXT_PUBLIC_WS_URL=http://localhost:4000

# Cookie
NEXT_PUBLIC_SESSION_COOKIE=mt_session

# Logo padrão de empresa (ou usar constante DEFAULT_COMPANY_LOGO em src/types/index.ts)
NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png
```

### Configuração do Next.js

O projeto utiliza:
- **App Router** (Next.js 16)
- **Server Components** por padrão
- **Client Components** quando necessário (`"use client"`)
- **Middleware** para proteção de rotas (deprecated, migrar para proxy no futuro)

### Constantes Centralizadas

O projeto utiliza constantes centralizadas em `src/types/index.ts`:
- **`DEFAULT_COMPANY_LOGO`** - Logo padrão de empresa (configurável via `NEXT_PUBLIC_DEFAULT_COMPANY_LOGO`)

## 📜 Scripts

> **Nota:** O projeto pode usar `npm`, `pnpm` ou `yarn`. Os exemplos abaixo usam `npm`, mas você pode substituir por `pnpm` ou `yarn` conforme preferir.

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build
npm run build        # Build de produção
npm run start        # Inicia servidor de produção

# Testes
npm test             # Executa todos os testes
npm run test:tdd     # Apenas testes TDD (unitários, não integrados)
npm run test:unit    # Apenas testes unitários
npm run test:integration  # Apenas testes de integração
npm run test:watch   # Testes em watch mode

# Lint
npm run lint         # Executa ESLint
```

## 🧪 Testes

### CI/CD
O workflow de CI (`/.github/workflows/ci.yml`) executa apenas testes unitários para velocidade:
- `pnpm test:unit` - Executa apenas testes unitários (exclui integração)

Testes de integração devem ser executados localmente antes de fazer commit.

### Estrutura

- **Unit Tests (TDD)** (`src/tests/`) - Testes unitários seguindo TDD
  - Componentes React
  - Hooks customizados
  - Services e utilitários
  - Todos documentados com padrão EN/PT
- **Integration Tests** (`src/tests/integration/`) - Testes de fluxos completos
- **E2E Tests** - Testes end-to-end (se aplicável)

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
npm test -- invites.page.test.tsx
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
describe('ComponentName', () => {
  /**
   * EN -
   * Description of individual test case in English.
   * 
   * PT -
   * Descrição do caso de teste individual em português.
   */
  it('should do something', () => {
    // Test implementation
  });
});
```

### Padrões de Teste para Integração

#### Testes de Fluxos Completos

Os testes de integração (`src/tests/integration/`) cobrem fluxos completos de usuário:

**Company Flow** (`company-flow.test.tsx`):
- Listar empresas → Selecionar → Visualizar → Editar → Convidar membros
- Visualizar membros → Alterar papel de membro
- **Padrões aplicados**:
  - Mock de endpoints HTTP com `mockImplementation` para diferentes cenários
  - Aguardar modais fecharem antes de procurar elementos (`waitFor` com timeout)
  - Usar `fireEvent.change` com limpeza prévia para inputs controlados
  - Verificar endpoints corretos (ex: `/companys/` plural vs `/company/` singular)

**Friendship Flow** (`friendship-flow.test.tsx`):
- Buscar usuários → Enviar solicitação → Aceitar → Enviar mensagem → Remover
- **Padrões aplicados**:
  - Gerenciar cache do React Query com `queryClient.removeQueries()` e `refetchQueries()`
  - Usar flags para controlar comportamento de mocks em diferentes chamadas
  - Aguardar refetch completar antes de verificar UI (`queryState.isFetching`)
  - Lidar com múltiplos elementos usando filtros e seletores específicos

#### Boas Práticas para Testes de Integração

1. **Mock de HTTP Requests**:
   ```typescript
   httpMock.get.mockImplementation((url: string) => {
     if (url.includes('/endpoint')) {
       return Promise.resolve({ data: { ... } });
     }
     return Promise.resolve({ data: {} });
   });
   ```

2. **Gerenciamento de Cache React Query**:
   ```typescript
   // Remover cache antes de refetch
   queryClient.removeQueries({ queryKey: queryKeys.someKey() });
   await queryClient.refetchQueries({ queryKey: queryKeys.someKey() });
   
   // Aguardar refetch completar
   await waitFor(() => {
     const queryState = queryClient.getQueryState(queryKeys.someKey());
     return queryState && !queryState.isFetching;
   });
   ```

3. **Testes de Modais e Formulários**:
   ```typescript
   // Aguardar modal abrir
   await waitFor(() => {
     expect(screen.getByPlaceholderText(/placeholder/i)).toBeInTheDocument();
   });
   
   // Aguardar modal fechar após ação
   await waitFor(() => {
     expect(screen.queryByPlaceholderText(/placeholder/i)).not.toBeInTheDocument();
   });
   ```

4. **Inputs Controlados**:
   ```typescript
   // Limpar antes de definir novo valor
   fireEvent.change(input, { target: { value: '' } });
   fireEvent.change(input, { target: { value: 'New Value' } });
   
   // Aguardar atualização
   await waitFor(() => {
     expect(input.value).toBe('New Value');
   });
   ```

5. **Múltiplos Elementos**:
   ```typescript
   // Filtrar por contexto específico
   const buttons = screen.getAllByRole('button').filter(btn => {
     const parent = btn.closest('nav');
     return parent !== null; // Tab buttons
   });
   ```

### Configuração

- **Jest** com `jest-environment-jsdom`
- **Testing Library** para testes de componentes
- **Mock** de APIs e serviços
- **React Query** com QueryClient isolado por teste
- **TDD Principles** - Test-Driven Development

## 🐳 Docker

### Dockerfile

Multi-stage build otimizado:
1. **deps** - Instala dependências
2. **builder** - Build do Next.js
3. **production** - Imagem final otimizada

### Build

```bash
docker build -t frontend:latest .
```

### Executar

```bash
docker run -p 3000:3000 --env-file .env.local frontend:latest
```

### Variáveis de Ambiente no Docker

O Dockerfile suporta `NEXT_PUBLIC_DEFAULT_COMPANY_LOGO` como build argument:

```dockerfile
ARG NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
ENV NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=$NEXT_PUBLIC_DEFAULT_COMPANY_LOGO
```

## ✨ Features

### Autenticação
- Login/Logout
- Cadastro
- Proteção de rotas com middleware
- Gerenciamento de sessão com cookies

### Empresas
- Criar/Editar/Excluir empresas
- **Toggle público/privado** na criação e edição
- Listar empresas do usuário (apenas empresas onde é membro)
- Visualizar detalhes da empresa
- **Empresa pública**: não-membros veem logo, ID, descrição, quantidade de membros, owner principal, data de criação e botão "Pedir para participar"
- **Empresa privada**: não-membros veem apenas "Acesso negado, empresa privada"
- Gerenciar membros
- Enviar convites
- Solicitar ingresso (Request to Join) com campo de contatos e mensagem

### Convites
- **Sistema simplificado**: apenas duas abas (Convites Criados e Convites Recebidos)
- Listar convites criados (todos os status) e recebidos (apenas PENDING)
- Aceitar/Rejeitar convites
- Aceitar via link direto (criador vê apenas detalhes, destinatário vê botões)
- Excluir convites (apenas criador pode deletar)
- Rejeitados desaparecem da aba "Recebidos" mas permanecem visíveis em "Criados"

### Amizades
- Listar amigos
- Enviar solicitações
- Aceitar/Rejeitar solicitações
- Enviar mensagens (global ou seletivo)

### Notificações
- Feed de notificações
- Marcar como lida
- Excluir notificações
- Responder notificações
- **Popups em tempo real** (configurável nas Privacy Settings)
- **Respeito às preferências**: popups só aparecem se o tipo de notificação estiver habilitado
- **Aparecem em qualquer rota** quando habilitados
- **Redirecionam para /notifications** ao clicar
- **Links diretos para solicitações de amizade**: Notificações de amizade incluem link clicável que redireciona para `/friends/[friendshipId]`
- **Fallback inteligente**: Se `friendshipId` não estiver no meta da notificação, busca automaticamente nas solicitações pendentes

### Tempo Real
- WebSocket para atualizações em tempo real
- Eventos de empresa, membros, convites, notificações
- Auto-reconexão
- Throttling para evitar spam

### UI/UX
- Design responsivo com TailwindCSS
- **Modo claro/escuro** (design estilo GitHub) com toggle no menu
- **Menu hambúrguer responsivo** para mobile com animação
- **Página home comercial** com seções: Hero, Funcionalidades, Como Funciona, CTA
- **Componente Footer** reutilizável com créditos do desenvolvedor e links
- Loading states e skeletons
- Toasts para feedback
- Modais de confirmação
- Formatação de datas em português (pt-BR) com timezone local
- **Email completo exibido no perfil** (sem máscara)
- **Interface completamente em português** (todas as mensagens traduzidas)
- **Preferências de notificação** configuráveis (Company Invitations, Friend Requests, Company Messages, Membership Changes, Role Changes, Popups em Tempo Real)

## 🔐 Segurança

- **Middleware** para proteção de rotas
- **Cookies httpOnly** para autenticação
- **Validação** de inputs
- **Sanitização** de dados
- **CORS** configurado

## 📱 Responsividade

O projeto é totalmente responsivo usando TailwindCSS:
- Mobile-first approach
- Breakpoints padrão (sm, md, lg, xl)
- Layout adaptativo

## 🎨 Estilização

- **TailwindCSS** para estilização utilitária
- **CSS Modules** quando necessário
- **Animações** customizadas (slide-up para popups)
- **Dark mode** implementado com ThemeContext (GitHub-style)
- **Suporte a preferência do sistema** e localStorage
- **Classes dark:** aplicadas em todo o layout (bg-gray-900, text-gray-100, etc.)

## 🚀 Deploy

1. Configure variáveis de ambiente
2. Build: `npm run build`
3. Inicie: `npm run start`

### Vercel (Recomendado)

```bash
vercel --prod
```

### Docker

```bash
docker build -t frontend:latest .
docker run -p 3000:3000 frontend:latest
```

## 📝 Licença

Este projeto faz parte do desafio multi-tenant.


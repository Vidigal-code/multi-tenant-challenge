# Frontend - Multi-Tenant Challenge

Aplicação web desenvolvida com Next.js 14 (App Router), React 18, TypeScript e TailwindCSS.

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
- **Next.js** (v14.2.0) - Framework React
- **React** (v18.2.0) - Biblioteca UI
- **TypeScript** (v5.5.4) - Linguagem
- **TailwindCSS** (v3.4.10) - Estilização

### Estado e Dados
- **Redux Toolkit** (v2.10.1) - Gerenciamento de estado
- **React Query** (v5.90.7) - Cache e sincronização de dados
- **Axios** (v1.7.7) - Cliente HTTP

### Comunicação
- **Socket.IO Client** (v4.8.1) - WebSocket para tempo real
- **React Icons** (v5.3.0) - Biblioteca de ícones

### Testes
- **Jest** (v29.7.0) - Framework de testes
- **Testing Library** (v14.1.2) - Testes de componentes
- **Jest DOM** (v6.4.2) - Matchers para DOM

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
   - Redux slices
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
│   ├── components/        # Componentes React
│   │   ├── CompanyList.tsx
│   │   ├── MemberList.tsx
│   │   ├── InviteForm.tsx
│   │   ├── NavAuthMenu.tsx
│   │   ├── Modal.tsx
│   │   ├── ConfirmModal.tsx
│   │   ├── Skeleton.tsx
│   │   ├── NotificationPopup.tsx
│   │   ├── NotificationPopupManager.tsx
│   │   ├── NotificationPopupWrapper.tsx
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
│   │       └── authSlice.ts
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
│   │   ├── notification-messages.ts
│   │   ├── queryKeys.ts
│   │   ├── realtime.ts
│   │   └── web-vitals.ts
│   │
│   ├── types/             # TypeScript Types
│   │   ├── index.ts
│   │   └── global.d.ts
│   │
│   ├── middleware.ts      # Next.js Middleware
│   │
│   └── tests/             # Testes
│       ├── setup.ts
│       ├── company.page.roles.test.tsx
│       ├── invites.page.test.tsx
│       ├── profile.page.test.tsx
│       ├── layout.logout.test.tsx
│       ├── not-found.test.tsx
│       ├── middleware.test.ts
│       ├── realtime.client.test.ts
│       ├── components/
│       └── pages/
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

### Componentes Principais

- **`CompanyList`** - Lista de empresas do usuário
- **`MemberList`** - Lista de membros de uma empresa
- **`InviteForm`** - Formulário de convite
- **`NavAuthMenu`** - Menu de navegação com autenticação (desktop + mobile)
- **`MobileMenu`** - Menu hambúrguer responsivo para mobile
- **`ThemeToggle`** - Toggle de modo claro/escuro
- **`Footer`** - Footer reutilizável com créditos e links
- **`Modal`** - Modal genérico
- **`ConfirmModal`** - Modal de confirmação
- **`Skeleton`** - Loading skeleton
- **`NotificationPopup`** - Popup de notificação em tempo real
- **`NotificationPopupManager`** - Gerenciador de popups
- **`NotificationPopupWrapper`** - Wrapper client-side

### UI Components

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

# Logo padrão de empresa
NEXT_PUBLIC_DEFAULT_COMPANY_LOGO=https://example.com/default-company.png
```

### Configuração do Next.js

O projeto utiliza:
- **App Router** (Next.js 14)
- **Server Components** por padrão
- **Client Components** quando necessário (`"use client"`)
- **Middleware** para proteção de rotas

## 📜 Scripts

```bash
# Desenvolvimento
npm run dev          # Inicia servidor de desenvolvimento

# Build
npm run build        # Build de produção
npm run start        # Inicia servidor de produção

# Testes
npm test             # Executa testes
npm run test:watch   # Testes em watch mode

# Lint
npm run lint         # Executa ESLint
```

## 🧪 Testes

### Estrutura

- **Unit Tests** - Testes de componentes e hooks
- **Integration Tests** - Testes de fluxos completos
- **E2E Tests** - Testes end-to-end (se aplicável)

### Executar

```bash
# Todos os testes
npm test

# Watch mode
npm run test:watch

# Arquivo específico
npm test -- invites.page.test.tsx
```

### Configuração

- **Jest** com `jest-environment-jsdom`
- **Testing Library** para testes de componentes
- **Mock** de APIs e serviços

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


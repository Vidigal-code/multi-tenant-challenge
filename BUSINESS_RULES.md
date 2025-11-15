# Regras de Negócio do Sistema Multi-Tenant

Este documento descreve todas as regras de negócio implementadas no sistema.

---

## 1. REGRAS DE USUÁRIO E AUTENTICAÇÃO

### 1.1. Regra de Auto-Ação (Self-Action Prevention)
**REGRA CRÍTICA**: Um usuário **NUNCA** pode realizar ações sobre si mesmo.

- ❌ Não pode enviar convite para si mesmo (`CANNOT_INVITE_SELF`)
- ❌ Não pode enviar solicitação de amizade para si mesmo (`CANNOT_ADD_YOURSELF`)
- ❌ Não pode remover a si mesmo de uma empresa
- ❌ Não pode alterar o próprio papel/role (`FORBIDDEN_ACTION`)
- ❌ Não pode enviar notificação para si mesmo (`CANNOT_SEND_TO_SELF`)
- ❌ Não pode reportar a si mesmo
- ❌ Não pode receber notificação de si mesmo

### 1.2. Autenticação
- JWT armazenado em cookie httpOnly
- Sessão expira conforme configuração
- Logout limpa cookie e redireciona

### 1.3. Perfil do Usuário
- Atualização de nome: livre
- Atualização de email: requer `currentPassword`
- Atualização de senha: requer `currentPassword` e `newPassword`
- **Email exibido completo (sem máscara) no campo "Email atual"**
- Validação: email único no sistema (`EMAIL_ALREADY_IN_USE`)
- Interface completamente em português

### 1.4. Preferências de Notificação
- Usuário pode gerenciar preferências de notificação na aba "Configurações de Privacidade" do perfil
- Preferências armazenadas como JSON no campo `notificationPreferences` do modelo `User`
- Tipos de notificação configuráveis:
  - `companyInvitations`: Notificações quando convidado para empresa (padrão: `true`)
  - `friendRequests`: Notificações de solicitações de amizade (padrão: `true`)
  - `companyMessages`: Notificações de mensagens na empresa (padrão: `true`)
  - `membershipChanges`: Notificações de mudanças de membros (padrão: `true`)
  - `roleChanges`: Notificações de mudanças de papel (padrão: `true`)
  - `realtimePopups`: Exibir popups quando novas notificações chegarem em tempo real (padrão: `true`)
- Atualização via `POST /auth/profile` com campo `notificationPreferences`
- Salvamento automático ao alterar qualquer preferência no frontend
- Valores padrão: todas as notificações habilitadas (`true`) quando não especificado
- **Popups em tempo real**: quando `realtimePopups` está ativado, popups aparecem em qualquer rota do sistema assim que uma notificação é recebida via WebSocket
- **Respeito às preferências**: popups só aparecem se o tipo de notificação estiver habilitado nas preferências do usuário

---

## 2. REGRAS DE EMPRESAS (COMPANIES)

### 2.1. Tipos de Empresa (Privacy Types)

#### Empresa Pública (`isPublic: true`)
- ✅ Visível para todos os usuários
- ✅ Descrição truncada (400 caracteres) para não-membros
- ✅ Botão "Request to Join" visível para não-membros
- ✅ Qualquer usuário pode solicitar entrada (join request)
- ✅ Membros veem descrição completa com toggle "Read more/Show less"

#### Empresa Privada (`isPublic: false`)
- ❌ Não visível para não-membros
- ❌ Mensagem "Access Denied" para não-membros
- ❌ Não permite join requests
- ✅ Apenas membros podem ver detalhes completos
- ✅ Apenas convites permitem entrada

### 2.2. Criação de Empresa
- Qualquer usuário autenticado pode criar empresa
- Criador automaticamente se torna **OWNER** (primeiro owner = owner principal)
- Empresa criada define `activeCompanyId` do criador
- Campos obrigatórios: `name`
- Campos opcionais: `logoUrl`, `description`, `isPublic` (default: `false`)
- **Toggle público/privado**: usuário pode escolher se empresa é pública ou privada durante a criação

### 2.3. Edição de Empresa
- **OWNER** e **ADMIN** podem editar
- **MEMBER** não pode editar
- Campos editáveis: `name`, `logoUrl`, `description`, `isPublic`
- **Toggle público/privado**: pode ser alterado durante a edição, refletindo imediatamente no comportamento de acesso
- Validação: pelo menos um campo deve ser alterado (`NO_FIELDS_TO_UPDATE`)

### 2.4. Exclusão de Empresa
- **Apenas OWNER** pode deletar empresa
- Deleção remove:
  - Todos os membros (cascade)
  - Todos os convites
  - Todas as notificações relacionadas
  - Limpa `activeCompanyId` de todos os usuários que tinham esta empresa ativa
- Não há confirmação de múltiplos owners (regra simplificada)

### 2.5. Visualização de Empresa
- **Empresa Pública + Não-membro**: 
  - Vê logo, ID, descrição completa, quantidade de membros, owner principal, data de criação
  - Botão "Pedir para participar" disponível
  - Modal de solicitação com campos "Contatos" (emails separados por vírgula) e "Mensagem"
  - Se contatos vazio: envia para todos owners e admins
  - Se contatos preenchido: valida cargo de cada email e envia apenas para owners/admins válidos no momento da solicitação
- **Empresa Privada + Não-membro**: 
  - Vê apenas mensagem "Acesso negado, empresa privada."
  - Nenhuma informação adicional é exibida (sem logo, descrição, membros, etc.)
- **Membro**: vê todos os detalhes completos

### 2.6. Logo de Empresa
- Se `logoUrl` não existe ou falha ao carregar: usa `NEXT_PUBLIC_DEFAULT_COMPANY_LOGO`
- Fallback configurável via variável de ambiente

---

## 3. REGRAS DE MEMBROS (MEMBERSHIPS)

### 3.1. Roles e Hierarquia

```
OWNER (Maior privilégio)
  ↓
ADMIN
  ↓
MEMBER (Menor privilégio)
```

### 3.2. Permissões por Role

#### OWNER
- ✅ Criar empresa
- ✅ Editar empresa
- ✅ Deletar empresa
- ✅ Convidar membros (qualquer role)
- ✅ Remover membros (ADMIN, MEMBER, mas não outros OWNER se for último)
- ✅ Alterar papel de qualquer membro (exceto próprio)
- ✅ Enviar mensagens globais/notificações
- ✅ Transferir ownership
- ❌ Não pode remover a si mesmo
- ❌ Não pode alterar próprio papel
- ❌ Não pode sair da empresa sem transferir ownership

#### ADMIN
- ✅ Editar empresa
- ✅ Convidar membros (MEMBER, ADMIN, mas não OWNER)
- ✅ Remover membros (apenas MEMBER)
- ✅ Enviar mensagens globais/notificações
- ❌ Não pode deletar empresa
- ❌ Não pode remover OWNER
- ❌ Não pode alterar papel de ninguém
- ❌ Não pode promover ninguém a OWNER
- ❌ Não pode remover a si mesmo
- ✅ Pode sair da empresa

#### MEMBER
- ✅ Ver informações da empresa
- ✅ Sair da empresa
- ❌ Não pode editar empresa
- ❌ Não pode convidar membros
- ❌ Não pode remover membros
- ❌ Não pode alterar papéis
- ❌ Não pode enviar mensagens globais

### 3.3. Regras de Remoção de Membro

| Requester | Target | Pode Remover? |
|-----------|--------|---------------|
| OWNER | OWNER | ❌ Não (exceto se houver outros owners) |
| OWNER | ADMIN | ✅ Sim |
| OWNER | MEMBER | ✅ Sim |
| ADMIN | OWNER | ❌ Não |
| ADMIN | ADMIN | ❌ Não |
| ADMIN | MEMBER | ✅ Sim |
| MEMBER | Qualquer | ❌ Não |
| Qualquer | Si mesmo | ❌ Não |

**Proteção Especial**: Último OWNER não pode ser removido (`LAST_OWNER_CANNOT_BE_REMOVED`)

### 3.4. Regras de Alteração de Papel

| Requester | Target | Novo Role | Pode Alterar? |
|-----------|--------|-----------|---------------|
| OWNER | OWNER | ADMIN/MEMBER | ✅ Sim (se houver outros owners) |
| OWNER | ADMIN | OWNER/ADMIN/MEMBER | ✅ Sim |
| OWNER | MEMBER | OWNER/ADMIN/MEMBER | ✅ Sim |
| OWNER | Si mesmo | Qualquer | ❌ Não |
| ADMIN | Qualquer | Qualquer | ❌ Não |
| MEMBER | Qualquer | Qualquer | ❌ Não |

**Regras Especiais**:
- Apenas OWNER pode promover para OWNER (`ONLY_OWNER_CAN_INVITE_OWNER`)
- ADMIN não pode modificar OWNER (`CANNOT_MODIFY_OWNER`)
- Não pode alterar para o mesmo papel (retorna `unchanged: true`)

### 3.5. Sair da Empresa (Leave Company)
- **OWNER**: Não pode sair sem transferir ownership (`OWNER_MUST_TRANSFER_BEFORE_LEAVE`)
- **ADMIN/MEMBER**: Pode sair livremente
- Ao sair: remove membership e limpa `activeCompanyId` se era a empresa ativa
- Notifica OWNER e ADMIN quando membro sai

### 3.6. Transferência de Ownership
- Apenas OWNER pode transferir
- Não pode transferir para si mesmo (`CANNOT_TRANSFER_TO_SELF`)
- Novo owner deve ser membro da empresa (`NEW_OWNER_NOT_MEMBER`)
- Após transferência: antigo owner vira ADMIN, novo owner vira OWNER
- Owner principal pode transferir, mas continua sendo owner principal até deletar empresa

---

## 4. REGRAS DE CONVITES (INVITES)

### 4.1. Criação de Convite

**Quem pode convidar**:
- OWNER: pode convidar qualquer role (OWNER, ADMIN, MEMBER)
- ADMIN: pode convidar ADMIN e MEMBER (não pode convidar OWNER)
- MEMBER: não pode convidar

**Validações**:
- ❌ Não pode convidar a si mesmo (`CANNOT_INVITE_SELF`)
- ❌ Não pode convidar membro existente (`CANNOT_INVITE_MEMBER`)
- ❌ Não pode criar múltiplos convites ativos para mesmo email+empresa (`INVITE_ALREADY_EXISTS`)
- ✅ Email deve existir no sistema (se `requireExistingUser: true`)
- ✅ Token único gerado automaticamente
- ✅ Expiração padrão: 7 dias (configurável)

### 4.2. Status de Convite

- **PENDING**: Convite criado, aguardando resposta
- **ACCEPTED**: Convite aceito, usuário se torna membro
- **REJECTED**: Convite rejeitado pelo destinatário
- **EXPIRED**: Convite expirado (passou `expiresAt`)
- **CANCELED**: Convite cancelado pelo remetente

### 4.3. Aceitar Convite

- Usuário deve estar autenticado
- Convite deve estar PENDING
- Convite não pode estar expirado (`INVITE_EXPIRED`)
- Convite não pode ter sido usado (`INVITE_ALREADY_USED`)
- Ao aceitar: cria membership com role especificado no convite
- Notifica remetente do convite

### 4.4. Rejeitar Convite

- Usuário deve estar autenticado
- Convite deve estar PENDING (`INVITE_NOT_PENDING`)
- **Apenas o destinatário pode rejeitar** (não o remetente)
- Ao rejeitar: marca como REJECTED
- **Notifica remetente original** com detalhes:
  - Quem rejeitou (nome, email)
  - Empresa
  - Timestamp
- **Convite rejeitado desaparece imediatamente** da aba "Convites Recebidos" do destinatário
- **Convite rejeitado permanece visível** na aba "Convites Criados" do remetente (com status REJECTED)

### 4.5. Listagem de Convites

- **Duas abas apenas**: "Convites Criados" e "Convites Recebidos"
- **Convites Criados**: Usuário vê apenas convites que ele enviou (todos os status)
- **Convites Recebidos**: Usuário vê apenas convites PENDING que recebeu (rejeitados desaparecem automaticamente)
- Paginação: `page`, `pageSize` (default: 10)
- Detalhes exibidos: empresa, role, status, data envio, data expiração, ID, nome, descrição, link do convite

### 4.6. Exclusão de Convite

- **Apenas o criador do convite pode deletá-lo**
- Destinatário **NÃO pode deletar**, apenas rejeitar
- Permite seleção múltipla e "Limpar todos" na aba "Convites Criados"
- Confirmação obrigatória para exclusão

### 4.7. Fluxo de Convite por Link (`/invite/:token`)

- **Se o criador abre o link**: vê apenas detalhes do convite, sem botões de aceitar/rejeitar
- **Se o destinatário abre o link**: vê botões para aceitar/rejeitar (se PENDING e não expirado)
- **Ao aceitar via link**:
  - Backend cria membership automaticamente (se não existir)
  - Atualiza `activeCompanyId` do usuário (se não estiver definido)
  - Marca convite como ACCEPTED
  - Notifica remetente
  - Usuário pode acessar a empresa sem mensagem "Access denied"
- **Ao rejeitar via link**:
  - Confirmação obrigatória
  - Marca convite como REJECTED
  - Convite desaparece da aba "Convites Recebidos"
  - Notifica remetente

---

## 5. REGRAS DE NOTIFICAÇÕES

### 5.1. Envio de Notificações Globais

**Quem pode enviar**:
- OWNER e ADMIN apenas (quando membro da empresa)
- MEMBER não pode enviar
- **Usuários não-membros podem enviar** quando `onlyOwnersAndAdmins: true` (Request to Join)

**Destinatários**:
- Se campo `contacts` vazio: envia para **todos os membros** da empresa (exceto remetente)
  - Se `onlyOwnersAndAdmins: true`: envia apenas para OWNERs e ADMINs
- Se campo `contacts` preenchido: envia apenas para emails especificados (separados por vírgula)
  - Exemplo: `kauan@gmail.com, rodrigo@gmail.com`
  - Validação: usuário deve existir E ser membro OU amigo do remetente
  - Se `onlyOwnersAndAdmins: true`: valida que destinatário é OWNER ou ADMIN
  - Se não for membro nem amigo: falha para aquele email (`USER_MUST_BE_MEMBER_OR_FRIEND`)

**Validações**:
- ❌ Não pode enviar para si mesmo (`CANNOT_SEND_TO_SELF`)
- ✅ Deve ser membro da empresa (exceto Request to Join)
- ✅ Destinatário deve ser membro OU amigo (exceto Request to Join)

**Resposta**:
- Retorna `validationResults` com status por email (sent/failed)
- Código genérico: `NOTIFICATION_SENT` ou `NOTIFICATION_SENT_TO_ALL_MEMBERS`
- Frontend traduz códigos para mensagens amigáveis

### 5.2. Estrutura de Notificação

- `id`: Identificador único
- `title`: **Código genérico** (ex: `FRIEND_REQUEST_SENT`, `INVITE_CREATED`, `MEMBER_REMOVED`) - **NUNCA mensagens localizadas**
- `body`: **Código genérico** ou conteúdo do usuário (para mensagens manuais)
- `senderUserId`: ID do remetente
- `recipientUserId`: ID do destinatário
- `companyId`: ID da empresa
- `read`: Boolean (lida/não lida)
- `createdAt`: Timestamp
- `meta`: Metadados (tipo, canal, informações do remetente, dados contextuais)

**Regra Crítica**: Backend **SEMPRE** envia códigos genéricos em `title` e `body` (exceto quando o conteúdo vem do usuário). Frontend traduz esses códigos para mensagens amigáveis e localizadas.

### 5.3. Visualização de Notificações

- **Sempre exibe**: nome do remetente, email do remetente, data/hora formatada
- **Informações adicionais**: Company ID (quando disponível), Channel (company/friend)
- **Badge visual**: "New" para não lidas, "Reply" para respostas
- **Suporte a truncamento**: mensagens longas (400 chars) com "Read more/Show less"
- **Layout organizado**: informações do remetente em card destacado
- **Paginação e filtros**: suporte completo

### 5.4. Ações em Notificações

- **Marcar como lida**: `PATCH /notifications/:id/read`
- **Responder**: `POST /notifications/:id/reply`
  - Modal de resposta mostra: Subject, From (nome), Email, Date & Time, Company ID, mensagem original
  - Indica claramente para quem a resposta será enviada (nome e email)
  - Apenas remetente original vê respostas
  - Resposta cria nova notificação para remetente original com informações do sender (nome, email) no `meta`
  - Backend inclui informações do sender automaticamente nas respostas
- **Deletar**: `DELETE /notifications/:id`
- **Deletar múltiplas**: seleção com checkboxes
- **Clear All**: deletar todas com confirmação

### 5.5. Informações do Sender em Notificações

- **Backend**: Inclui informações do sender no `meta.sender` ao criar notificações
  - `id`: ID do usuário remetente
  - `name`: Nome do remetente
  - `email`: Email do remetente
- **Listagem**: Backend inclui dados do sender via Prisma `include` quando lista notificações
- **Respostas**: Backend busca informações do replier e inclui no `meta.sender` da resposta
- **Frontend**: Exibe todas as informações do sender de forma organizada e destacada

### 5.6. Códigos Genéricos de Notificação

**Backend sempre envia códigos genéricos** em `title` e `body` (exceto mensagens manuais do usuário):

| Código | Evento | Descrição |
|--------|--------|-----------|
| `FRIEND_REQUEST_SENT` | Solicitação de amizade enviada | Frontend traduz para "You received a new friend request" |
| `FRIEND_REQUEST_ACCEPTED` | Solicitação aceita | Frontend traduz para "Your friend request was accepted" |
| `FRIEND_REQUEST_REJECTED` | Solicitação rejeitada | Frontend traduz para "Your friend request was rejected" |
| `FRIEND_REMOVED` | Amizade removida | Frontend traduz para "You were removed from a friend's list" |
| `INVITE_CREATED` | Convite criado | Frontend traduz para "You received an invitation to join a company" |
| `INVITE_ACCEPTED` | Convite aceito | Frontend traduz para "Your invitation was accepted" |
| `INVITE_REJECTED` | Convite rejeitado | Frontend traduz com detalhes do remetente e empresa |
| `MEMBER_ADDED` | Membro adicionado | Frontend traduz para "You were added to a company" |
| `MEMBER_REMOVED` | Membro removido | Frontend traduz para "You were removed from a company" |
| `ROLE_CHANGED` | Papel alterado | Frontend traduz para "Your role in a company was changed" |
| `COMPANY_CREATED` | Empresa criada | Frontend traduz para "Company created successfully" |
| `NOTIFICATION_REPLY` | Resposta a notificação | Frontend traduz e exibe mensagem original do `meta.originalTitle` |

**Mensagens Manuais**: Quando usuário envia mensagem via `POST /notifications` ou `POST /friendships/message`, o `body` contém o texto do usuário (não é código genérico). O `title` também vem do usuário.

**Frontend**: Sistema de tradução em `src/lib/messages.ts` converte códigos para mensagens amigáveis com suporte a parâmetros e formatação.

---

## 6. REGRAS DE AMIZADES (FRIENDSHIPS)

### 6.1. Solicitação de Amizade

**Validações**:
- ❌ Não pode enviar para si mesmo (`CANNOT_ADD_YOURSELF`)
- ❌ Não pode enviar se já são amigos (`ALREADY_FRIENDS`)
- ❌ Não pode enviar se já existe solicitação pendente (`FRIEND_REQUEST_ALREADY_SENT`)
- ❌ Não pode enviar se usuário está bloqueado (`USER_BLOCKED`)
- ✅ Usuário destinatário deve existir no sistema

**Busca de Usuários**:
- Endpoint: `GET /friendships/search?q=query`
- Busca por nome ou email
- Não retorna o próprio usuário na busca
- Não permite auto-solicitação

### 6.2. Status de Amizade

- **PENDING**: Solicitação enviada, aguardando resposta
- **ACCEPTED**: Amizade aceita, usuários são amigos
- **REJECTED**: Solicitação rejeitada
- **BLOCKED**: Usuário bloqueado

### 6.3. Aceitar Solicitação

- Apenas destinatário (`addressee`) pode aceitar
- Não pode aceitar solicitação de outros (`CANNOT_ACCEPT_OTHERS_REQUEST`)
- Solicitação deve estar PENDING (`FRIENDSHIP_NOT_PENDING`)
- Ao aceitar: status muda para ACCEPTED
- Notifica ambos os usuários

### 6.4. Rejeitar/Remover Amizade

- Pode rejeitar solicitação pendente
- Pode remover amizade aceita
- Qualquer parte da amizade pode deletar (requester ou addressee)
- Usa endpoint `DELETE /friendships/:id` que funciona para qualquer status
- Notifica usuários relevantes

### 6.5. Listagem de Amizades

- **Friends**: Lista amizades com status ACCEPTED
- **Pending Requests**: Lista solicitações PENDING onde usuário é `addressee` (recebidas)
- Filtra automaticamente: não mostra solicitações enviadas pelo próprio usuário
- Exibe: nome, email, status, data criação

### 6.6. Integração com Notificações

- Amigos podem receber notificações globais mesmo não sendo membros da empresa
- Validação: `USER_MUST_BE_MEMBER_OR_FRIEND`

---

## 7. REGRAS DE OWNER PRINCIPAL (PRIMARY OWNER)

### 7.1. Definição

**Owner Principal** = Primeiro membro OWNER criado em uma empresa (identificado pelo `createdAt` mais antigo entre todos os owners).

### 7.2. Identificação

- Sistema verifica todos os membros OWNER de uma empresa
- Ordena por `createdAt` (mais antigo primeiro)
- Primeiro da lista = Owner Principal

### 7.3. Proteção na Exclusão de Conta

**Se usuário NÃO é owner principal**:
- ✅ Pode deletar conta normalmente
- Remove de todas as empresas
- Deleta todas as informações

**Se usuário É owner principal**:
- ❌ **NÃO pode deletar conta** sem deletar todas as empresas onde é owner principal
- ✅ Deve selecionar e confirmar deleção de **TODAS** as empresas
- Frontend exibe modal com:
  - Lista paginada de empresas (10 por página)
  - Checkboxes para seleção
  - Botão "Select all" (busca todas as páginas automaticamente)
  - Contador: "Selected X of Y companies"
  - Mensagem explicativa sobre o processo
- Validação: todos os IDs fornecidos devem ser empresas onde é owner principal
- Se sobrar alguma empresa não selecionada: erro (`CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES`)

### 7.4. Transferência de Ownership

- Owner principal pode transferir ownership
- Após transferência: não é mais owner principal (novo owner vira owner principal)
- Mas continua sendo OWNER se não transferir completamente

### 7.5. Deleção de Empresa

- Owner principal pode deletar empresas normalmente
- Após deletar todas as empresas onde é owner principal: pode deletar conta

### 7.6. Endpoint de Listagem

- `GET /auth/account/primary-owner-companies?page=1&pageSize=10`
- Retorna lista paginada de empresas onde usuário é owner principal
- Inclui: id, name, logoUrl, description, isPublic, createdAt

---

## 8. REGRAS DE EXCLUSÃO DE CONTA

### 8.1. Fluxo Normal (Não Owner Principal)

1. Usuário clica "Delete permanently"
2. Confirmação modal
3. `DELETE /auth/account` (sem body)
4. Sistema:
   - Remove de todas as empresas (se não for último owner)
   - Deleta todas as informações do usuário
   - Limpa cookie de sessão
   - Redireciona para `/`

### 8.2. Fluxo Owner Principal

1. Usuário clica "Delete permanently"
2. Sistema verifica: `GET /auth/account/primary-owner-companies`
3. Se `total > 0`:
   - Abre modal com lista de empresas
   - Usuário deve selecionar TODAS
   - Clica "Delete X companies and Account"
   - Confirmação final
   - `DELETE /auth/account` com body: `{ deleteCompanyIds: [...] }`
4. Sistema:
   - Valida que todos os IDs são empresas onde é owner principal
   - Deleta empresas especificadas
   - Remove de outras empresas (se não for último owner)
   - Deleta todas as informações do usuário
   - Limpa cookie
   - Redireciona para `/`

### 8.3. Validações

- ❌ Se owner principal e não forneceu `deleteCompanyIds`: `CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES`
- ❌ Se tentou deletar empresa que não é owner principal: `FORBIDDEN_ACTION`
- ❌ Se é último owner de alguma empresa: `CANNOT_DELETE_LAST_OWNER`
- ✅ Remove de empresas onde não é owner principal normalmente

### 8.4. Limpeza de Dados

Ao deletar conta, remove:
- Usuário
- Todas as memberships
- Todas as empresas criadas (se owner principal)
- Todas as notificações enviadas/recebidas
- Todas as amizades
- Todas as solicitações de amizade
- Todas as notificações relacionadas

---

## 9. REGRAS DE PERMISSÕES POR AÇÃO

### 9.1. Matriz de Permissões

| Ação | OWNER | ADMIN | MEMBER |
|------|-------|-------|--------|
| Criar empresa | ✅ | ✅ | ✅ |
| Editar empresa | ✅ | ✅ | ❌ |
| Deletar empresa | ✅ | ❌ | ❌ |
| Convidar membro | ✅ | ✅ | ❌ |
| Remover membro | ✅ | ✅ | ❌ |
| Alterar papel | ✅ | ❌ | ❌ |
| Enviar notificação | ✅ | ✅ | ❌ |
| Sair da empresa | ❌ | ✅ | ✅ |
| Transferir ownership | ✅ | ❌ | ❌ |

ADMIN não pode convidar OWNER  
OWNER não pode remover outros OWNER se for último  
ADMIN só pode remover MEMBER  
OWNER não pode alterar próprio papel  
OWNER deve transferir ownership antes de sair

### 9.2. Regras de Auto-Ação

**NUNCA permitido**:
- Remover a si mesmo
- Alterar próprio papel
- Enviar convite para si mesmo
- Enviar solicitação de amizade para si mesmo
- Enviar notificação para si mesmo

---

## 10. REGRAS DE VALIDAÇÃO E SEGURANÇA

### 10.1. Validação de Email

- Email normalizado: `trim().toLowerCase()`
- Email único no sistema
- Validação de formato (se aplicável)

### 10.2. Validação de Senha

- Hash seguro (bcrypt)
- Senha atual obrigatória para trocar email/senha
- Validação: `INVALID_CURRENT_PASSWORD` se senha incorreta

### 10.3. Validação de Token

- Token de convite único e não reutilizável
- Token expira após período configurado (default: 7 dias)
- Validação: `INVITE_EXPIRED` se expirado

### 10.4. Validação de Membership

- Usuário deve ser membro para acessar empresa privada
- Validação: `NOT_A_MEMBER` se não for membro
- Validação: `INSUFFICIENT_ROLE` se role insuficiente

### 10.5. Proteção de Dados

- Isolamento multi-tenant por `companyId`
- Guards validam JWT, membership e role
- Cookies httpOnly, SameSite=Lax
- CORS restrito

### 10.6. Validação de Duplicatas

- Não permite múltiplos convites ativos para mesmo email+empresa
- Não permite múltiplas solicitações de amizade pendentes
- Não permite criar amizade se já são amigos

---

## 11. REGRAS DE INTERFACE (FRONTEND)

### 11.1. Exibição de Informações

**Empresa Pública (Não-membro)**:
- Nome, logo, descrição truncada (400 chars)
- Botão "Request to Join"

**Empresa Privada (Não-membro)**:
- "Access Denied - You are not a member of this company"

**Membro**:
- Todos os detalhes completos
- Descrição com toggle "Read more/Show less" se > 400 chars

### 11.2. Botões e Ações

**Company Page**:
- OWNER/ADMIN: botões de editar, deletar, gerenciar membros
- MEMBER: apenas visualização
- **Nunca exibe botões de auto-ação** (remover a si mesmo, editar a si mesmo)

**Member List** (em `/company/[id]`):
- **OWNER/ADMIN**: vê nome, email, User ID, role, data de entrada (joinedAt)
- **MEMBER**: vê apenas nome e role (sem email, sem User ID, sem data de entrada)
- OWNER: pode remover ADMIN/MEMBER, alterar papel de qualquer um (exceto próprio)
- ADMIN: pode remover apenas MEMBER, não pode alterar papéis
- **Nunca exibe ações para si mesmo**
- **Primary Owner**: exibe ícone de coroa (👑) ao lado do nome

### 11.3. Modais de Confirmação

**Sempre requer confirmação**:
- Deletar empresa
- Remover membro
- Deletar convite(s)
- Deletar notificação(s)
- Deletar conta
- Sair da empresa

### 11.4. Mensagens de Feedback

- ✅ Verde: sucesso
- ❌ Vermelho: erro
- ℹ️ Azul: informação
- Códigos genéricos do backend traduzidos no frontend
- Emojis adicionados no frontend (não no backend)

### 11.5. Atualizações em Tempo Real

- WebSocket para eventos:
  - `company.updated`
  - `member.joined`
  - `member.left`
  - `notification.created`
  - `notification.read`
  - `invite.rejected`
  - `friend.request.sent`
  - `friend.request.accepted`
  - `friend.request.rejected`
- Invalidação automática de queries React Query
- UI atualiza automaticamente após ações

---

## 12. REGRAS DE EVENTOS E NOTIFICAÇÕES

### 12.1. Eventos de Domínio

**RabbitMQ**:
- `invite.created`
- `invite.accepted`
- `invite.rejected`
- `membership.removed`
- `membership.role.updated`
- `company.deleted`
- `account.deleted`
- `friend.request.sent`
- `friend.request.accepted`
- `friend.request.rejected`

**WebSocket**:
- Eventos acima são bridgeados para WebSocket
- Frontend traduz `eventId` para mensagens amigáveis

### 12.2. Notificações Automáticas

**Quando membro é removido**:
- Notifica OWNER e ADMIN da empresa

**Quando membro sai**:
- Notifica OWNER e ADMIN da empresa

**Quando convite é rejeitado**:
- Notifica remetente original com detalhes completos

**Quando amizade é aceita**:
- Notifica ambos os usuários

**Quando amizade é rejeitada**:
- Notifica remetente

---

## 13. REGRAS DE PAGINAÇÃO E PERFORMANCE

### 13.1. Paginação

- Default: `pageSize: 10`
- Máximo: `pageSize: 50` (ou conforme configuração)
- Endpoints paginados:
  - `/companies`
  - `/invites`
  - `/invites/rejected`
  - `/auth/account/primary-owner-companies`
  - `/notifications`

### 13.2. Cache e Revalidação

- React Query com `staleTime` configurável
- Invalidação automática após mutações
- Skeleton loading durante fetches

---

## 14. REGRAS DE CÓDIGOS DE ERRO E SUCESSO

### 14.1. Backend

- **ErrorCode enum**: Códigos genéricos centralizados
- **SuccessCode enum**: Códigos de sucesso centralizados
- **ApplicationError class**: Erros tipados com código
- **Nunca retorna mensagens localizadas** (apenas códigos)

### 14.2. Frontend

- **messages.ts**: Tradução de códigos para mensagens amigáveis
- **Suporte a parâmetros**: `getSuccessMessage('NOTIFICATION_SENT_TO_ALL_MEMBERS', { count: 5 })`
- **Emojis**: Adicionados no frontend, não no backend
- **Separação de responsabilidades**: Backend = códigos, Frontend = tradução

---

## 15. REGRAS ESPECIAIS E CASOS DE BORDA

### 15.1. Último Owner

- Empresa **NUNCA** pode ficar sem OWNER
- Último OWNER não pode ser removido (`LAST_OWNER_CANNOT_BE_REMOVED`)
- Último OWNER não pode ser rebaixado (`LAST_OWNER_CANNOT_BE_REMOVED`)
- Último OWNER não pode sair sem transferir (`OWNER_MUST_TRANSFER_BEFORE_LEAVE`)

### 15.2. Active Company

- Usuário pode ter `activeCompanyId` (empresa ativa na sessão)
- Ao ser removido: `activeCompanyId` é limpo
- Ao sair: `activeCompanyId` é limpo se era a empresa ativa
- Ao deletar empresa: `activeCompanyId` é limpo para todos os membros

### 15.3. Convites Expirados

- Convite expira após `expiresAt`
- Não pode aceitar convite expirado (`INVITE_EXPIRED`)
- Sistema pode marcar automaticamente como EXPIRED

### 15.4. Duplicatas

- Não permite múltiplos convites ativos para mesmo email+empresa
- Não permite múltiplas solicitações de amizade pendentes
- Sistema reutiliza convite existente se possível

---

## RESUMO DAS REGRAS CRÍTICAS

1. ✅ **Nunca permitir auto-ação** (ações sobre si mesmo)
2. ✅ **Empresa nunca fica sem OWNER**
3. ✅ **Owner principal deve deletar empresas antes de deletar conta**
4. ✅ **OWNER não pode sair sem transferir ownership**
5. ✅ **ADMIN não pode modificar OWNER**
6. ✅ **Apenas OWNER pode promover para OWNER**
7. ✅ **Empresa privada: acesso negado para não-membros**
8. ✅ **Notificações: apenas para membros ou amigos**
9. ✅ **Convites: não pode convidar a si mesmo ou membro existente**
10. ✅ **Amizades: não pode adicionar a si mesmo**

---


### Notificações com Informações do Sender (Implementado)
- ✅ Backend inclui informações do sender (nome, email, id) no `meta.sender` ao criar notificações
- ✅ Backend lista notificações com dados do sender via Prisma `include`
- ✅ Respostas incluem informações do replier no `meta.sender`
- ✅ Frontend exibe nome, email, data/hora formatada de forma destacada
- ✅ Modal de resposta mostra todas as informações do remetente original
- ✅ Badge visual "Reply" para identificar respostas

### Visualização de Membros por Role (Implementado)
- ✅ OWNER/ADMIN: veem nome, email, User ID, role, data de entrada
- ✅ MEMBER: veem apenas nome e role
- ✅ Primary Owner identificado com ícone de coroa (👑)
- ✅ Implementado em `/company/[id]` via componente `MemberList`

### Preferências de Notificação (Implementado)
- ✅ Campo `notificationPreferences` (JSON) adicionado ao modelo `User`
- ✅ Migration criada para adicionar campo no banco de dados
- ✅ Aba "Privacy Settings" na página de perfil (`/profile`)
- ✅ Interface com checkboxes para cada tipo de notificação
- ✅ Salvamento automático ao alterar preferências
- ✅ Backend valida e salva preferências via `UpdateProfileDto`
- ✅ Preferências retornadas no endpoint `GET /auth/profile`
- ✅ Sistema de notificações pode consultar preferências antes de enviar

### Popups de Notificações em Tempo Real (Implementado)
- ✅ Opção `realtimePopups` em `notificationPreferences` (padrão: `true`)
- ✅ Componente `NotificationPopupManager` gerencia exibição de popups
- ✅ Popup aparece para todas as novas notificações quando ativado
- ✅ Popup exibe: título, descrição, tipo, timestamp formatado, remetente, empresa
- ✅ Auto-fecha após 10 segundos
- ✅ Clique no popup redireciona para `/notifications`
- ✅ Backend emite eventos `notification.created` com `notificationId` em todos os métodos
- ✅ WebSocket confiável com reconexão automática e tratamento de duplicatas

### Sistema de Convites Simplificado (Implementado)
- ✅ Removida funcionalidade "Rejected Invitations" (tabela `InviteRejection` removida)
- ✅ Apenas duas abas: "Convites Criados" e "Convites Recebidos"
- ✅ "Convites Criados": mostra todos os convites enviados (todos os status)
- ✅ "Convites Recebidos": mostra apenas convites PENDING (rejeitados desaparecem automaticamente)
- ✅ Apenas criador pode deletar convites
- ✅ Destinatário pode apenas rejeitar (não deletar)
- ✅ Rejeição remove convite imediatamente da aba "Recebidos"
- ✅ Fluxo de convite por link corrigido (criador vs destinatário)
- ✅ Aceitar via link cria membership e atualiza `activeCompanyId` automaticamente

### Request to Join (Solicitação de Ingresso) (Implementado)
- ✅ Disponível apenas para empresas públicas
- ✅ Exibe informações da empresa para não-membros: logo, ID, descrição, número de membros, criador principal
- ✅ Modal com campo de mensagem e campo "contacts" (emails separados por vírgula)
- ✅ Se `contacts` vazio: envia para todos os OWNERs e ADMINs
- ✅ Se `contacts` preenchido: envia apenas para OWNERs/ADMINs correspondentes
- ✅ Validação: apenas OWNERs e ADMINs ativos recebem (MEMBERs não recebem)
- ✅ Backend usa `onlyOwnersAndAdmins: true` no `SendNotificationUseCase`

### Envio Global e Seletivo de Mensagens para Amigos (Implementado)
- ✅ Aba "Enviar Mensagem" com dois modos: Seletivo e Global
- ✅ Modo Seletivo: seleção manual de amigos via checkboxes
- ✅ Modo Global: envia para todos os amigos na lista
- ✅ Modo ativo claramente indicado na interface
- ✅ Throttling de 100ms entre envios para evitar sobrecarga
- ✅ Feedback detalhado: quantos enviados, quantos falharam

### Formatação de Datas Corrigida (Implementado)
- ✅ Backend sempre retorna timestamps válidos em UTC
- ✅ Frontend formata datas usando timezone local do usuário
- ✅ Função `formatDate` e `formatDateOnly` em `src/lib/date-utils.ts`
- ✅ Aplicado em: convites, notificações, listagens, popups
- ✅ Formato legível: "DD/MM/YYYY, HH:MM" (pt-BR)

### Exibição de Empresas Corrigida (Implementado)
- ✅ Dashboard mostra apenas empresas das quais o usuário é membro
- ✅ Acesso direto a `/company/:id` para não-membros:
  - Empresa privada: mensagem "Acesso Negado: você não tem permissão"
  - Empresa pública: exibe logo, ID, descrição, número de membros, criador principal, botão "Request to Join"
- ✅ `ListCompaniesUseCase` retorna apenas empresas do usuário (não inclui empresas públicas)


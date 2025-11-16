type SuccessCode =
  | 'NOTIFICATION_SENT'
  | 'NOTIFICATION_SENT_TO_ALL_MEMBERS'
  | 'FRIEND_REQUEST_SENT'
  | 'INVITATION_ACCEPTED'
  | 'INVITE_CREATED'
  | 'INVITE_ACCEPTED'
  | 'USER_STATUS_UPDATED'
  | 'COMPANY_CREATED'
  | 'COMPANY_UPDATED'
  | 'COMPANY_DELETED'
  | 'MEMBER_ADDED'
  | 'MEMBER_REMOVED'
  | 'ROLE_UPDATED'
  | 'ACCOUNT_DELETED'
  | 'PROFILE_UPDATED';

type ErrorCode =
  | 'NO_FIELDS_TO_UPDATE'
  | 'CURRENT_PASSWORD_REQUIRED'
  | 'USER_NOT_FOUND'
  | 'INVALID_CURRENT_PASSWORD'
  | 'EMAIL_ALREADY_IN_USE'
  | 'EMAIL_ALREADY_USED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_EMAIL'
  | 'OWNER_NOT_FOUND'
  | 'NOT_A_MEMBER'
  | 'INSUFFICIENT_ROLE'
  | 'ONLY_OWNER_CAN_INVITE_OWNER'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_ALREADY_USED'
  | 'INVITE_EXPIRED'
  | 'MISSING_USER_DATA'
  | 'REQUESTER_NOT_MEMBER'
  | 'TARGET_NOT_MEMBER'
  | 'CANNOT_REMOVE_OWNER'
  | 'LAST_OWNER_CANNOT_BE_REMOVED'
  | 'FORBIDDEN_ACTION'
  | 'CANNOT_MODIFY_OWNER'
  | 'CANNOT_ASSIGN_OWNER'
  | 'USER_NOT_AUTHENTICATED'
  | 'NO_ACTIVE_COMPANY'
  | 'NO_MEMBERSHIP_FOUND'
  | 'COMPANY_NOT_FOUND'
  | 'NO_COMPANY_MEMBERS_AVAILABLE'
  | 'CANNOT_SEND_TO_SELF'
  | 'USER_MUST_BE_MEMBER_OR_FRIEND'
  | 'CANNOT_ADD_YOURSELF'
  | 'ALREADY_FRIENDS'
  | 'FRIEND_REQUEST_ALREADY_SENT'
  | 'USER_BLOCKED'
  | 'INVITATION_REJECTED'
  | 'INVITE_REJECTED'
  | 'INVITE_REJECTED_BY_USER'
  | 'USER_REMOVED_FROM_COMPANY'
  | 'INVITE_ALREADY_EXISTS'
  | 'CANNOT_INVITE_SELF'
  | 'CANNOT_INVITE_MEMBER'
  | 'INVITE_NOT_PENDING'
  | 'CANNOT_JOIN_OWN_COMPANY'
  | 'JOIN_REQUEST_NOT_ALLOWED'
  | 'JOIN_REQUEST_ALREADY_EXISTS'
  | 'JOIN_REQUEST_NOT_FOUND'
  | 'CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES'
  | 'CANNOT_DELETE_LAST_OWNER';

const successMessages: Record<SuccessCode, string> = {
  NOTIFICATION_SENT: 'Mensagem enviada',
  NOTIFICATION_SENT_TO_ALL_MEMBERS: 'Mensagem enviada para {count} membro(s)',
  FRIEND_REQUEST_SENT: 'Solicitação de amizade enviada',
  INVITATION_ACCEPTED: 'Convite aceito!',
  INVITE_CREATED: 'Convite enviado com sucesso.',
  INVITE_ACCEPTED: 'O convite foi aceito.',
  USER_STATUS_UPDATED: 'Seu status foi atualizado.',
  COMPANY_CREATED: 'Empresa criada com sucesso.',
  COMPANY_UPDATED: 'Empresa atualizada com sucesso.',
  COMPANY_DELETED: 'Empresa excluída com sucesso.',
  MEMBER_ADDED: 'Membro adicionado com sucesso.',
  MEMBER_REMOVED: 'Membro removido com sucesso.',
  ROLE_UPDATED: 'Cargo atualizado com sucesso.',
  ACCOUNT_DELETED: 'Conta excluída com sucesso.',
  PROFILE_UPDATED: 'Perfil atualizado com sucesso.',
};

const errorMessages: Record<ErrorCode, string> = {
  NO_FIELDS_TO_UPDATE: 'Nenhuma alteração detectada — nenhum campo foi atualizado.',
  CURRENT_PASSWORD_REQUIRED: 'A senha atual é necessária para continuar.',
  USER_NOT_FOUND: 'Usuário não encontrado',
  INVALID_CURRENT_PASSWORD: 'A senha atual está incorreta.',
  EMAIL_ALREADY_IN_USE: 'O email fornecido já está em uso.',
  EMAIL_ALREADY_USED: 'O email fornecido já está em uso.',
  INVALID_CREDENTIALS: 'Credenciais inválidas.',
  INVALID_EMAIL: 'Endereço de email inválido.',
  OWNER_NOT_FOUND: 'Proprietário não encontrado.',
  NOT_A_MEMBER: 'Acesso negado: você não é membro desta empresa.',
  INSUFFICIENT_ROLE: 'Você não tem permissão para realizar esta ação.',
  ONLY_OWNER_CAN_INVITE_OWNER: 'Apenas o proprietário pode convidar outro proprietário.',
  INVITE_NOT_FOUND: 'Convite não encontrado.',
  INVITE_ALREADY_USED: 'Convite já utilizado.',
  INVITE_EXPIRED: 'Convite expirado.',
  MISSING_USER_DATA: 'Dados do usuário obrigatórios estão faltando.',
  REQUESTER_NOT_MEMBER: 'O solicitante não é membro da empresa.',
  TARGET_NOT_MEMBER: 'Membro alvo não encontrado.',
  CANNOT_REMOVE_OWNER: 'Você não pode remover o proprietário.',
  LAST_OWNER_CANNOT_BE_REMOVED: 'O último proprietário não pode ser removido.',
  FORBIDDEN_ACTION: 'Você não tem permissão para realizar esta ação.',
  CANNOT_MODIFY_OWNER: 'Você não pode modificar o proprietário.',
  CANNOT_ASSIGN_OWNER: 'Você não pode atribuir o cargo de proprietário.',
  USER_NOT_AUTHENTICATED: 'Usuário não autenticado.',
  NO_ACTIVE_COMPANY: 'Nenhuma empresa ativa selecionada.',
  NO_MEMBERSHIP_FOUND: 'Membresia não encontrada.',
  COMPANY_NOT_FOUND: 'Empresa não encontrada.',
  NO_COMPANY_MEMBERS_AVAILABLE: 'Nenhum membro da empresa disponível para receber a mensagem',
  CANNOT_SEND_TO_SELF: 'Não é possível enviar mensagens para si mesmo',
  USER_MUST_BE_MEMBER_OR_FRIEND: 'O usuário deve ser membro da empresa ou amigo',
  CANNOT_ADD_YOURSELF: 'Você não pode enviar uma solicitação de amizade para si mesmo.',
  ALREADY_FRIENDS: 'Você já é amigo deste usuário.',
  FRIEND_REQUEST_ALREADY_SENT: 'Solicitação de amizade já enviada.',
  USER_BLOCKED: 'Este usuário está bloqueado.',
  INVITATION_REJECTED: 'Convite Rejeitado',
  INVITE_REJECTED: 'O convite foi rejeitado.',
  INVITE_REJECTED_BY_USER: 'O convite foi rejeitado por {name} ({email}).',
  USER_REMOVED_FROM_COMPANY: 'Você foi removido da empresa.',
  INVITE_ALREADY_EXISTS: 'Já existe um convite ativo para este usuário e empresa.',
  CANNOT_INVITE_SELF: 'Você não pode enviar um convite para si mesmo.',
  CANNOT_INVITE_MEMBER: 'Este usuário já é membro da empresa.',
  INVITE_NOT_PENDING: 'Este convite não está com status pendente.',
  CANNOT_JOIN_OWN_COMPANY: 'Você não pode solicitar para entrar na sua própria empresa.',
  JOIN_REQUEST_NOT_ALLOWED: 'Solicitações de entrada não são permitidas para empresas privadas.',
  JOIN_REQUEST_ALREADY_EXISTS: 'Você já tem uma solicitação de entrada pendente para esta empresa.',
  JOIN_REQUEST_NOT_FOUND: 'Solicitação de entrada não encontrada.',
  CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES: 'Você não pode excluir sua conta porque é o proprietário principal (criador) de uma ou mais empresas. Por favor, exclua todas as empresas onde você é o proprietário principal primeiro.',
  CANNOT_DELETE_LAST_OWNER: 'Você não pode excluir sua conta porque é o último proprietário de uma ou mais empresas. Por favor, transfira a propriedade ou exclua as empresas primeiro.',
};


export function getSuccessMessage(code: string, params?: Record<string, any>): string {
  const message = successMessages[code as SuccessCode];
  if (!message) return code;
  if (params) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
  return message;
}


export function getErrorMessage(code: string, params?: Record<string, any>): string {
  const message = errorMessages[code as ErrorCode];
  if (!message) return code;
  if (params) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
  return message;
}


export function getMessage(code: string, params?: Record<string, any>): string {
  const successMsg = successMessages[code as SuccessCode];
  if (successMsg) {
    if (params) {
      return successMsg.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
      });
    }
    return successMsg;
  }
  
  const errorMsg = errorMessages[code as ErrorCode];
  if (errorMsg) {
    if (params) {
      return errorMsg.replace(/\{(\w+)\}/g, (match, key) => {
        return params[key] !== undefined ? String(params[key]) : match;
      });
    }
    return errorMsg;
  }
  
  return code;
}


export function isSuccessCode(code: string): boolean {
  return code in successMessages;
}


export function isErrorCode(code: string): boolean {
  return code in errorMessages;
}

export type { SuccessCode, ErrorCode };

const notificationCodeMessages: Record<string, string> = {
  FRIEND_REQUEST_SENT: 'Você recebeu uma nova solicitação de amizade',
  FRIEND_REQUEST_ACCEPTED: 'Sua solicitação de amizade foi aceita',
  FRIEND_REQUEST_REJECTED: 'Sua solicitação de amizade foi rejeitada',
  FRIEND_REMOVED: 'Você foi removido da lista de amigos',
  INVITE_CREATED: 'Você recebeu um convite para entrar em uma empresa',
  INVITE_ACCEPTED: 'Seu convite foi aceito',
  INVITE_REJECTED: 'Seu convite foi rejeitado',
  MEMBER_ADDED: 'Você foi adicionado a uma empresa',
  MEMBER_REMOVED: 'Você foi removido de uma empresa',
  ROLE_CHANGED: 'Seu cargo em uma empresa foi alterado',
  COMPANY_CREATED: 'Empresa criada com sucesso',
  NOTIFICATION_REPLY: 'Você recebeu uma resposta à sua notificação',
};

export function getNotificationCodeMessage(code: string, params?: Record<string, any>): string {
  const message = notificationCodeMessages[code];
  if (!message) return code;
  if (params) {
    return message.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }
  return message;
}

export function isNotificationCode(code: string): boolean {
  return code in notificationCodeMessages;
}

const channelTranslations: Record<string, string> = {
  'friend': 'Amigo',
  'company': 'Empresa',
};


export function translateChannel(channel: string | undefined | null): string {
  if (!channel) return '';
  
  const normalizedChannel = channel.toLowerCase().trim();
  return channelTranslations[normalizedChannel] || channel;
}

export interface NotificationMessageParams {
  senderName?: string;
  senderEmail?: string;
  companyName?: string;
  inviteUrl?: string;
  inviteId?: string;
  inviteEmail?: string;
  rejectedByName?: string;
  rejectedByEmail?: string;
  removedByName?: string;
  removedByEmail?: string;
  role?: string;
  previousRole?: string;
  body?: string;
  title?: string;
  originalTitle?: string;
}

const notificationMessageTemplates: Record<string, string> = {
  // Friend notifications
  'friend.request.sent.withSender': '{senderName} ({senderEmail}) enviou uma solicitação de amizade',
  'friend.request.sent.withoutSender': 'Nova solicitação de amizade enviada para você',
  'friend.request.accepted.withSender': '{senderName} ({senderEmail}) aceitou sua solicitação de amizade',
  'friend.request.accepted.withoutSender': 'Sua solicitação de amizade foi aceita',
  'friend.request.rejected.withSender': '{senderName} ({senderEmail}) rejeitou sua solicitação de amizade',
  'friend.request.rejected.withoutSender': 'Sua solicitação de amizade foi rejeitada',
  'friend.removed.withSender': '{senderName} ({senderEmail}) removeu você da lista de amigos',
  'friend.removed.withoutSender': 'Você foi removido da lista de amigos',

  // Invite notifications
  'invite.created.withSender': '{senderName} ({senderEmail}) convidou você para participar {companyName}',
  'invite.created.withoutSender': 'Você recebeu um convite para {companyName}',
  'invite.created.withSenderAndUrl': 'Convite enviado para você por {senderName} ({senderEmail}) para {companyName}. Link: {inviteUrl}',
  'invite.accepted.withSender': '{senderName} ({senderEmail}) aceitou seu convite para {companyName}',
  'invite.accepted.withoutSender': 'Seu convite foi aceito',
  'invite.rejected.withSender': '{senderName} ({senderEmail}) rejeitou seu convite para {companyName}',
  'invite.rejected.withoutSender': 'Seu convite foi rejeitado',
  'invite.rejected.detailed': 'Seu convite para {inviteEmail} para {companyName} foi rejeitado por {rejectedByName} ({rejectedByEmail})',

  // Member notifications
  'member.added.withSender': 'Você foi adicionado a {companyName} por {senderName} ({senderEmail})',
  'member.added.withoutSender': 'Você foi adicionado a {companyName}',
  'member.removed.withSender': 'Você foi removido de {companyName} por {removedByName} ({removedByEmail})',
  'member.removed.withoutSender': 'Você foi removido de {companyName}',

  // Role notifications
  'role.changed.withSender': 'Seu papel em {companyName} foi alterado de {previousRole} para {role} por {senderName} ({senderEmail})',
  'role.changed.withoutSender': 'Seu papel foi alterado para {role}',

  // Company notifications
  'company.created': 'Empresa {companyName} foi criada',
  'company.updated': 'Empresa {companyName} foi atualizada',
  'company.deleted': 'Empresa {companyName} foi deletada',

  // Notification messages
  'notification.sent': '{body}',
  'notification.reply.withSender': 'Resposta de {senderName} ({senderEmail}): {body}',
  'notification.reply.withoutSender': 'Resposta: {body}',
  'notification.default': 'Você tem uma nova notificação',
  'notification.newMessage': 'Você recebeu uma nova mensagem',
};


export function formatNotificationMessageTemplate(
  templateKey: string,
  params?: NotificationMessageParams
): string {
  const template = notificationMessageTemplates[templateKey];
  if (!template) return templateKey;

  if (!params) return template;

  let message = template;

  message = message.replace(/\{(\w+)\}/g, (match, key) => {
    const value = params[key as keyof NotificationMessageParams];
    if (value !== undefined && value !== null) {
      return String(value);
    }
    return match;
  });


  if (templateKey === 'notification.sent') {
    if (params?.body) {
      return params.body;
    }
    return params?.title || notificationMessageTemplates['notification.newMessage'];
  }

  return message;
}


export function getNotificationKindMessage(
  kind: string,
  params?: NotificationMessageParams
): string {
  const sender = params?.senderName && params?.senderEmail;
  
  if (kind === 'invite.created' && sender && params?.inviteUrl) {
    return formatNotificationMessageTemplate('invite.created.withSenderAndUrl', params);
  }
  
  const key = `${kind}.${sender ? 'withSender' : 'withoutSender'}`;
  
  if (notificationMessageTemplates[key]) {
    return formatNotificationMessageTemplate(key, params);
  }

  if (notificationMessageTemplates[kind]) {
    return formatNotificationMessageTemplate(kind, params);
  }

  return params?.body || params?.title || notificationMessageTemplates['notification.default'];
}


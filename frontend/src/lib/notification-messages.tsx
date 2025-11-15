import React from 'react';
import { getNotificationCodeMessage, isNotificationCode } from './messages';
import { MdPerson, MdCancel, MdMail, MdCheck, MdPersonRemove, MdRefresh, MdBusiness, MdDelete, MdChat, MdNotifications } from 'react-icons/md';

export type NotificationKind =
    | 'friend.request.sent'
    | 'friend.request.accepted'
    | 'friend.request.rejected'
    | 'friend.removed'
    | 'invite.created'
    | 'invite.accepted'
    | 'invite.rejected'
    | 'member.added'
    | 'member.removed'
    | 'role.changed'
    | 'company.created'
    | 'company.updated'
    | 'company.deleted'
    | 'notification.sent'
    | 'notification.reply';

export interface NotificationMeta {
    kind?: NotificationKind | string;
    channel?: 'company' | 'friend' | string;
    sender?: {
        id: string;
        name: string;
        email: string;
    };
    companyName?: string;
    companyId?: string;
    inviteId?: string;
    inviteUrl?: string;
    role?: string;
    previousRole?: string;
    removedBy?: {
        id: string;
        name: string;
        email: string;
    };
    originalNotificationId?: string;
    replyTo?: string;
    originalTitle?: string;
    rejectedByName?: string;
    rejectedByEmail?: string;
    inviteEmail?: string;

    [key: string]: any;
}

export interface NotificationData {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    read: boolean;
    senderUserId: string;
    recipientUserId?: string | null;
    companyId?: string | null;
    meta?: NotificationMeta;
}

export function formatNotificationMessage(notification: NotificationData): string {
    const { meta, title, body } = notification;
    const kind = meta?.kind || 'notifications.sent';
    const sender = meta?.sender;

    if (isNotificationCode(title)) {
        const baseMessage = getNotificationCodeMessage(title);

        if (sender) {
            switch (title) {
                case 'FRIEND_REQUEST_SENT':
                    return `${sender.name} (${sender.email}) enviou uma solicitação de amizade`;
                case 'FRIEND_REQUEST_ACCEPTED':
                    return `${sender.name} (${sender.email}) aceitou sua solicitação de amizade`;
                case 'FRIEND_REQUEST_REJECTED':
                    return `${sender.name} (${sender.email}) rejeitou sua solicitação de amizade`;
                case 'FRIEND_REMOVED':
                    return `${sender.name} (${sender.email}) removeu você da lista de amigos`;
                case 'INVITE_CREATED':
                    const inviteUrl = meta?.inviteUrl || (meta?.inviteId ? `/invite/${meta.inviteId}` : '');
                    const companyName = meta?.companyName || 'uma empresa';
                    return `${sender.name} (${sender.email}) convidou você para participar ${companyName}${inviteUrl ? `. Link: ${inviteUrl}` : ''}`;
                case 'INVITE_ACCEPTED':
                    return `${sender.name} (${sender.email}) aceitou seu convite para ${meta?.companyName || 'a empresa'}`;
                case 'INVITE_REJECTED':
                    const rejectedByName = meta?.rejectedByName || sender?.name || 'Alguém';
                    const rejectedByEmail = meta?.rejectedByEmail || sender?.email || '';
                    const inviteEmail = meta?.inviteEmail || '';
                    const companyNameRejected = meta?.companyName || 'a empresa';
                    return `Seu convite para ${inviteEmail} para ${companyNameRejected} foi rejeitado${rejectedByName ? `
                     por ${rejectedByName}${rejectedByEmail ? ` (${rejectedByEmail})` : ''}` : ''}`;
                case 'MEMBER_ADDED':
                    return `Você foi adicionado a ${meta?.companyName || 'uma empresa'} por ${sender.name} (${sender.email})`;
                case 'MEMBER_REMOVED':
                    const removedBy = meta?.removedBy || sender;
                    return removedBy
                        ? `Você foi removido de ${meta?.companyName || 'uma empresa'} por ${removedBy.name} (${removedBy.email})`
                        : `Você foi removido de ${meta?.companyName || 'uma empresa'}`;
                case 'ROLE_CHANGED':
                    const role = meta?.role || 'N/A';
                    const previousRole = meta?.previousRole || 'N/A';
                    return `Seu papel em ${meta?.companyName || 'uma empresa'} foi alterado de ${previousRole} para
                     ${role} por ${sender.name} (${sender.email})`;
                case 'COMPANY_CREATED':
                    return `Empresa ${meta?.companyName || 'criada'} foi criada com sucesso`;
                case 'NOTIFICATION_REPLY':
                    const originalTitle = meta?.originalTitle || title;
                    return `Resposta de ${sender.name} (${sender.email}): ${body || originalTitle}`;
                default:
                    return baseMessage;
            }
        }

        return baseMessage;
    }

    switch (kind) {
        case 'friend.request.sent':
            return sender
                ? `Nova solicitação de amizade enviada por ${sender.name} (${sender.email})`
                : 'Nova solicitação de amizade enviada para você';

        case 'friend.request.accepted':
            return sender
                ? `${sender.name} (${sender.email}) aceitou sua solicitação de amizade`
                : 'Sua solicitação de amizade foi aceita';

        case 'friend.request.rejected':
            return sender
                ? `${sender.name} (${sender.email}) rejeitou sua solicitação de amizade`
                : 'Sua solicitação de amizade foi rejeitada';

        case 'friend.removed':
            return sender
                ? `${sender.name} (${sender.email}) removeu você da lista de amigos`
                : 'Você foi removido da lista de amigos';

        case 'invite.created':
            const inviteUrl = meta?.inviteUrl || (meta?.inviteId ? `/invite/${meta.inviteId}` : '');
            const companyName = meta?.companyName || 'uma empresa';
            return sender
                ? `Convite enviado para você por ${sender.name} (${sender.email}) para ${companyName}. ${inviteUrl ? `Link: ${inviteUrl}` : ''}`
                : `Você recebeu um convite para ${companyName}`;

        case 'invite.accepted':
            return sender
                ? `${sender.name} (${sender.email}) aceitou seu convite para ${meta?.companyName || 'a empresa'}`
                : 'Seu convite foi aceito';

        case 'invite.rejected':
            return sender
                ? `${sender.name} (${sender.email}) rejeitou seu convite para ${meta?.companyName || 'a empresa'}`
                : 'Seu convite foi rejeitado';

        case 'member.added':
            return sender
                ? `Você foi adicionado a ${meta?.companyName || 'uma empresa'} por ${sender.name} (${sender.email})`
                : `Você foi adicionado a ${meta?.companyName || 'uma empresa'}`;

        case 'member.removed':
            const removedBy = meta?.removedBy || sender;
            return removedBy
                ? `Você foi removido de ${meta?.companyName || 'uma empresa'} por ${removedBy.name} (${removedBy.email})`
                : `Você foi removido de ${meta?.companyName || 'uma empresa'}`;

        case 'role.changed':
            const role = meta?.role || 'N/A';
            const previousRole = meta?.previousRole || 'N/A';
            return sender
                ? `Seu papel em ${meta?.companyName || 'uma empresa'} foi alterado de ${previousRole} para ${role} por ${sender.name} (${sender.email})`
                : `Seu papel foi alterado para ${role}`;

        case 'company.created':
            return `Empresa ${meta?.companyName || 'criada'} foi criada`;

        case 'company.updated':
            return `Empresa ${meta?.companyName || 'atualizada'} foi atualizada`;

        case 'company.deleted':
            return `Empresa ${meta?.companyName || 'deletada'} foi deletada`;

        case 'notification.sent':
            return body || title || 'Você recebeu uma nova mensagem';

        case 'notification.reply':
            return sender
                ? `Resposta de ${sender.name} (${sender.email}): ${body || title}`
                : `Resposta: ${body || title}`;

        default:
            return body || title || 'Você tem uma nova notificação';
    }
}

export function getNotificationStyle(kind?: string): { color: string; icon: React.ReactNode } {
    switch (kind) {
        case 'friend.request.sent':
        case 'friend.request.accepted':
            return { color: 'text-blue-600 dark:text-blue-400', icon: <MdPerson className="text-lg" /> };
        case 'friend.request.rejected':
        case 'friend.removed':
            return { color: 'text-red-600 dark:text-red-400', icon: <MdCancel className="text-lg" /> };
        case 'invites.created':
        case 'invites.accepted':
            return { color: 'text-green-600 dark:text-green-400', icon: <MdMail className="text-lg" /> };
        case 'invites.rejected':
            return { color: 'text-orange-600 dark:text-orange-400', icon: <MdCancel className="text-lg" /> };
        case 'member.added':
            return { color: 'text-green-600 dark:text-green-400', icon: <MdCheck className="text-lg" /> };
        case 'member.removed':
            return { color: 'text-red-600 dark:text-red-400', icon: <MdPersonRemove className="text-lg" /> };
        case 'role.changed':
            return { color: 'text-blue-600 dark:text-blue-400', icon: <MdRefresh className="text-lg" /> };
        case 'companys.created':
        case 'companys.updated':
            return { color: 'text-blue-600 dark:text-blue-400', icon: <MdBusiness className="text-lg" /> };
        case 'companys.deleted':
            return { color: 'text-red-600 dark:text-red-400', icon: <MdDelete className="text-lg" /> };
        case 'notifications.sent':
        case 'notifications.reply':
            return { color: 'text-blue-600 dark:text-blue-400', icon: <MdChat className="text-lg" /> };
        default:
            return { color: 'text-gray-600 dark:text-gray-400', icon: <MdNotifications className="text-lg" /> };
    }
}
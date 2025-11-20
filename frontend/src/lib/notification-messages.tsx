import React from 'react';
import {
    getNotificationCodeMessage,
    isNotificationCode,
    formatNotificationMessageTemplate,
    getNotificationKindMessage,
    translateRole,
    type NotificationMessageParams
} from './messages';
import {
    MdPerson,
    MdCancel,
    MdMail,
    MdCheck,
    MdPersonRemove,
    MdRefresh,
    MdBusiness,
    MdDelete,
    MdChat,
    MdNotifications
} from 'react-icons/md';

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
    friendshipId?: string;
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
    sender?: {
        id: string;
        name: string;
        email: string;
    };
}

export function formatNotificationMessage(notification: NotificationData): string {
    const {meta, title, body} = notification;
    const kind = meta?.kind || 'notification.sent';
    const sender = meta?.sender || notification.sender;

    const params: NotificationMessageParams = {
        senderName: sender?.name,
        senderEmail: sender?.email,
        companyName: meta?.company?.name || meta?.companyName || 'uma empresa',
        inviteUrl: meta?.inviteUrl || (meta?.inviteId ? `/invite/${meta.inviteId}` : undefined),
        inviteId: meta?.inviteId,
        inviteEmail: meta?.inviteEmail,
        rejectedByName: meta?.rejectedByName || sender?.name || 'Alguém',
        rejectedByEmail: meta?.rejectedByEmail || sender?.email,
        removedByName: meta?.removedBy?.name || sender?.name,
        removedByEmail: meta?.removedBy?.email || sender?.email,
        role: translateRole(meta?.role) || 'N/A',
        previousRole: translateRole(meta?.previousRole) || 'N/A',
        body: body,
        title: title,
        originalTitle: meta?.originalTitle || title,
    };

    const eventCode = extractEventCode(title);
    const codeToCheck = eventCode || title;

    if (isNotificationCode(codeToCheck)) {
        const baseMessage = getNotificationCodeMessage(eventCode || title);

        switch (eventCode || title) {
            case 'FRIEND_REQUEST_SENT':
                return sender
                    ? formatNotificationMessageTemplate('friend.request.sent.withSender', params)
                    : formatNotificationMessageTemplate('friend.request.sent.withoutSender', params);
            case 'FRIEND_REQUEST_ACCEPTED':
                return sender
                    ? formatNotificationMessageTemplate('friend.request.accepted.withSender', params)
                    : formatNotificationMessageTemplate('friend.request.accepted.withoutSender', params);
            case 'FRIEND_REQUEST_REJECTED':
                return sender
                    ? formatNotificationMessageTemplate('friend.request.rejected.withSender', params)
                    : formatNotificationMessageTemplate('friend.request.rejected.withoutSender', params);
            case 'FRIEND_REMOVED':
                return sender
                    ? formatNotificationMessageTemplate('friend.removed.withSender', params)
                    : formatNotificationMessageTemplate('friend.removed.withoutSender', params);
            case 'INVITE_CREATED':
                if (sender && params.inviteUrl) {
                    return formatNotificationMessageTemplate('invite.created.withSenderAndUrl', params);
                }
                return sender
                    ? formatNotificationMessageTemplate('invite.created.withSender', params)
                    : formatNotificationMessageTemplate('invite.created.withoutSender', params);
            case 'INVITE_ACCEPTED':
                return sender
                    ? formatNotificationMessageTemplate('invite.accepted.withSender', params)
                    : formatNotificationMessageTemplate('invite.accepted.withoutSender', params);
            case 'INVITE_REJECTED':
                if (meta?.inviteEmail && (meta?.rejectedByName || meta?.rejectedByEmail) && meta?.companyName) {
                    return formatNotificationMessageTemplate('invite.rejected.detailed', params);
                }
                if (sender) {
                    return formatNotificationMessageTemplate('invite.rejected.withSender', params);
                }
                return formatNotificationMessageTemplate('invite.rejected.withoutSender', params);
            case 'MEMBER_ADDED':
                return sender
                    ? formatNotificationMessageTemplate('member.added.withSender', params)
                    : formatNotificationMessageTemplate('member.added.withoutSender', params);
            case 'MEMBER_REMOVED':
                return sender
                    ? formatNotificationMessageTemplate('member.removed.withSender', params)
                    : formatNotificationMessageTemplate('member.removed.withoutSender', params);
            case 'ROLE_CHANGED':
                return sender
                    ? formatNotificationMessageTemplate('role.changed.withSender', params)
                    : formatNotificationMessageTemplate('role.changed.withoutSender', params);
            case 'COMPANY_CREATED':
                return formatNotificationMessageTemplate('company.created', params);
            case 'NOTIFICATION_REPLY':
                return sender
                    ? formatNotificationMessageTemplate('notification.reply.withSender', params)
                    : formatNotificationMessageTemplate('notification.reply.withoutSender', params);
            default:
                return baseMessage;
        }
    }

    return getNotificationKindMessage(kind, params);
}

export function extractEventCode(title: string): string | null {
    const match = title.match(/\[([^\]]+)\]/);
    return match ? match[1] : null;
}

export function removeEventCodeFromTitle(title: string): string {
    let cleaned = title.replace(/\s*\[([^\]]+)\]\s*$/, '').trim();
    
    cleaned = cleaned.replace(/\b(MEMBER|ADMIN|OWNER|member|admin|owner)\b/g, (match) => {
        return translateRole(match);
    });
    
    return cleaned;
}

export function getNotificationStyle(kind?: string): { color: string; icon: React.ReactNode } {
    switch (kind) {
        case 'friend.request.sent':
        case 'friend.request.accepted':
            return {color: 'text-blue-600 dark:text-blue-400', icon: <MdPerson className="text-lg"/>};
        case 'friend.request.rejected':
        case 'friend.removed':
            return {color: 'text-red-600 dark:text-red-400', icon: <MdCancel className="text-lg"/>};
        case 'invite.created':
        case 'invites.created':
        case 'invite.accepted':
        case 'invites.accepted':
            return {color: 'text-green-600 dark:text-green-400', icon: <MdMail className="text-lg"/>};
        case 'invite.rejected':
        case 'invites.rejected':
            return {color: 'text-orange-600 dark:text-orange-400', icon: <MdCancel className="text-lg"/>};
        case 'member.added':
        case 'membership.joined':
        case 'memberships.joined':
            return {color: 'text-green-600 dark:text-green-400', icon: <MdCheck className="text-lg"/>};
        case 'member.removed':
        case 'membership.removed':
        case 'memberships.removed':
            return {color: 'text-red-600 dark:text-red-400', icon: <MdPersonRemove className="text-lg"/>};
        case 'role.changed':
        case 'membership.role.updated':
        case 'memberships.role.updated':
            return {color: 'text-blue-600 dark:text-blue-400', icon: <MdRefresh className="text-lg"/>};
        case 'companys.created':
        case 'companys.updated':
            return {color: 'text-blue-600 dark:text-blue-400', icon: <MdBusiness className="text-lg"/>};
        case 'companys.deleted':
            return {color: 'text-red-600 dark:text-red-400', icon: <MdDelete className="text-lg"/>};
        case 'notification.sent':
        case 'notifications.sent':
        case 'notification.reply':
        case 'notifications.reply':
            return {color: 'text-blue-600 dark:text-blue-400', icon: <MdChat className="text-lg"/>};
        default:
            return {color: 'text-gray-600 dark:text-gray-400', icon: <MdNotifications className="text-lg"/>};
    }
}
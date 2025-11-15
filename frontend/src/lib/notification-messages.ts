import React from 'react';
import { getNotificationCodeMessage, isNotificationCode } from './messages';

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
    const kind = meta?.kind || 'notification.sent';
    const sender = meta?.sender;

    if (isNotificationCode(title)) {
        const baseMessage = getNotificationCodeMessage(title);
        
        if (sender) {
            switch (title) {
                case 'FRIEND_REQUEST_SENT':
                    return `${sender.name} (${sender.email}) sent you a friend request`;
                case 'FRIEND_REQUEST_ACCEPTED':
                    return `${sender.name} (${sender.email}) accepted your friend request`;
                case 'FRIEND_REQUEST_REJECTED':
                    return `${sender.name} (${sender.email}) rejected your friend request`;
                case 'FRIEND_REMOVED':
                    return `${sender.name} (${sender.email}) removed you from their friends list`;
                case 'INVITE_CREATED':
                    const inviteUrl = meta?.inviteUrl || (meta?.inviteId ? `/invite/${meta.inviteId}` : '');
                    const companyName = meta?.companyName || 'a company';
                    return `${sender.name} (${sender.email}) invited you to join ${companyName}${inviteUrl ? `. Link: ${inviteUrl}` : ''}`;
                case 'INVITE_ACCEPTED':
                    return `${sender.name} (${sender.email}) accepted your invitation for ${meta?.companyName || 'the company'}`;
                case 'INVITE_REJECTED':
                    const rejectedByName = meta?.rejectedByName || sender?.name || 'Someone';
                    const rejectedByEmail = meta?.rejectedByEmail || sender?.email || '';
                    const inviteEmail = meta?.inviteEmail || '';
                    const companyNameRejected = meta?.companyName || 'the company';
                    return `Your invitation to ${inviteEmail} for ${companyNameRejected} was rejected${rejectedByName ? ` by ${rejectedByName}${rejectedByEmail ? ` (${rejectedByEmail})` : ''}` : ''}`;
                case 'MEMBER_ADDED':
                    return `You were added to ${meta?.companyName || 'a company'} by ${sender.name} (${sender.email})`;
                case 'MEMBER_REMOVED':
                    const removedBy = meta?.removedBy || sender;
                    return removedBy
                        ? `You were removed from ${meta?.companyName || 'a company'} by ${removedBy.name} (${removedBy.email})`
                        : `You were removed from ${meta?.companyName || 'a company'}`;
                case 'ROLE_CHANGED':
                    const role = meta?.role || 'N/A';
                    const previousRole = meta?.previousRole || 'N/A';
                    return `Your role in ${meta?.companyName || 'a company'} was changed from ${previousRole} to ${role} by ${sender.name} (${sender.email})`;
                case 'COMPANY_CREATED':
                    return `Company ${meta?.companyName || 'created'} was created successfully`;
                case 'NOTIFICATION_REPLY':
                    const originalTitle = meta?.originalTitle || title;
                    return `Reply from ${sender.name} (${sender.email}): ${body || originalTitle}`;
                default:
                    return baseMessage;
            }
        }
        
        return baseMessage;
    }

    switch (kind) {
        case 'friend.request.sent':
            return sender 
                ? `New friend request sent to you by ${sender.name} (${sender.email})`
                : 'New friend request sent to you';

        case 'friend.request.accepted':
            return sender
                ? `${sender.name} (${sender.email}) accepted your friend request`
                : 'Your friend request was accepted';

        case 'friend.request.rejected':
            return sender
                ? `${sender.name} (${sender.email}) rejected your friend request`
                : 'Your friend request was rejected';

        case 'friend.removed':
            return sender
                ? `${sender.name} (${sender.email}) removed you from their friends list`
                : 'You were removed from a friend\'s list';

        case 'invite.created':
            const inviteUrl = meta?.inviteUrl || (meta?.inviteId ? `/invite/${meta.inviteId}` : '');
            const companyName = meta?.companyName || 'a company';
            return sender
                ? `Invitation sent to you by ${sender.name} (${sender.email}) for ${companyName}. ${inviteUrl ? `Link: ${inviteUrl}` : ''}`
                : `You received an invitation for ${companyName}`;

        case 'invite.accepted':
            return sender
                ? `${sender.name} (${sender.email}) accepted your invitation for ${meta?.companyName || 'the company'}`
                : 'Your invitation was accepted';

        case 'invite.rejected':
            return sender
                ? `${sender.name} (${sender.email}) rejected your invitation for ${meta?.companyName || 'the company'}`
                : 'Your invitation was rejected';

        case 'member.added':
            return sender
                ? `You were added to ${meta?.companyName || 'a company'} by ${sender.name} (${sender.email})`
                : `You were added to ${meta?.companyName || 'a company'}`;

        case 'member.removed':
            const removedBy = meta?.removedBy || sender;
            return removedBy
                ? `You were removed from ${meta?.companyName || 'a company'} by ${removedBy.name} (${removedBy.email})`
                : `You were removed from ${meta?.companyName || 'a company'}`;

        case 'role.changed':
            const role = meta?.role || 'N/A';
            const previousRole = meta?.previousRole || 'N/A';
            return sender
                ? `Your role in ${meta?.companyName || 'a company'} was changed from ${previousRole} to ${role} by ${sender.name} (${sender.email})`
                : `Your role was changed to ${role}`;

        case 'company.created':
            return `Company ${meta?.companyName || 'created'} was created`;

        case 'company.updated':
            return `Company ${meta?.companyName || 'updated'} was updated`;

        case 'company.deleted':
            return `Company ${meta?.companyName || 'deleted'} was deleted`;

        case 'notification.sent':
            return body || title || 'You received a new message';

        case 'notification.reply':
            return sender
                ? `Reply from ${sender.name} (${sender.email}): ${body || title}`
                : `Reply: ${body || title}`;

        default:
            return body || title || 'You have a new notification';
    }
}


export function getNotificationStyle(kind?: string): { color: string; icon: React.ReactNode } {
    switch (kind) {
        case 'friend.request.sent':
        case 'friend.request.accepted':
            return { color: 'text-blue-600', icon: React.createElement('span', { className: 'text-lg' }, '👤') };
        case 'friend.request.rejected':
        case 'friend.removed':
            return { color: 'text-red-600', icon: React.createElement('span', { className: 'text-lg' }, '✕') };
        case 'invite.created':
        case 'invite.accepted':
            return { color: 'text-green-600', icon: React.createElement('span', { className: 'text-lg' }, '✉️') };
        case 'invite.rejected':
            return { color: 'text-orange-600', icon: React.createElement('span', { className: 'text-lg' }, '✕') };
        case 'member.added':
            return { color: 'text-green-600', icon: React.createElement('span', { className: 'text-lg' }, '✓') };
        case 'member.removed':
            return { color: 'text-red-600', icon: React.createElement('span', { className: 'text-lg' }, '👤') };
        case 'role.changed':
            return { color: 'text-blue-600', icon: React.createElement('span', { className: 'text-lg' }, '🔄') };
        case 'company.created':
        case 'company.updated':
            return { color: 'text-blue-600', icon: React.createElement('span', { className: 'text-lg' }, '🏢') };
        case 'company.deleted':
            return { color: 'text-red-600', icon: React.createElement('span', { className: 'text-lg' }, '🗑️') };
        case 'notification.sent':
        case 'notification.reply':
            return { color: 'text-blue-600', icon: React.createElement('span', { className: 'text-lg' }, '💬') };
        default:
            return { color: 'text-gray-600', icon: React.createElement('span', { className: 'text-lg' }, '🔔') };
    }
}


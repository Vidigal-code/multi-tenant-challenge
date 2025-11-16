"use client";
import React, { useEffect, useState } from 'react';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';
import { NotificationPopup } from './NotificationPopup';
import { NotificationData } from '../../lib/notification-messages';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { http } from '../../lib/http';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';

interface NotificationPopupManagerProps {
    enabled: boolean;
}

type NotificationKind =
    | 'invite.created'
    | 'invites.created'
    | 'invite.accepted'
    | 'invites.accepted'
    | 'invite.rejected'
    | 'invites.rejected'
    | 'friend.request.sent'
    | 'friend.request.accepted'
    | 'friend.request.rejected'
    | 'friend.removed'
    | 'notification.sent'
    | 'notifications.sent'
    | 'notification.reply'
    | 'notifications.replied'
    | 'member.added'
    | 'member.removed'
    | 'membership.joined'
    | 'membership.removed'
    | 'role.changed'
    | 'membership.role.updated';

const COMPANY_INVITATION_KINDS: NotificationKind[] = [
    'invite.created', 'invites.created', 
    'invite.accepted', 'invites.accepted',
    'invite.rejected', 'invites.rejected'
];

const FRIEND_REQUEST_KINDS: NotificationKind[] = ['friend.request.sent', 'friend.request.accepted', 'friend.request.rejected', 'friend.removed'];
const COMPANY_MESSAGE_KINDS: NotificationKind[] = [
    'notification.sent', 'notifications.sent',
    'notification.reply', 'notifications.replied' 
];
const MEMBERSHIP_CHANGE_KINDS: NotificationKind[] = [
    'member.added', 'membership.joined', 
    'member.removed', 'membership.removed' 
];
const ROLE_CHANGE_KINDS: NotificationKind[] = [
    'role.changed', 'membership.role.updated'
];

function shouldShowNotification(notification: NotificationData, preferences: any): boolean {
    if (!preferences) return true;

    const kind = notification.meta?.kind as NotificationKind || '';
    const title = (notification.title || '').toUpperCase();
    const body = (notification.body || '').toUpperCase();

    if (COMPANY_INVITATION_KINDS.includes(kind) ||
        title.includes('CONVITE') || title.includes('INVITE')) {
        return preferences.companyInvitations;
    }

    if (FRIEND_REQUEST_KINDS.includes(kind) ||
        title.includes('AMIGO') || title.includes('FRIEND')) {
        return preferences.friendRequests;
    }

    if (COMPANY_MESSAGE_KINDS.includes(kind) ||
        title.includes('NOTIFICATION') || title.includes('MENSAGEM') || body.includes('MENSAGEM')) {
        return preferences.companyMessages;
    }

    if (MEMBERSHIP_CHANGE_KINDS.includes(kind) ||
        title.includes('MEMBER') || title.includes('MEMBRO')) {
        return preferences.membershipChanges;
    }

    if (ROLE_CHANGE_KINDS.includes(kind) ||
        title.includes('ROLE') || title.includes('CARGO') || title.includes('PAPEL')) {
        return preferences.roleChanges;
    }

    return true;
}

export function NotificationPopupManager({ enabled }: NotificationPopupManagerProps) {
    const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
    const queryClient = useQueryClient();
    const { preferences, derived: notificationDerived } = useNotificationPreferences();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;

            let lastNotificationTime = 0;
            const THROTTLE_MS = 1000;

            const handleNotification = async (payload: any) => {
                if (!active) return;

                const now = Date.now();
                if (now - lastNotificationTime < THROTTLE_MS) {
                    return;
                }
                lastNotificationTime = now;

                try {
                    // Only show popup if realtime is enabled, popups are enabled, and icon badge is not selected
                    if (!notificationDerived.realtimeEnabled || !notificationDerived.realtimePopups || notificationDerived.realtimeIconBadge) {
                        return;
                    }

                    let notification: NotificationData | null = null;

                    if (payload.notificationId) {
                        const cachedNotifications = queryClient.getQueryData<NotificationData[]>(queryKeys.notifications());
                        notification = cachedNotifications?.find(n => n.id === payload.notificationId) || null;

                        if (!notification) {
                            const notifications = await queryClient.fetchQuery<NotificationData[]>({
                                queryKey: queryKeys.notifications(),
                                queryFn: async () => {
                                    const response = await http.get('/notifications');
                                    return (response.data.items ?? []) as NotificationData[];
                                },
                                staleTime: 5000,
                            });
                            notification = notifications?.find(n => n.id === payload.notificationId) || null;
                        }
                    } else {
                        queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                        const notifications = await queryClient.fetchQuery<NotificationData[]>({
                            queryKey: queryKeys.notifications(),
                            queryFn: async () => {
                                const response = await http.get('/notifications');
                                return (response.data.items ?? []) as NotificationData[];
                            },
                            staleTime: 5000,
                        });
                        notification = notifications && notifications.length > 0 ? notifications[0] : null;
                    }

                    if (notification) {
                        if (shouldShowNotification(notification, preferences)) {
                            setCurrentNotification(notification);

                            queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });

                            setTimeout(() => {
                                if (active) {
                                    setCurrentNotification(null);
                                }
                            }, 10000);
                        }
                    } else {
                        queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                    }
                } catch (error) {
                    //console.error('[NotificationPopupManager] Erro ao buscar notificação:', error);
                }
            };

            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, handleNotification));

            unsubscribers.push(subscribe(RT_EVENTS.INVITE_ACCEPTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_REJECTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_SENT, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_ACCEPTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REMOVED, handleNotification));
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [enabled, queryClient, preferences, notificationDerived]);

    if (!enabled || !currentNotification) return null;

    return (
        <NotificationPopup
            notification={currentNotification}
            onClose={() => setCurrentNotification(null)}
            onNavigate={() => {
                setCurrentNotification(null);
                queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
            }}
        />
    );
}
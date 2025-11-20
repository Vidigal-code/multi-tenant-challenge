"use client";
import React, { useEffect, useState } from 'react';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';
import { NotificationPopup } from './NotificationPopup';
import { NotificationData, extractEventCode } from '../../lib/notification-messages';
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

function shouldShowNotification(notification: NotificationData, derived: any): boolean {
    if (!derived) return true;

    const kind = notification.meta?.kind as NotificationKind || '';
    const channel = notification.meta?.channel;
    const title = (notification.title || '').toUpperCase();
    const body = (notification.body || '').toUpperCase();

    if (COMPANY_INVITATION_KINDS.includes(kind) ||
        title.includes('CONVITE') || title.includes('INVITE')) {
        return derived.companyInvitations !== false;
    }

    if (FRIEND_REQUEST_KINDS.includes(kind) ||
        title.includes('AMIGO') || title.includes('FRIEND')) {
        return derived.friendRequests !== false;
    }

    if (channel === 'friend' &&
        (COMPANY_MESSAGE_KINDS.includes(kind) ||
            title.includes('NOTIFICATION_SENT') ||
            title.includes('NOTIFICATION SENT') ||
            body.includes('NOTIFICATION_SENT') ||
            body.includes('NOTIFICATION SENT'))) {
        return derived.friendMessages !== false;
    }

    if (COMPANY_MESSAGE_KINDS.includes(kind) ||
        title.includes('NOTIFICATION') || title.includes('MENSAGEM') || body.includes('MENSAGEM')) {
        return derived.companyMessages !== false;
    }

    if (MEMBERSHIP_CHANGE_KINDS.includes(kind) ||
        title.includes('MEMBER') || title.includes('MEMBRO')) {
        return derived.membershipChanges !== false;
    }

    if (ROLE_CHANGE_KINDS.includes(kind) ||
        title.includes('ROLE') || title.includes('CARGO') || title.includes('PAPEL')) {
        return derived.roleChanges !== false;
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
                    const messageId = payload.messageId;
                    
                    if (!notificationDerived.realtimeEnabled || !notificationDerived.realtimePopups || notificationDerived.realtimeIconBadge) {
                        if (messageId) {
                            try {
                                const { emit } = await import('../../lib/realtime');
                                emit(RT_EVENTS.NOTIFICATION_DELIVERED, { messageId });
                                console.log('[NotificationPopupManager] Delivery confirmed (popup disabled):', messageId);
                            } catch (error) {
                                console.error('[NotificationPopupManager] Error confirming delivery:', error);
                            }
                        }
                        queryClient.invalidateQueries({ 
                            queryKey: queryKeys.notifications(),
                        }).catch((error: any) => {
                            if (error?.name !== 'CancelledError') {
                                console.error('[NotificationPopupManager] Error invalidating queries:', error);
                            }
                        });
                        return;
                    }

                    let notification: NotificationData | null = null;

                    const notificationId = payload.notificationId || payload.id || payload.notification?.id;

                    try {
                        queryClient.invalidateQueries({ 
                                queryKey: queryKeys.notifications(),
                        }).catch((error: any) => {
                            if (error?.name !== 'CancelledError') {
                                console.error('[NotificationPopupManager] Error invalidating queries:', error);
                            }
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        const notifications = await queryClient.fetchQuery<NotificationData[]>({
                            queryKey: queryKeys.notifications(),
                            queryFn: async () => {
                                const response = await http.get('/notifications');
                                return (response.data.items ?? []) as NotificationData[];
                            },
                            staleTime: 5000,
                        });

                        if (notificationId) {
                            notification = notifications?.find(n => n.id === notificationId) || null;
                        } else {
                            const eventId = payload.eventId || extractEventCode(payload.title || '');
                            const eventName = payload.eventName || payload.meta?.kind;
                            const companyId = payload.companyId || payload.company?.id;
                            const receiverId = payload.receiver?.id || payload.recipientUserId;
                            
                            if (eventId || eventName) {
                                notification = notifications?.find(n => {
                                    const nEventId = extractEventCode(n.title || '');
                                    const matchesEventId = eventId && (nEventId === eventId || n.title?.includes(eventId));
                                    const matchesKind = eventName && n.meta?.kind === eventName;
                                    const matchesCompany = companyId && n.companyId === companyId;
                                    const matchesReceiver = receiverId && n.recipientUserId === receiverId;
                                    
                                    if (matchesEventId || matchesKind) {
                                        if (companyId && receiverId) {
                                            return matchesCompany && matchesReceiver;
                                        }
                                        return true;
                                    }
                                    return false;
                                }) || null;
                            }
                            
                            if (!notification && notifications && notifications.length > 0) {
                                const recentNotification = notifications
                                    .filter(n => {
                                        if (companyId && n.companyId !== companyId) return false;
                                        if (receiverId && n.recipientUserId !== receiverId) return false;
                                        return true;
                                    })
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                                
                                notification = recentNotification || notifications[0];
                            }
                        }
                    } catch (fetchError) {
                        console.error('[NotificationPopupManager] Error fetching notifications:', fetchError);
                    }

                    if (messageId) {
                        try {
                            const { emit } = await import('../../lib/realtime');
                            emit(RT_EVENTS.NOTIFICATION_DELIVERED, { messageId });
                            console.log('[NotificationPopupManager] Delivery confirmed:', messageId);
                        } catch (error) {
                            console.error('[NotificationPopupManager] Error confirming delivery:', error);
                        }
                    }

                    if (notification) {
                        if (shouldShowNotification(notification, notificationDerived)) {
                            setCurrentNotification(notification);

                            queryClient.invalidateQueries({ 
                                queryKey: queryKeys.notifications(),
                            }).catch((error: any) => {
                                if (error?.name !== 'CancelledError') {
                                    console.error('[NotificationPopupManager] Error invalidating queries:', error);
                                }
                            });

                            setTimeout(() => {
                                if (active) {
                                    setCurrentNotification(null);
                                }
                            }, 10000);
                        }
                    } else {
                        queryClient.invalidateQueries({ 
                            queryKey: queryKeys.notifications(),
                        }).catch((error: any) => {
                            if (error?.name !== 'CancelledError') {
                                console.error('[NotificationPopupManager] Error invalidating queries:', error);
                            }
                        });
                    }
                } catch (error) {
                    console.error('[NotificationPopupManager] Error handling notification:', error);
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
    }, [enabled, queryClient, notificationDerived]);

    if (!enabled || !currentNotification) return null;

    return (
        <NotificationPopup
            notification={currentNotification}
            onClose={() => setCurrentNotification(null)}
            onNavigate={() => {
                setCurrentNotification(null);
                queryClient.invalidateQueries({ 
                    queryKey: queryKeys.notifications(),
                }).catch((error: any) => {
                    if (error?.name !== 'CancelledError') {
                        console.error('[NotificationPopupManager] Error invalidating queries:', error);
                    }
                });
            }}
        />
    );
}
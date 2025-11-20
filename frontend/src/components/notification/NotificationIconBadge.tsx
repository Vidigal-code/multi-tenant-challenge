"use client";
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';
import { useNotifications } from '../../services/api';
import { MdNotifications } from 'react-icons/md';
import Link from 'next/link';

interface NotificationIconBadgeProps {
    enabled: boolean;
}

export function NotificationIconBadge({ enabled }: NotificationIconBadgeProps) {
    const [isOpen, setIsOpen] = useState(false);
    const queryClient = useQueryClient();
    
    const { data: notificationsData } = useNotifications(1, 100);
    const notifications = notificationsData?.items ?? [];
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;

            const refetch = () => {
                queryClient.invalidateQueries({ 
                    queryKey: queryKeys.notifications(),
                }).catch((error: any) => {
                    if (error?.name !== 'CancelledError') {
                        console.error('[NotificationIconBadge] Error invalidating queries:', error);
                    }
                });
            };

            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_ACCEPTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_REJECTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_SENT, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_ACCEPTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REMOVED, refetch));
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [enabled, queryClient]);

    if (!enabled) return null;

    return (
        <div className="fixed top-20 right-4 z-50">
            <Link
                href="/notifications"
                className="relative inline-flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-900 border border-gray-200
                dark:border-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 cursor-pointer"
                onClick={() => {
                    setIsOpen(false);
                    queryClient.invalidateQueries({ 
                        queryKey: queryKeys.notifications(),
                    }).catch((error: any) => {
                        if (error?.name !== 'CancelledError') {
                            console.error('[NotificationIconBadge] Error invalidating queries:', error);
                        }
                    });
                }}
                title={`${unreadCount > 0 ? `${unreadCount} notificação${unreadCount > 1 ? 'ões' : ''} não lida${unreadCount > 1 ? 's' : ''}` : 
                    'Notificações'}`}
            >
                <MdNotifications className="text-xl text-gray-700 dark:text-gray-300" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold
                    text-white bg-red-600 rounded-full border-2 border-white dark:border-gray-900 animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </Link>
        </div>
    );
}


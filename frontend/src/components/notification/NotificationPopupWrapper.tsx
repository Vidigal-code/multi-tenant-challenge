"use client";
import React from 'react';
import { NotificationPopupManager } from './NotificationPopupManager';
import { NotificationIconBadge } from './NotificationIconBadge';
import { usePathname } from 'next/navigation';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';

export function NotificationPopupWrapper() {
    const pathname = usePathname();
    
    const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
    const { derived: notificationDerived, isLoading } = useNotificationPreferences();

    if (isAuthPage || isLoading) return null;

    return (
        <>
            {notificationDerived.realtimeEnabled && notificationDerived.realtimePopups && !notificationDerived.realtimeIconBadge && (
                <NotificationPopupManager enabled={true} />
            )}
            {notificationDerived.realtimeEnabled && notificationDerived.realtimeIconBadge && (
                <NotificationIconBadge enabled={true} />
            )}
        </>
    );
}


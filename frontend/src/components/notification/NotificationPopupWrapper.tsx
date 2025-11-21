"use client";
import React from 'react';
import { NotificationPopupManager } from './NotificationPopupManager';
import { NotificationIconBadge } from './NotificationIconBadge';
import { usePathname } from 'next/navigation';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';

/**
 *      
 * EN: Notification Popup Wrapper Component
 *
 * PT: Componente Wrapper de Popup de Notificação
 *
 * @returns JSX.Element | null
 */
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


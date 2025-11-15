"use client";
import React from 'react';
import { NotificationPopupManager } from './NotificationPopupManager';
import { useQuery } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { usePathname } from 'next/navigation';

export function NotificationPopupWrapper() {
    const pathname = usePathname();
    
    const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/';
    
    const { data: profile } = useQuery({
        queryKey: queryKeys.profile(),
        queryFn: async () => {
            try {
                const { data } = await http.get('/auth/profile');
                return data;
            } catch {
                return null;
            }
        },
        enabled: !isAuthPage,
        staleTime: 30_000,
        retry: false,
    });

    if (isAuthPage || !profile) return null;

    const enabled = profile?.notificationPreferences?.realtimePopups !== false;

    return <NotificationPopupManager enabled={enabled} />;
}


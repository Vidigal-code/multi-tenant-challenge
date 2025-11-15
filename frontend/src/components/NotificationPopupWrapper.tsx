"use client";
import React from 'react';
import { NotificationPopupManager } from './NotificationPopupManager';
import { useQuery } from '@tanstack/react-query';
import { http } from '../lib/http';
import { queryKeys } from '../lib/queryKeys';
import { usePathname } from 'next/navigation';

export function NotificationPopupWrapper() {
    const pathname = usePathname();
    
    // Não fazer requisições em páginas de autenticação
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
        enabled: !isAuthPage, // Desabilitar query em páginas de autenticação
        staleTime: 30_000,
        retry: false,
    });

    // Não renderizar nada em páginas de autenticação ou se não houver perfil
    if (isAuthPage || !profile) return null;

    const enabled = profile?.notificationPreferences?.realtimePopups !== false;

    return <NotificationPopupManager enabled={enabled} />;
}


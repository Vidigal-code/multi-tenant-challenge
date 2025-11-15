"use client";
import React, { useEffect, useState } from 'react';
import { subscribe, whenReady, RT_EVENTS } from '../lib/realtime';
import { NotificationPopup } from './NotificationPopup';
import { NotificationData } from '../lib/notification-messages';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { http } from '../lib/http';

interface NotificationPopupManagerProps {
    enabled: boolean;
}

// Função para verificar se a notificação deve ser exibida baseada nas preferências de privacidade
function shouldShowNotification(notification: NotificationData, preferences: any): boolean {
    // Se não houver preferências, mostrar por padrão
    if (!preferences) return true;
    
    const kind = notification.meta?.kind || '';
    const title = (notification.title || '').toUpperCase();
    const body = (notification.body || '').toUpperCase();
    
    // Verificar preferências específicas baseadas no tipo de notificação
    // Convites de empresa
    if (kind === 'invite.created' || kind === 'invite.accepted' || kind === 'invite.rejected' || 
        title.includes('CONVITE') || title.includes('INVITE')) {
        return preferences.companyInvitations !== false;
    }
    
    // Solicitações de amizade
    if (kind === 'friend.request.sent' || kind === 'friend.request.accepted' || kind === 'friend.request.rejected' || 
        kind === 'friend.removed' || title.includes('AMIGO') || title.includes('FRIEND')) {
        return preferences.friendRequests !== false;
    }
    
    // Mensagens de empresa
    if (kind === 'notification.sent' || kind === 'notification.reply' || 
        title.includes('NOTIFICATION') || title.includes('MENSAGEM') || body.includes('MENSAGEM')) {
        return preferences.companyMessages !== false;
    }
    
    // Mudanças de membros
    if (kind === 'member.added' || kind === 'member.removed' || kind === 'membership.joined' || 
        kind === 'membership.removed' || title.includes('MEMBER') || title.includes('MEMBRO')) {
        return preferences.membershipChanges !== false;
    }
    
    // Mudanças de papel/role
    if (kind === 'role.changed' || kind === 'membership.role.updated' || 
        title.includes('ROLE') || title.includes('CARGO') || title.includes('PAPEL')) {
        return preferences.roleChanges !== false;
    }
    
    // Para outros tipos, mostrar por padrão se realtimePopups estiver habilitado
    return true;
}

export function NotificationPopupManager({ enabled }: NotificationPopupManagerProps) {
    const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
    const queryClient = useQueryClient();
    
    // Buscar preferências do usuário
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
        staleTime: 30_000,
        retry: false,
    });

    useEffect(() => {
        if (!enabled) {
            console.log('[NotificationPopupManager] Desabilitado');
            return;
        }

        console.log('[NotificationPopupManager] Inicializando...');
        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;
            console.log('[NotificationPopupManager] WebSocket pronto, inscrevendo em eventos...');

            let lastNotificationTime = 0;
            const THROTTLE_MS = 1000; // Throttle de 1 segundo entre notificações

            const handleNotification = async (payload: any) => {
                if (!active) return;
                
                console.log('[NotificationPopupManager] Evento recebido:', payload);
                
                // Throttle para evitar muitas requisições
                const now = Date.now();
                if (now - lastNotificationTime < THROTTLE_MS) {
                    console.log('[NotificationPopupManager] Throttled, ignorando evento');
                    return;
                }
                lastNotificationTime = now;
                
                try {
                    // Verificar preferências primeiro (antes de buscar notificação)
                    const preferences = profile?.notificationPreferences || {};
                    const realtimePopupsEnabled = preferences.realtimePopups !== false;
                    
                    if (!realtimePopupsEnabled) {
                        console.log('[NotificationPopupManager] Popups em tempo real desabilitados');
                        return;
                    }
                    
                    // Se o payload tem notificationId, buscar a notificação específica
                    let notification: NotificationData | null = null;
                    
                    if (payload.notificationId) {
                        // Primeiro, tentar buscar do cache sem fazer requisição
                        const cachedNotifications = queryClient.getQueryData<NotificationData[]>(queryKeys.notifications());
                        notification = cachedNotifications?.find(n => n.id === payload.notificationId) || null;
                        
                        // Se não estiver no cache, buscar todas as notificações (mas com cache)
                        if (!notification) {
                            console.log('[NotificationPopupManager] Notificação não encontrada no cache, buscando...');
                            const notifications = await queryClient.fetchQuery<NotificationData[]>({
                                queryKey: queryKeys.notifications(),
                                queryFn: async () => {
                                    const response = await http.get('/notifications');
                                    return (response.data.items ?? []) as NotificationData[];
                                },
                                staleTime: 5000, // Cache por 5 segundos para evitar requisições repetidas
                            });
                            notification = notifications?.find(n => n.id === payload.notificationId) || null;
                        }
                    } else {
                        // Se não tem notificationId, invalidar cache e buscar a notificação mais recente
                        console.log('[NotificationPopupManager] Evento sem notificationId, buscando notificação mais recente...');
                        queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                        const notifications = await queryClient.fetchQuery<NotificationData[]>({
                            queryKey: queryKeys.notifications(),
                            queryFn: async () => {
                                const response = await http.get('/notifications');
                                return (response.data.items ?? []) as NotificationData[];
                            },
                            staleTime: 5000,
                        });
                        // Pegar a notificação mais recente (primeira da lista)
                        notification = notifications && notifications.length > 0 ? notifications[0] : null;
                    }
                    
                    if (notification) {
                        console.log('[NotificationPopupManager] Notificação encontrada:', notification);
                        
                        // Verificar preferências de privacidade antes de exibir
                        if (shouldShowNotification(notification, preferences)) {
                            console.log('[NotificationPopupManager] Exibindo popup para notificação');
                            setCurrentNotification(notification);
                            
                            // Invalidar cache de notificações para atualizar a lista
                            queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                            
                            // Auto-fechar após 10 segundos
                            setTimeout(() => {
                                if (active) {
                                    setCurrentNotification(null);
                                }
                            }, 10000);
                        } else {
                            console.log('[NotificationPopupManager] Notificação filtrada pelas preferências de privacidade');
                        }
                    } else {
                        console.log('[NotificationPopupManager] Notificação não encontrada, invalidando cache');
                        // Se não encontrou, invalidar cache para buscar na próxima vez
                        queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
                    }
                } catch (error) {
                    console.error('[NotificationPopupManager] Erro ao buscar notificação:', error);
                }
            };

            // Inscrever em todos os eventos de notificação relevantes
            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, handleNotification));
            
            // Também escutar eventos de convite, amizade, etc que geram notificações
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_ACCEPTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_REJECTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_SENT, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_ACCEPTED, handleNotification));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REMOVED, handleNotification));
            
            console.log('[NotificationPopupManager] Inscrito em todos os eventos');
        });

        return () => {
            console.log('[NotificationPopupManager] Limpando subscriptions...');
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [enabled, queryClient, profile]);

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


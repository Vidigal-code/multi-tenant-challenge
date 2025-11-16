"use client";
import React, {useEffect, useState} from 'react';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import {useQueryClient} from '@tanstack/react-query';
import Skeleton from '../../components/skeleton/Skeleton';
import {queryKeys} from '../../lib/queryKeys';
import {ConfirmModal} from '../../components/modals/ConfirmModal';
import {subscribe, whenReady, RT_EVENTS} from '../../lib/realtime';
import {formatNotificationMessage, getNotificationStyle, NotificationData} from '../../lib/notification-messages';
import {formatDate} from '../../lib/date-utils';
import {
    useNotifications,
    useMarkNotificationRead,
    useDeleteNotification,
    useReplyToNotification,
    type Notification,
} from '../../services/api/notification.api';

function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function NotificationsPage() {

    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
    const {show} = useToast();
    const queryClient = useQueryClient();

    const {data: notifications = [], isLoading} = useNotifications();

    useEffect(() => {
        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;
            const refetch = () => queryClient.invalidateQueries({queryKey: queryKeys.notifications()});
            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_READ, refetch));
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [queryClient]);

    const markReadMutation = useMarkNotificationRead();
    const deleteMutation = useDeleteNotification();
    const replyMutation = useReplyToNotification();

    const handleReply = () => {
        if (!replyBody.trim()) {
            show({message: 'Por favor escreva uma resposta', type: 'error'});
            return;
        }
        if (!replyingTo) return;
        replyMutation.mutate({id: replyingTo, body: replyBody.trim()}, {
            onSuccess: () => {
                setReplyingTo(null);
                setReplyBody('');
                show({message: 'Resposta enviada', type: 'success'});
            },
            onError: (error) => {
                show({message: getErrorMessage(error), type: 'error'});
            },
        });
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Notificações</h1>
                    <p className="text-gray-600 dark:text-gray-400">Gerencie suas notificações e mensagens</p>
                </div>
                <Skeleton className="h-32 mb-4"/>
                <Skeleton className="h-32 mb-4"/>
                <Skeleton className="h-32"/>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Notificações</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas notificações e mensagens</p>
            </div>

            {notifications.length === 0 ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 sm:p-12 text-center bg-gray-50 dark:bg-gray-900">
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">Nenhuma notificação encontrada</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {notifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`border rounded-lg p-4 sm:p-6 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
                                notification.read 
                                    ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950' 
                                    : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span className={getNotificationStyle(notification.meta?.kind).color}>
                      {getNotificationStyle(notification.meta?.kind).icon}
                    </span>
                                        {formatNotificationMessage(notification)}
                                        {!notification.read && (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        Nova
                      </span>
                                        )}
                                        {notification.meta?.kind === 'notifications.reply' && (
                                            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Resposta
                      </span>
                                        )}
                                    </h3>
                                    <div className="text-sm text-gray-600 mt-2 space-y-1">
                                        <div className="bg-gray-50 p-2 rounded">
                                            <div>
                                                <strong>De:</strong> {notification.meta?.sender?.name || 'Usuário Desconhecido'}
                                            </div>
                                            <div>
                                                <strong>Email:</strong> {notification.meta?.sender?.email || notification.senderUserId || 'N/A'}
                                            </div>
                                            <div><strong>Data e Hora:</strong> {notification.createdAt ? formatDate(notification.createdAt) : '-'}
                                            </div>
                                            {notification.meta?.channel && (
                                                <div><strong>Canal:</strong> {notification.meta.channel}</div>
                                            )}
                                            {notification.companyId && (
                                                <div><strong>ID da Empresa:</strong> {notification.companyId}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3 sm:mt-0 sm:ml-4">
                                    {!notification.read && (
                                        <button
                                            onClick={() => markReadMutation.mutate(notification.id, {
                                                onSuccess: () => {
                                                    show({message: 'Notificação marcada como lida', type: 'success'});
                                                },
                                                onError: (error) => {
                                                    show({message: getErrorMessage(error), type: 'error'});
                                                },
                                            })}
                                            className="px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
                                            disabled={markReadMutation.isPending}
                                        >
                                            Marcar como lida
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setReplyingTo(notification.id)}
                                        className="px-3 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium whitespace-nowrap"
                                    >
                                        Responder
                                    </button>
                                    <button
                                        onClick={() => setDeleteConfirm(notification.id)}
                                        className="px-3 py-2 text-xs sm:text-sm border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium whitespace-nowrap"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>
                            <div className="mt-3">
                                <p className="text-gray-700">
                                    {expandedNotifications[notification.id] ? notification.body : truncate(notification.body, 400)}
                                    {notification.body.length > 400 && (
                                        <button
                                            className="text-blue-600 underline ml-2 text-sm"
                                            onClick={() =>
                                                setExpandedNotifications((prev) => ({
                                                    ...prev,
                                                    [notification.id]: !prev[notification.id],
                                                }))
                                            }
                                        >
                                            {expandedNotifications[notification.id] ? 'Mostrar menos' : 'Ler mais'}
                                        </button>
                                    )}
                                </p>
                                {notification.meta?.kind === 'notifications.reply' && (
                                    <div className="mt-2 text-xs text-gray-500 italic">
                                        Esta é uma resposta a uma notificação anterior
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {replyingTo && (
                <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 z-[9999]">
                    <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Responder Notificação</h3>
                        {(() => {
                            const notification = notifications.find(n => n.id === replyingTo);
                            return notification ? (
                                <div className="mb-4 space-y-3 p-4 bg-gray-50 rounded border">
                                    <div className="space-y-1">
                                        <div className="text-sm">
                                            <strong>Assunto:</strong> <span
                                            className="text-gray-700">{notification.title}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>De:</strong>
                                            <span
                                                className="text-gray-700">{notification.meta?.sender?.name || 'Usuário Desconhecido'}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>Email:</strong>
                                            <span
                                                className="text-gray-700">{notification.meta?.sender?.email || notification.senderUserId || 'N/A'}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>Data & Hora:</strong>
                                            <span
                                                className="text-gray-700">{new Date(notification.createdAt).toLocaleString()}</span>
                                        </div>
                                        {notification.companyId && (
                                            <div className="text-sm">
                                                <strong>ID da Empresa:</strong>
                                                <span className="text-gray-700">{notification.companyId}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 pt-3 border-t">
                                        <strong className="text-sm">Mensagem Original:</strong>
                                        <p className="text-sm text-gray-700 mt-1 p-2 bg-white rounded">{notification.body}</p>
                                    </div>
                                </div>
                            ) : null;
                        })()}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Sua Resposta</label>
                            <textarea
                                placeholder="Digite sua resposta..."
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                className="w-full p-2 border rounded resize-none"
                                rows={4}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Sua resposta será enviada para: {(() => {
                                const notification = notifications.find(n => n.id === replyingTo);
                                return notification ? (
                                    <span className="font-medium">
                      {notification.meta?.sender?.name || 'Desconhecido'} ({notification.meta?.sender?.email || notification.senderUserId || 'N/A'})
                    </span>
                                ) : 'o remetente original';
                            })()}
                            </p>
                        </div>
                        <div className="flex gap-3 justify-end mt-4">
                            <button
                                onClick={() => {
                                    setReplyingTo(null);
                                    setReplyBody('');
                                }}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={replyMutation.isPending}
                                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                                {replyMutation.isPending ? 'Enviando...' : 'Enviar Resposta'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                open={!!deleteConfirm}
                title="Excluir Notificação"
                onConfirm={() => {
                    if (deleteConfirm) {
                        deleteMutation.mutate(deleteConfirm, {
                            onSuccess: () => {
                                setDeleteConfirm(null);
                                show({message: 'Notificação excluída', type: 'success'});
                            },
                            onError: (error) => {
                                show({message: getErrorMessage(error), type: 'error'});
                            },
                        });
                    }
                }}
                onCancel={() => setDeleteConfirm(null)}
            >
                Tem certeza que deseja excluir esta notificação? Esta ação não pode ser desfeita.
            </ConfirmModal>
        </div>
    );
}

"use client";
import React from 'react';
import { NotificationData } from '../lib/notification-messages';
import { formatNotificationMessage, getNotificationStyle } from '../lib/notification-messages';
import { formatDate } from '../lib/date-utils';
import { useRouter } from 'next/navigation';

interface NotificationPopupProps {
    notification: NotificationData;
    onClose: () => void;
    onNavigate: () => void;
}

export function NotificationPopup({ notification, onClose, onNavigate }: NotificationPopupProps) {
    const router = useRouter();
    const style = getNotificationStyle(notification.meta?.kind);
    const message = formatNotificationMessage(notification);

    const handleClick = () => {
        onNavigate();
        router.push('/notifications');
    };

    return (
        <div 
            className="fixed bottom-4 right-4 z-[10000] max-w-md w-full bg-white border border-gray-300 rounded-lg shadow-lg p-4 animate-slide-up cursor-pointer hover:shadow-xl transition-shadow"
            onClick={handleClick}
        >
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${style.color}`}>
                    {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 truncate flex items-center gap-1">
                            {notification.meta?.kind && <span className="flex items-center">{style.icon}</span>}
                            {notification.title || 'Nova Notificação'}
                        </h3>
                        <button
                            onClick={(e) => {
                                e.stopPropagation(); // Prevenir que o clique no X dispare o handleClick
                                onClose();
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
                            aria-label="Fechar"
                        >
                            <span className="text-lg">✕</span>
                        </button>
                    </div>
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{message}</p>
                    <div className="text-xs text-gray-500 mb-2">
                        {notification.meta?.sender && (
                            <div>
                                <strong>De:</strong> {notification.meta.sender.name} ({notification.meta.sender.email})
                            </div>
                        )}
                        <div>
                            <strong>Data:</strong> {formatDate(notification.createdAt)}
                        </div>
                        {notification.meta?.companyName && (
                            <div>
                                <strong>Empresa:</strong> {notification.meta.companyName}
                            </div>
                        )}
                    </div>
                    <div className="text-sm text-blue-600 hover:text-blue-800 underline">
                        Clique para ver todas as notificações →
                    </div>
                </div>
            </div>
        </div>
    );
}


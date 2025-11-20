"use client";
import React from 'react';
import { NotificationData } from '../../lib/notification-messages';
import { formatNotificationMessage, getNotificationStyle, removeEventCodeFromTitle } from '../../lib/notification-messages';
import { formatDate } from '../../lib/date-utils';
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
    
    // Use the new formatter to clean up the body preview if needed
    // For the popup, we stick to the simplified message, but we could enhance it
    // if the message is too generic.

    const handleIgnore = (e: React.MouseEvent) => {
        e.stopPropagation();
        onClose();
    };

    const handleViewMessage = (e: React.MouseEvent) => {
        e.stopPropagation();
        onNavigate();
        onClose();
        router.push('/notifications');
    };

    return (
        <div 
            className="fixed bottom-4 right-4 z-[10002] max-w-md w-[calc(100vw-2rem)] sm:w-full sm:max-w-sm bg-white
            dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl p-3 sm:p-4
            animate-slide-up hover:shadow-2xl transition-shadow mx-4 sm:mx-0"
        >
            <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl ${style.color}`}>
                    {style.icon}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate flex items-center gap-1">
                            {notification.meta?.kind && <span className="flex items-center">{style.icon}</span>}
                            {removeEventCodeFromTitle(notification.title || 'Nova Notificação')}
                        </h3>
                        <button
                            onClick={handleIgnore}
                            className="flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-900
                            dark:hover:text-white text-lg leading-none transition-colors"
                            aria-label="Fechar"
                        >
                            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round"
                                 strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2 line-clamp-2">{message}</p>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 space-y-1">
                        {(notification.meta?.sender || notification.sender) && (
                            <div>
                                <strong className="text-gray-700 dark:text-gray-300">De:</strong> <span className="text-gray-600
                                dark:text-gray-400">{(notification.meta?.sender?.name || notification.sender?.name)} ({notification.meta?.sender?.email || notification.sender?.email})</span>
                            </div>
                        )}
                        <div>
                            <strong className="text-gray-700 dark:text-gray-300">Data:</strong> <span className="text-gray-600
                            dark:text-gray-400">{formatDate(notification.createdAt)}</span>
                        </div>
                        {notification.meta?.companyName && (
                            <div>
                                <strong className="text-gray-700 dark:text-gray-300">Empresa:</strong> <span className="text-gray-600
                                dark:text-gray-400">{notification.meta.companyName}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2 mt-3 flex-col sm:flex-row">
                        <button
                            onClick={handleIgnore}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100
                            dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Ignorar
                        </button>
                        <button
                            onClick={handleViewMessage}
                            className="flex-1 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 dark:bg-blue-500
                            hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg transition-colors"
                        >
                            Ver Mensagem
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

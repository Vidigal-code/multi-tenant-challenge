"use client";
import React from 'react';
import {useToast} from '../../hooks/useToast';

const COLORS: Record<string, string> = {
    success: 'bg-green-600 dark:bg-green-500 text-white dark:text-white',
    error: 'bg-red-600 dark:bg-red-500 text-white dark:text-white',
    info: 'bg-blue-600 dark:bg-blue-500 text-white dark:text-white',
    warning: 'bg-yellow-600 dark:bg-yellow-500 text-black dark:text-gray-900',
};

export function ToastContainer() {
    const {toasts, dismiss} = useToast();
    return (
        <div className="fixed top-4 right-4 z-[10002] space-y-2 w-full
        sm:w-72 max-w-sm px-4 sm:px-0">
            {toasts.map(t => (
                <div key={t.id}
                     className={`rounded-lg shadow-xl border border-white/20 
                     dark:border-white/20 px-4 py-3 text-sm flex flex-col gap-1 transition-opacity animate-slide-up ${COLORS[t.type || 'info']}`}>
                    {t.title && <p className="font-semibold">{t.title}</p>}
                    <p>{t.message}</p>
                    <button aria-label="close" onClick={() => dismiss(t.id)}
                            className="self-end text-xs opacity-70 hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            ))}
        </div>
    );
}

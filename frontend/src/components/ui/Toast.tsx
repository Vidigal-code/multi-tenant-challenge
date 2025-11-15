"use client";
import React from 'react';
import {useToast} from '../../hooks/useToast';

const COLORS: Record<string, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-600 text-black',
};

export function ToastContainer() {
    const {toasts, dismiss} = useToast();
    return (
        <div className="fixed top-4 right-4 z-50 space-y-2 w-72">
            {toasts.map(t => (
                <div key={t.id}
                     className={`rounded shadow text-white px-4 py-3 text-sm flex flex-col gap-1 transition-opacity ${COLORS[t.type || 'info']}`}>
                    {t.title && <p className="font-semibold">{t.title}</p>}
                    <p>{t.message}</p>
                    <button aria-label="close" onClick={() => dismiss(t.id)}
                            className="self-end text-xs opacity-70 hover:opacity-100">✕
                    </button>
                </div>
            ))}
        </div>
    );
}

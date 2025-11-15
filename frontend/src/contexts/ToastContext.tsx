"use client";

import React, {createContext, useCallback, useMemo, useRef, useState} from 'react';

export type Toast = {
    id: string;
    title?: string;
    message: string;
    type?: 'success' | 'error' | 'info' | 'warning';
    duration?: number;
};

export type ToastContextValue = {
    toasts: Toast[];
    show: (toast: Omit<Toast, 'id'>) => string;
    dismiss: (id: string) => void;
    clear: () => void;
};

export const ToastContext =
    createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({children}: { children: React.ReactNode }) {

    const [toasts, setToasts] = useState<Toast[]>([]);
    const idSeq = useRef(0);

    const dismiss = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const show = useCallback((t: Omit<Toast, 'id'>) => {
        const id = `${Date.now()}_${idSeq.current++}`;
        const toast: Toast = {id, duration: 4000, type: 'info', ...t};
        setToasts((prev) => {
            const next = [...prev, toast];
            if (next.length > 5) next.shift();
            return next;
        });
        if (toast.duration && toast.duration > 0) {
            setTimeout(() => dismiss(id), toast.duration);
        }
        return id;
    }, [dismiss]);

    const clear =
        useCallback(() => setToasts([]), []);

    const value =
        useMemo(() => ({toasts, show, dismiss, clear}), [toasts, show, dismiss, clear]);

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

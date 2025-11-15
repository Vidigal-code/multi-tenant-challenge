"use client";

import {useContext} from 'react';
import {ToastContext} from '../contexts/ToastContext';

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) {
        const noop = () => {
        };
        const empty = [] as any[];
        return {toasts: empty, show: (_: any) => '', dismiss: noop, clear: noop};
    }
    return ctx;
}

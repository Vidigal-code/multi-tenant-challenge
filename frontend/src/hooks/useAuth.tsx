"use client";

import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setAuthenticated, logoutState } from '../store/slices/authSlice';
import { http } from '../lib/http';

function readCookie(name: string) {
    if (typeof document === 'undefined') return undefined;
    const m = document.cookie.match(new RegExp('(?:^|; )' +
        name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
}

export function useAuth() {
    const dispatch = useDispatch();
    const isAuthenticated =
        useSelector((s: RootState) => s.auth.isAuthenticated);

    const login = useCallback(async (email: string, password: string) => {
        await http.post('/auth/login', { email: email.trim(), password });
        dispatch(setAuthenticated(true));
    }, [dispatch]);

    const signup =
        useCallback(async (email: string, password: string, name: string) => {
        await http.post('/auth/signup', { email: email.trim(), password, name: name.trim() });
        dispatch(setAuthenticated(true));
    }, [dispatch]);

    const logout =
        useCallback(async () => {
        try { await fetch('/api/logout', { method: 'POST' }); } catch {}
        dispatch(logoutState());
        try { if (typeof window !== 'undefined') window.location.assign('/login'); } catch {}
    }, [dispatch]);

    return { isAuthenticated, login, signup, logout, setAuthenticated: (v: boolean) => dispatch(setAuthenticated(v)) };
}

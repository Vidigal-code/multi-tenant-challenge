"use client";
import React, {createContext, useCallback, useEffect, useMemo, useState} from 'react';
import {http} from '../lib/http';
import {SESSION_COOKIE} from '../lib/config';

type AuthContextType = {
    isAuthenticated: boolean;
    setAuthenticated: (v: boolean) => void;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    setAuthenticated: () => {
    },
    async login() {
    },
    async logout() {
    },
});

function readCookie(name: string) {
    if (typeof document === 'undefined') return undefined;
    const m = document.cookie.match(new RegExp('(?:^|; )' +
        name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : undefined;
}

export function AuthProvider({children}: { children: React.ReactNode }) {
    const [isAuthenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        const has = !!readCookie(SESSION_COOKIE);
        setAuthenticated(has);
    }, []);

    const login =
        useCallback(async (email: string, password: string) => {
            await http.post('/auth/login', {email: email.trim(), password});
            setAuthenticated(true);
        }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/logout', {method: 'POST'});
        } catch {
        }
        try {
            if (typeof window !== 'undefined') window.location.assign('/login');
        } catch {
        }
        setAuthenticated(false);
    }, []);

    const value = useMemo(() => ({isAuthenticated, setAuthenticated, login, logout}), [isAuthenticated, login, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

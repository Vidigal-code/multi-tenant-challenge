"use client";

import axios, {AxiosError, AxiosHeaders, InternalAxiosRequestConfig} from 'axios';

const rawApi = process.env.NEXT_PUBLIC_API_URL;
const API_BASE = rawApi && rawApi !== 'undefined' && rawApi !== 'null' ? rawApi : 'http://localhost:4000';

function readCookie(name: string) {
    if (typeof document === 'undefined') return undefined;

    const m = document.cookie.match(new RegExp('(?:^|; )' +
        name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'));

    return m ? decodeURIComponent(m[1]) : undefined;
}

export const api = axios.create({baseURL: API_BASE, withCredentials: true});

type TimedConfig = InternalAxiosRequestConfig & { __startedAt?: number };

api.interceptors.request.use((config: TimedConfig) => {
    const csrf = readCookie('csrfToken');
    if (csrf) {
        if (!config.headers) config.headers = new AxiosHeaders();
        (config.headers as AxiosHeaders).set('X-CSRF-Token', csrf);
    }
    if (process.env.NODE_ENV !== 'test') {
        config.__startedAt = Date.now();
    }
    return config;
});

let isRedirecting = false;

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error: AxiosError<any>) => {

        const status = error.response?.status;
        const message = (error.response?.data as any)?.message || error.message || 'REQUEST_FAILED';
        if (message && typeof message === 'string') {
            (error as any).message = message;
        }

        if (typeof window !== 'undefined' && status === 401 && !isRedirecting) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login' && currentPath !== '/signup') {
                isRedirecting = true;
                try {
                    window.location.assign('/login');
                } catch {
                    isRedirecting = false;
                }
            }
        }

        return Promise.reject(error);
    }
);

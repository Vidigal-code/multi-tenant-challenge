import './globals.css';
import React from 'react';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {SESSION_COOKIE} from '../lib/config';
import {ToastProvider} from '../contexts/ToastContext';
import Providers from './providers';
import {ToastContainer} from '../components/ui/Toast';
import NavAuthMenu from '../components/NavAuthMenu';
import {NotificationPopupWrapper} from '../components/NotificationPopupWrapper';
import {Footer} from '../components/Footer';

export const metadata = {title: 'Multi-Tenant Dashboard'};

export default function RootLayout({children}: { children: React.ReactNode }) {
    const cookieStore = cookies();
    const isAuth = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
    return (
        <html lang="pt-BR">
        <body className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Providers initialAuth={isAuth}>
            <ToastProvider>
                <header className="border-b bg-white dark:bg-gray-900 dark:border-gray-800">
                    <div className="max-w-4xl mx-auto flex items-center justify-between py-3 px-4">
                        <Link href="/" className="font-semibold text-gray-900 dark:text-gray-100">Altaa Multi-Tenant</Link>
                        <NavAuthMenu initialAuth={isAuth} />
                    </div>
                </header>
                <div className="flex flex-col min-h-screen">
                    <div className="flex-1 max-w-4xl mx-auto w-full py-6 px-4">{children}</div>
                    <Footer/>
                </div>
                <ToastContainer/>
                <NotificationPopupWrapper/>
            </ToastProvider>
        </Providers>
        </body>
        </html>
    );
}

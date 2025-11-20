import './globals.css';
import React from 'react';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {SESSION_COOKIE} from '../lib/config';
import {ToastProvider} from '../contexts/ToastContext';
import Providers from './providers';
import {ToastContainer} from '../components/ui/Toast';
import NavAuthMenu from '../components/nav/NavAuthMenu';
import {NotificationPopupWrapper} from '../components/notification/NotificationPopupWrapper';
import {Footer} from '../components/footer/Footer';

export const metadata = {title: 'Multi-Tenant Dashboard'};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const cookieStore = await cookies();
    const isAuth = Boolean(cookieStore.get(SESSION_COOKIE)?.value);

    return (
        <html lang="pt-BR" suppressHydrationWarning>
        <head>
            <script
                dangerouslySetInnerHTML={{
                    __html: `
                        (function() {
                            try {
                                const savedTheme = localStorage.getItem('theme');
                                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                                const theme = savedTheme || (prefersDark ? 'dark' : 'light');
                                if (theme === 'dark') {
                                    document.documentElement.classList.add('dark');
                                } else {
                                    document.documentElement.classList.remove('dark');
                                }
                            } catch (e) {}
                        })();
                    `,
                }}
            />
        </head>
        <body className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50 antialiased">
        <Providers initialAuth={isAuth}>
            <ToastProvider>
                <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 dark:border-gray-800
                bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                        <Link href="/" className="font-semibold text-gray-900 dark:text-gray-50 text-lg whitespace-nowrap flex-shrink-0">Multi-Tenant</Link>
                        <div className="flex-1 flex justify-end min-w-0">
                            <NavAuthMenu initialAuth={isAuth} />
                        </div>
                    </div>
                </header>
                <div className="flex flex-col min-h-screen pt-16 overflow-x-hidden">
                    <div className="flex-1 w-full min-w-0">{children}</div>
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

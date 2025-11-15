"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ThemeToggle } from './ThemeToggle';

export function MobileMenu({ initialAuth }: { initialAuth: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const storeAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
    const isAuth = typeof storeAuth === 'boolean' ? storeAuth : initialAuth;
    const { logout } = useAuth();

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Toggle menu"
                type="button"
            >
                <span className="text-2xl">{isOpen ? '✕' : '☰'}</span>
            </button>
            {isOpen && (
                <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setIsOpen(false)}>
                    <div
                        className="bg-white dark:bg-gray-900 w-64 h-full shadow-lg p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-lg">Menu</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                                type="button"
                            >
                                <span className="text-xl">✕</span>
                            </button>
                        </div>
                        <nav className="flex flex-col gap-2">
                            {isAuth ? (
                                <>
                                    <Link
                                        href="/dashboard"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Dashboard
                                    </Link>
                                    <Link
                                        href="/profile"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Perfil
                                    </Link>
                                    <Link
                                        href="/invites"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Convites
                                    </Link>
                                    <Link
                                        href="/friends"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Amigos
                                    </Link>
                                    <Link
                                        href="/notifications"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Notificações
                                    </Link>
                                    <div className="border-t my-2"></div>
                                    <button
                                        onClick={() => {
                                            void logout();
                                            setIsOpen(false);
                                        }}
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                                        type="button"
                                    >
                                        Sair
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Entrar
                                    </Link>
                                    <Link
                                        href="/signup"
                                        className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        Criar Conta
                                    </Link>
                                </>
                            )}
                            <div className="border-t my-2"></div>
                            <div className="px-3 py-2">
                                <ThemeToggle />
                            </div>
                        </nav>
                    </div>
                </div>
            )}
        </>
    );
}


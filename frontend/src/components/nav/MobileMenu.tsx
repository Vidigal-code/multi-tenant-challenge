"use client";

import React, {useState, useEffect} from 'react';
import Link from 'next/link';
import {useAuth} from '../../hooks/useAuth';
import {useDispatch, useSelector} from 'react-redux';
import type {RootState} from '../../store';
import {toggleTheme} from "../../store/slices/themeSlice";
import {FiMoon, FiSun} from "react-icons/fi";

export function MobileMenu({initialAuth}: { initialAuth: boolean }) {

    const [isOpen, setIsOpen] = useState(false);
    const storeAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
    const isAuth = typeof storeAuth === 'boolean' ? storeAuth : initialAuth;
    const {logout} = useAuth();
    const dispatch = useDispatch();
    const theme = useSelector((state: RootState) => state.theme.theme);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors flex-shrink-0"
                aria-label="Toggle menu"
                aria-expanded={isOpen}
                type="button"
            >
                {isOpen ? (
                    <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" strokeLinecap="round"
                         strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                ) : (
                    <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" strokeLinecap="round"
                         strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M4 6h16M4 12h16M4 18h16"></path>
                    </svg>
                )}
            </button>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[10003] bg-black/70 dark:bg-black/90 backdrop-blur-md transition-all duration-300 opacity-100 pointer-events-auto"
                        onClick={() => setIsOpen(false)}
                        aria-hidden="true"
                    />
                    <div
                        className={`fixed inset-0 z-[10004] bg-white dark:bg-black w-full    
                         ${isAuth ? "min-h-[554px]" : "min-h-[320px]"}  h-full shadow-2xl transition-all duration-300 ease-out overflow-y-auto border-l border-gray-200 dark:border-gray-800"`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-6 relative h-full flex flex-col">

                            <div
                                className="flex items-center justify-between mb-2 pb-4 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-1 h-8 bg-gray-900 dark:bg-gray-100 rounded-full"></div>
                                    <h2 className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight">Menu</h2>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-900 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm border border-gray-200 dark:border-gray-800"
                                    type="button"
                                    aria-label="Close menu"
                                >
                                    <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none"
                                         strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"
                                         viewBox="0 0 24 24" stroke="currentColor">
                                        <path d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>

                            <nav className="flex flex-col gap-2">

                                <div
                                    className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                    onClick={() => dispatch(toggleTheme())}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    {theme === 'light' ? (
                                        <FiMoon className="w-5 h-5"/>
                                    ) : (
                                        <FiSun className="w-5 h-5"/>
                                    )}
                                </div>


                                {isAuth ? (
                                    <>
                                        <Link
                                            href="/dashboard"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Dashboard</span>
                                        </Link>
                                        <Link
                                            href="/profile"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Perfil</span>
                                        </Link>
                                        <Link
                                            href="/invites"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Convites</span>
                                        </Link>
                                        <Link
                                            href="/friends"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Amigos</span>
                                        </Link>
                                        <Link
                                            href="/notifications"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Notificações</span>
                                        </Link>

                                        <button
                                            onClick={() => {
                                                void logout();
                                                setIsOpen(false);
                                            }}
                                            className="px-5 py-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-200 text-left font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] border border-gray-900 dark:border-white"
                                            type="button"
                                        >
                                            Sair
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            href="/login"
                                            className="group px-5 py-4 rounded-xl bg-gray-50 hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-all duration-200 border border-gray-200 dark:border-gray-800 hover:shadow-md flex items-center gap-3"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            <div
                                                className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <span className="font-medium">Entrar</span>
                                        </Link>
                                        <Link
                                            href="/signup"
                                            className="px-5 py-4 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 transition-all duration-200 text-center font-semibold mt-2 shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] border border-gray-900 dark:border-white"
                                            onClick={() => setIsOpen(false)}
                                        >
                                            Criar Conta
                                        </Link>
                                    </>
                                )}
                                <h2 className="font-bold text-2xl text-gray-900 dark:text-white tracking-tight"></h2>
                            </nav>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}


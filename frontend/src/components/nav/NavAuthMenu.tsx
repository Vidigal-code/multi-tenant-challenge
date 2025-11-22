"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { ThemeToggle } from '../themes/ThemeToggle';
import { MobileMenu } from './MobileMenu';

export default function NavAuthMenu({ initialAuth }: { initialAuth: boolean }) {

    const storeAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
  const isAuth = useMemo(() => (typeof storeAuth === 'boolean' ? storeAuth : initialAuth) || initialAuth, [storeAuth, initialAuth]);

  const { logout } = useAuth();

  return (
    <>
      <nav className="hidden md:flex items-center gap-6 text-sm overflow-x-auto scrollbar-hide">
        {isAuth ? (
          <>
          <Link href="/dashboard" className="whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-900
          dark:hover:text-white transition-colors">Dashboard</Link>
          <Link href="/profile" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Perfil</Link>
          <Link href="/invites" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Convites</Link>
          <Link href="/friends" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Amigos</Link>
          <Link href="/notifications" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Notificações</Link>
          <Link href="/info" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Info</Link>
          <Link href="/demo/chat" className="whitespace-nowrap text-gray-600 dark:text-gray-400
          hover:text-gray-900 dark:hover:text-white transition-colors">Demo Chat</Link>
          <ThemeToggle />
          <button onClick={() => { void logout(); }} className="whitespace-nowrap px-4 py-2 bg-gray-900 dark:bg-white text-white
          dark:text-gray-900 rounded-lg hover:bg-gray-800
          dark:hover:bg-gray-200 transition-colors font-medium" type="button">Sair</button>
        </>
        ) : (
          <>
          <Link href="/info" className="whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
          transition-colors">Info</Link>
          <Link href="/demo/chat" className="whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
          transition-colors">Demo Chat</Link>
          <Link href="/login" className="whitespace-nowrap text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white
           transition-colors">Entrar</Link>
          <Link href="/signup" className="whitespace-nowrap px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
          hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium">Criar Conta</Link>
          <ThemeToggle />
        </>
        )}
      </nav>
      <MobileMenu initialAuth={initialAuth} />
    </>
  );
}

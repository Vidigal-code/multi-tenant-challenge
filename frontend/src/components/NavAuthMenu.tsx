"use client";

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { ThemeToggle } from './ThemeToggle';
import { MobileMenu } from './MobileMenu';

export default function NavAuthMenu({ initialAuth }: { initialAuth: boolean }) {
  const storeAuth = useSelector((s: RootState) => s.auth.isAuthenticated);
  const isAuth = useMemo(() => (typeof storeAuth === 'boolean' ? storeAuth : initialAuth) || initialAuth, [storeAuth, initialAuth]);
  const { logout } = useAuth();

  return (
    <>
      <nav className="hidden md:flex items-center gap-3 text-sm">
        {isAuth ? (
          <>
          <Link href="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">Dashboard</Link>
          <Link href="/profile" className="hover:text-blue-600 dark:hover:text-blue-400">Perfil</Link>
          <Link href="/invites" className="hover:text-blue-600 dark:hover:text-blue-400">Convites</Link>
          <Link href="/friends" className="hover:text-blue-600 dark:hover:text-blue-400">Amigos</Link>
          <Link href="/notifications" className="hover:text-blue-600 dark:hover:text-blue-400">Notificações</Link>
          <ThemeToggle />
          <button onClick={() => { void logout(); }} className="px-3 py-1 border rounded hover:bg-gray-100 dark:hover:bg-gray-800" type="button">Sair</button>
        </>
        ) : (
          <>
          <Link href="/login" className="hover:text-blue-600 dark:hover:text-blue-400">Entrar</Link>
          <Link href="/signup" className="hover:text-blue-600 dark:hover:text-blue-400">Criar Conta</Link>
          <ThemeToggle />
        </>
        )}
      </nav>
      <MobileMenu initialAuth={initialAuth} />
    </>
  );
}

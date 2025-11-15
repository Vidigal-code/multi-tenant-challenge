"use client";
import React from 'react';
import Link from 'next/link';
import { useAuth } from '../hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

export default function HomePage() {
    const isAuth = useSelector((s: RootState) => s.auth.isAuthenticated);

    return (
        <div className="min-h-screen">
            <section className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-20 px-4">
                <div className="max-w-6xl mx-auto text-center">
                    <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                        Plataforma Multi-Tenant
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-8">
                        Gerencie múltiplas empresas, equipes e colaboradores em uma única plataforma
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        {isAuth ? (
                            <>
                                <Link
                                    href="/dashboard"
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                                >
                                    Ir para Dashboard
                                </Link>
                                <Link
                                    href="/company/new"
                                    className="px-8 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-semibold"
                                >
                                    Criar Nova Empresa
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/signup"
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                                >
                                    Começar Grátis
                                </Link>
                                <Link
                                    href="/login"
                                    className="px-8 py-3 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-2 border-blue-600 dark:border-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors font-semibold"
                                >
                                    Entrar
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section className="py-20 px-4 bg-white dark:bg-gray-900">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-4xl font-bold text-center mb-12 text-gray-900 dark:text-white">
                        Funcionalidades Principais
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">🏢</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Gestão de Empresas</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Crie e gerencie múltiplas empresas com controle total sobre membros, roles e permissões.
                            </p>
                        </div>
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">👥</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Sistema de Convites</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Convide membros por email com diferentes níveis de acesso (Owner, Admin, Member).
                            </p>
                        </div>
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">🔔</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Notificações em Tempo Real</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Receba notificações instantâneas sobre eventos importantes da sua empresa.
                            </p>
                        </div>
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">👫</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Rede de Amigos</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Conecte-se com outros usuários e envie mensagens globais para sua rede.
                            </p>
                        </div>
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">🔒</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Segurança Avançada</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Empresas privadas e públicas com controle granular de acesso e permissões.
                            </p>
                        </div>
                        <div className="p-6 border rounded-lg hover:shadow-lg transition-shadow dark:border-gray-800">
                            <div className="text-4xl mb-4">📱</div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">100% Responsivo</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Acesse de qualquer dispositivo com interface otimizada para mobile e desktop.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 px-4 bg-gray-50 dark:bg-gray-800">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
                        Como Funciona
                    </h2>
                    <div className="space-y-8 text-left">
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                                1
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Crie sua Conta</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Registre-se gratuitamente e comece a usar a plataforma imediatamente.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                                2
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Crie sua Primeira Empresa</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Adicione uma empresa, configure como pública ou privada e defina o logo.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                                3
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Convide Membros</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Envie convites por email e defina os níveis de acesso de cada membro.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl">
                                4
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Colabore e Gerencie</h3>
                                <p className="text-gray-600 dark:text-gray-400">
                                    Use notificações, mensagens globais e ferramentas de gestão para manter sua equipe sincronizada.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-20 px-4 bg-white dark:bg-gray-900">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl font-bold mb-6 text-gray-900 dark:text-white">
                        Pronto para Começar?
                    </h2>
                    <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
                        Junte-se a milhares de empresas que já usam nossa plataforma
                    </p>
                    {!isAuth && (
                        <Link
                            href="/signup"
                            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg"
                        >
                            Criar Conta Grátis
                        </Link>
                    )}
                </div>
            </section>
        </div>
    );
}

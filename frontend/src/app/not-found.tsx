"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdSearchOff, MdHome, MdArrowBack, MdInfo } from "react-icons/md";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900
        dark:to-slate-950 px-6 py-16">
            <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200/70 dark:border-white/10
            bg-white/90 dark:bg-white/5 shadow-2xl backdrop-blur-xl p-10">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-blue-100
                         bg-blue-50 dark:bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-200">
                            <MdSearchOff className="text-lg" />
                            Not found
                        </span>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">404 — Página não encontrada</h1>
                        <p className="text-gray-600 dark:text-gray-300">
                            Talvez o link esteja desatualizado ou você não tenha permissão para visualizar. Continue navegando pelos atalhos abaixo ou retorne à página anterior.
                        </p>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 pt-2">
                            <button
                                onClick={() => router.back()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-white/20 bg-white
                                dark:bg-gray-950 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white shadow-sm
                                hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                            >
                                <MdArrowBack className="text-lg" />
                                Voltar
                            </button>
                            <Link
                                href="/"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl
                                bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 transition-colors"
                            >
                                <MdHome className="text-lg" />
                                Ir para o início
                            </Link>
                            <Link
                                href="/info"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border
                                border-gray-200 dark:border-white/20 bg-white dark:bg-gray-950 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white shadow-sm
                                 hover:border-blue-400 hover:text-blue-600
                                dark:hover:text-blue-300 transition-colors"
                            >
                                <MdInfo className="text-lg" />
                                Conhecer o sistema
                            </Link>
                        </div>
                    </div>

                    <div className="flex-1">
                        <div className="rounded-3xl border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 shadow-inner p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Atalhos rápidos</h2>
                            <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                <li className="rounded-2xl bg-gray-50 dark:bg-white/5 px-4 py-3 border border-gray-100 dark:border-white/10">
                                    Dashboard, Perfil, Convites, Amigos e Notificações ficam no menu principal para usuários autenticados.
                                </li>
                                <li className="rounded-2xl bg-gray-50 dark:bg-white/5 px-4 py-3 border border-gray-100 dark:border-white/10">
                                    A página <strong>/info</strong> contém o resumo da arquitetura, preferências e pipeline RabbitMQ + Redis.
                                </li>
                                <li className="rounded-2xl bg-gray-50 dark:bg-white/5 px-4 py-3 border border-gray-100 dark:border-white/10">
                                    Se o problema persistir, verifique se você tem permissão para acessar o recurso ou se o link está correto.
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

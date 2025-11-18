"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MdSearchOff, MdHome, MdArrowBack, MdInfo } from "react-icons/md";

export default function NotFound() {
    const router = useRouter();

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-6 py-12">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-500/20">
                    <MdSearchOff className="text-5xl text-blue-300" />
                </div>
                <h1 className="text-3xl font-bold text-white">404 • Página não encontrada</h1>
                <p className="mt-3 text-base text-slate-200">
                    Talvez o link esteja desatualizado ou você não tenha permissão para acessar. Use os atalhos abaixo para continuar navegando.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:border-white transition-colors"
                    >
                        <MdArrowBack className="text-lg" />
                        Voltar
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-blue-600 transition-colors"
                    >
                        <MdHome className="text-lg" />
                        Ir para o início
                    </Link>
                    <Link
                        href="/info"
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-medium text-white hover:border-white transition-colors"
                    >
                        <MdInfo className="text-lg" />
                        Conhecer o sistema
                    </Link>
                </div>
            </div>
        </div>
    );
}

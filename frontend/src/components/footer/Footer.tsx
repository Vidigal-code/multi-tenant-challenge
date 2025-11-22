"use client";
import React from "react";
import Link from "next/link";
import { HiSparkles, HiMiniArrowUpRight, HiShieldCheck } from "react-icons/hi2";

const quickLinks = [
    { label: "Chat Multi-Tenant", href: "/demo/chat" },
    { label: "Info e Arquitetura", href: "/info" },
    { label: "Documentação", href: "https://github.com/Vidigal-code/multi-tenant-challenge" },
];

const resourceLinks = [
    { label: "GitHub", href: "https://github.com/Vidigal-code/" },
    { label: "Swagger API", href: "http://localhost:4000/doc" },
];

const statusChips = [
    { label: "RabbitMQ", value: "Operacional" },
    { label: "Redis", value: "Confirmações ativas" },
    { label: "Notifications", value: "Realtime OK" },
];

export function Footer() {
    return (
        <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-gray-900 dark:text-white font-semibold text-lg">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600">
                                <HiSparkles className="text-xl" />
                            </span>
                            Multi-Tenant Challenge
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Orquestração completa de empresas, notificações, amigos e workers em um único stack.
                        </p>
                    </div>
                    <Link
                        href="/demo/chat"
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium
                        text-gray-900 dark:text-white hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        Abrir Chat IA
                        <HiMiniArrowUpRight className="text-base" />
                    </Link>
                </div>

                <div className="grid gap-8 md:grid-cols-3 text-sm text-center md:text-left">
                    <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                            Navegação
                        </p>
                        <div className="flex flex-col gap-3">
                            {quickLinks.map((link) => (
                                <Link
                                    key={link.label}
                                    href={link.href}
                                    className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                            Recursos
                        </p>
                        <div className="flex flex-col gap-3">
                            {resourceLinks.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.href}
                                    target={link.href.startsWith("http") ? "_blank" : undefined}
                                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                                    className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500 dark:text-gray-400">
                            Status
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                            {statusChips.map((status) => (
                                <div
                                    key={status.label}
                                    className="rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60
                                    dark:bg-emerald-900/20 px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200"
                                >
                                    {status.label}: {status.value}
                                </div>
                            ))}
                        </div>
                        <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <HiShieldCheck className="text-base text-emerald-500" />
                            WebSocket protegido por confirmação de entrega e rate limit via Redis.
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 text-xs text-gray-500 dark:text-gray-400 sm:flex-row sm:items-center
                sm:justify-between text-center sm:text-left">
                    <p>© {new Date().getFullYear()} Multi-Tenant Challenge. Todos os direitos reservados.</p>
                    <p>
                        Criado por{" "}
                        <a
                            href="https://github.com/Vidigal-code/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                            Kauan Vidigal
                        </a>
                    </p>
                </div>
            </div>
        </footer>
    );
}


"use client";

import React from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import type { RootState } from "../store";

import {
    HiBuildingOffice,
    HiUserGroup,
    HiBellAlert,
    HiUsers,
    HiShieldCheck,
    HiDevicePhoneMobile,
    HiServerStack,
    HiArrowTrendingUp,
    HiCubeTransparent,
} from "react-icons/hi2";

export default function HomePage() {
    const isAuth = useSelector((s: RootState) => s.auth.isAuthenticated);

    return (
        <div className="min-h-screen w-full overflow-x-hidden">

            <section className="relative bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-50
             py-24 sm:py-32 md:py-40 px-4 sm:px-6 lg:px-8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-white
                dark:from-gray-950 dark:via-gray-950 dark:to-gray-950"></div>
                <div className="relative max-w-7xl mx-auto text-center">
                    <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-6 leading-tight">
                        Plataforma Multi-Tenant
                        <span className="block mt-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300
                        dark:to-white bg-clip-text text-transparent">
                            Avançada
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl md:text-2xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Gerencie empresas, equipes, usuários e permissões em um só lugar
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        {isAuth ? (
                            <>
                                <Link
                                    href="/dashboard"
                                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
                                    hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-base sm:text-lg"
                                >
                                    Ir para Dashboard
                                </Link>
                                <Link
                                    href="/company/new"
                                    className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-gray-900 dark:border-white text-gray-900
                                    dark:text-white rounded-lg hover:bg-gray-900 hover:text-white dark:hover:bg-white
                                    dark:hover:text-gray-900 transition-colors font-medium text-base sm:text-lg"
                                >
                                    Criar Nova Empresa
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/signup"
                                    className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
                                    hover:bg-gray-800
                                    dark:hover:bg-gray-200 transition-colors font-medium text-base sm:text-lg"
                                >
                                    Começar Grátis
                                </Link>
                                <Link
                                    href="/login"
                                    className="w-full sm:w-auto px-8 py-4 bg-transparent border-2 border-gray-900 dark:border-white text-gray-900
                                    dark:text-white rounded-lg hover:bg-gray-900 hover:text-white
                                    dark:hover:bg-white
                                    dark:hover:text-gray-900 transition-colors font-medium text-base sm:text-lg"
                                >
                                    Entrar
                                </Link>
                            </>
                        )}
                        <Link
                            href="/demo/chat"
                            className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium text-base sm:text-lg"
                        >
                            Abrir  Chat IA
                        </Link>
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950 border-y border-gray-200 dark:border-gray-800">
                <div className="max-w-7xl mx-auto">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 sm:mb-20 text-gray-900 dark:text-white">
                        Funcionalidades Principais
                    </h2>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">

                        <FeatureCard
                            icon={<HiBuildingOffice className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Gestão de Empresas"
                            text="Administre múltiplas empresas, membros, funções e permissões."
                        />

                        <FeatureCard
                            icon={<HiUserGroup className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Sistema de Convites"
                            text="Convide novos usuários com permissões configuráveis."
                        />

                        <FeatureCard
                            icon={<HiBellAlert className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Notificações em Tempo Real"
                            text="Receba alertas instantâneos de eventos importantes."
                        />

                        <FeatureCard
                            icon={<HiUsers className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Rede de Amigos"
                            text="Conecte-se, converse e interaja com sua rede."
                        />

                        <FeatureCard
                            icon={<HiShieldCheck className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Segurança Avançada"
                            text="Acesso privado/público e controle granular de permissões."
                        />

                        <FeatureCard
                            icon={<HiDevicePhoneMobile className="w-8 h-8 text-gray-900 dark:text-gray-50" />}
                            title="Totalmente Responsivo"
                            text="Interface fluida e adaptada para mobile e desktop."
                        />
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-12 sm:mb-16">
                        <p className="text-sm font-semibold tracking-[0.4em] uppercase text-gray-500 dark:text-gray-400">Arquitetura</p>
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mt-3">Stack Multi-Tenant de ponta a ponta</h2>
                        <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mt-3">
                            Cada módulo conversa via RabbitMQ, usa Redis para deduplicação e confirmações e expõe tudo em um frontend App Router.
                        </p>
                    </div>
                    <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
                        <ArchitectureCard
                            icon={<HiServerStack className="w-7 h-7 text-blue-600" />}
                            title="Eventos + Jobs"
                            text="Use cases publicam em `events.*` e jobs em `*.list.requests`. Workers dedicados mantêm os fluxos responsivos, mesmo com milhões de notificações."
                        />
                        <ArchitectureCard
                            icon={<HiShieldCheck className="w-7 h-7 text-emerald-500" />}
                            title="Confirmado no Realtime"
                            text="Redis controla cada `messageId` até o frontend responder `notifications.delivered`. Sem confirmação, o worker salva e registra timeout."
                        />
                        <ArchitectureCard
                            icon={<HiCubeTransparent className="w-7 h-7 text-purple-500" />}
                            title="Preferências por usuário"
                            text="Campos JSON definem popups, badges e categorias. Tudo sincronizado via React Query + Redux para evitar leituras desnecessárias."
                        />
                        <ArchitectureCard
                            icon={<HiArrowTrendingUp className="w-7 h-7 text-amber-500" />}
                            title="Observabilidade ativa"
                            text="Endpoints /workers/** auditados por JWT/JWE, métricas Prometheus em /metrics e documentação sincronizada com o Swagger 1.5."
                        />
                    </div>
                </div>
            </section>

            <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
                <div className="max-w-4xl mx-auto">

                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-12 sm:mb-20 text-gray-900 dark:text-gray-50">
                        Como Funciona
                    </h2>

                    <div className="space-y-8 sm:space-y-12">

                        <Step number="1" title="Crie sua Conta" text="Registre-se gratuitamente e acesse a plataforma imediatamente." />

                        <Step number="2" title="Crie sua Primeira Empresa" text="Defina as configurações principais e personalize sua organização." />

                        <Step number="3" title="Convide Membros" text="Adicione colaboradores e gerencie seus níveis de acesso." />

                        <Step number="4" title="Comece a Operar" text="Utilize ferramentas de gestão, comunicação e permissões." />
                    </div>
                </div>
            </section>

            <section className="py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-950">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-gray-50">
                        Pronto para Começar?
                    </h2>
                    <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-8 sm:mb-12">
                        Junte-se a empresas que já utilizam nossa plataforma diariamente
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-6">
                        {!isAuth && (
                            <Link
                                href="/signup"
                                className="inline-block px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800
                                dark:hover:bg-gray-200 transition-colors text-lg font-medium"
                            >
                                Criar Conta Grátis
                            </Link>
                        )}
                        <Link
                            href="/demo/chat"
                            className="inline-block px-8 py-4 border-2 border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-lg font-medium"
                        >
                            Testar o Chat Multi-Tenant
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}


function FeatureCard({
                         icon,
                         title,
                         text,
                     }: {
    icon: React.ReactNode;
    title: string;
    text: string;
}) {
    return (
        <div className="p-6 sm:p-8 border border-gray-200 dark:border-gray-800 rounded-xl hover:border-gray-900 dark:hover:border-white transition-colors
        bg-white dark:bg-gray-950">
            <div className="mb-4">{icon}</div>
            <h3 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-50">
                {title}
            </h3>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{text}</p>
        </div>
    );
}

function ArchitectureCard({
    icon,
    title,
    text,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
}) {
    return (
        <article className="p-6 sm:p-8 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900">
                    {icon}
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{text}</p>
                </div>
            </div>
        </article>
    );
}

function Step({
                  number,
                  title,
                  text,
              }: {
    number: string;
    title: string;
    text: string;
}) {
    return (
        <div className="flex gap-4 sm:gap-6 items-start">
            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg flex items-center
             justify-center font-bold text-lg sm:text-xl">
                {number}
            </div>
            <div className="min-w-0 flex-1">
                <h3 className="text-xl sm:text-2xl font-bold mb-2 text-gray-900 dark:text-gray-50">{title}</h3>
                <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">{text}</p>
            </div>
        </div>
    );
}

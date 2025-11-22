"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { MdChat, MdOutlineRocketLaunch, MdOutlineSecurity, MdOutlineLightbulb, MdOutlineNetworkCheck, MdOutlineTimeline } from "react-icons/md";

type ChatMessage = {
    id: string;
    author: "Você" | "Multi-Tenant IA";
    text: string;
};

const suggestedPrompts = [
    "Como o sistema garante que uma notificação não se perde?",
    "Explique rapidamente o papel das filas de RabbitMQ.",
    "Quais passos eu seguiria para testar o realtime?",
    "Me mostre um resumo do fluxo de broadcast para amigos."
];

const responseLibrary = [
    {
        matcher: ["perde", "garante", "notificação"],
        text: "Cada evento passa pelo `RealtimeNotificationsConsumer`, é armazenado no Redis até o cliente enviar `notifications.delivered` e só então vai para o PostgreSQL. Se o popup falhar, o worker grava mesmo assim após o TTL expirar."
    },
    {
        matcher: ["fila", "rabbitmq", "queues"],
        text: "Usamos filas temáticas: `events.*` para domínio, `notifications.realtimes` para entregas e jobs como `notifications.list.requests`. Isso permite escalar workers sem bloquear os use cases."
    },
    {
        matcher: ["testar", "realtime", "socket"],
        text: "Suba `docker compose up`, abra duas abas e marque uma notificação como lida. Você verá o popup via WebSocket e o badge sumindo graças às preferências sincronizadas."
    },
    {
        matcher: ["broadcast", "amigos", "sele", "global"],
        text: "O frontend cria um job em `notifications.friends.broadcast.requests`. O worker resolve se deve usar a lista de emails selecionados ou puxar todos os amigos via `friendships.list.requests`, envia as mensagens e atualiza o progresso para cada destinatário."
    }
];

const defaultFallback =
    "Este demo roda 100% no frontend, mas replica as respostas que explicam o fluxo real. Pergunte algo sobre notificações, filas, realtime ou broadcasts.";

const systemStatus = [
    { label: "RabbitMQ", value: "Operacional", detail: "events.*, notifications.realtimes", accent: "text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
    { label: "Redis", value: "Confirmando mensagens", detail: "dedup + delivery pending", accent: "text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
    { label: "WebSocket", value: "Namespace /rt", detail: "rooms user:{id} + company:{id}", accent: "text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800" },
    { label: "Jobs", value: "Fila notifications.list.requests", detail: "workers profile ativo", accent: "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
];

const pipelineExplainer = [
    {
        title: "1. Use case + Evento",
        description: "SendNotificationUseCase publica em `events` com payload normalizado."
    },
    {
        title: "2. Worker e Redis",
        description: "GenericEventsConsumer roteia para `notifications.realtimes` e cria `delivery:pending:{messageId}`."
    },
    {
        title: "3. WebSocket + Preferências",
        description: "EventsGateway envia para as salas e o frontend respeita toggles por usuário."
    },
    {
        title: "4. Persistência + Jobs",
        description: "Confirmação limpa Redis, grava no PostgreSQL e jobs alimentam feeds/broadcasts."
    },
];

function buildResponse(prompt: string): string {
    const normalized = prompt.toLowerCase();
    const match = responseLibrary.find((entry) =>
        entry.matcher.some((keyword) => normalized.includes(keyword))
    );
    return match?.text ?? defaultFallback;
}

export default function ChatDemoPage() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "m-0",
            author: "Multi-Tenant IA",
            text: "Olá! Eu sou uma versão demonstrativa do chat interno. Pergunte algo sobre a arquitetura e eu explico o fluxo."
        }
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const conversationTips = useMemo(
        () => [
            {
                title: "Arquitetura real",
                description:
                    "As respostas são baseadas nos mesmos conceitos descritos nas páginas Info e Architecture, só que daqui você vê em formato de chat."
            },
            {
                title: "Sem backend",
                description:
                    "Nada aqui bate no servidor. É apenas um guia interativo público para acelerar demonstrações."
            },
            {
                title: "Sugestões prontas",
                description:
                    "Use os botões ao lado para preencher perguntas e veja como a IA demonstrativa responde."
            }
        ],
        []
    );

    const handleSend = (prompt?: string) => {
        const text = (prompt ?? input).trim();
        if (!text) {
            return;
        }
        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            author: "Você",
            text
        };
        const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}`,
            author: "Multi-Tenant IA",
            text: buildResponse(text)
        };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsTyping(true);
        setTimeout(() => {
            setMessages((prev) => [...prev, aiMessage]);
            setIsTyping(false);
        }, 450);
    };

    return (
        <div className="container mx-auto max-w-6xl px-4 py-12 space-y-10">
            <header className="space-y-4 text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white flex items-center gap-3 justify-center">
                    <MdChat className="text-blue-500 text-4xl" />
                    Chat Multi-Tenant
                </h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                    Chat Multi-Tenant gerencia sua empresa com nossa IA proprietária, alimentada por eventos RabbitMQ,
                    deduplicação Redis e WebSocket com confirmação de entrega. A experiência conversa com toda a suíte
                    multi-tenant: dispara jobs, consulta métricas e documenta decisões estratégicas em tempo real.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                    <Link
                        href="/info"
                        className="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                        Ver página Info
                    </Link>
                    <Link
                        href="/notifications"
                        className="px-4 py-2 text-sm rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white hover:border-blue-500 hover:text-blue-400 transition-colors"
                    >
                        Abrir notificações reais
                    </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-8">
                    {systemStatus.map((status) => (
                        <div key={status.label} className={`rounded-2xl border ${status.accent} bg-white/80 dark:bg-gray-900/40 px-4 py-3 text-left`}>
                            <p className="text-xs uppercase tracking-[0.3em]">{status.label}</p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-white">{status.value}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">{status.detail}</p>
                        </div>
                    ))}
                </div>
            </header>

            <section className="grid gap-6 md:grid-cols-3">
                <article className="md:col-span-2 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/30 p-6 shadow-lg flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Conversa demonstrativa</h2>
                        <span className="text-xs uppercase tracking-[0.3em] text-blue-500">Beta</span>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[420px]">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex ${message.author === "Você" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`rounded-2xl px-4 py-3 max-w-[80%] text-sm leading-relaxed shadow-sm ${
                                        message.author === "Você"
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-white"
                                    }`}
                                >
                                    <p className="text-xs font-semibold mb-1 opacity-80">{message.author}</p>
                                    <p>{message.text}</p>
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Multi-Tenant IA está digitando...
                            </div>
                        )}
                    </div>
                    <form
                        className="mt-6 space-y-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            handleSend();
                        }}
                    >
                        <label htmlFor="chat-input" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Envie uma pergunta
                        </label>
                        <textarea
                            id="chat-input"
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            rows={3}
                            className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex.: Explique o flow de confirmação de entrega..."
                        />
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex flex-wrap gap-2">
                                {suggestedPrompts.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => handleSend(prompt)}
                                        className="px-3 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                            >
                                Enviar
                                <MdOutlineRocketLaunch className="text-lg" />
                            </button>
                        </div>
                    </form>
                </article>

                <aside className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/40 p-6 space-y-5 shadow">
                    {conversationTips.map((tip) => (
                        <div key={tip.title} className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-950/40 space-y-1 border border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{tip.title}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{tip.description}</p>
                        </div>
                    ))}
                    <div className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-900/20 p-4 space-y-3 text-sm text-blue-900 dark:text-blue-100">
                        <div className="flex items-center gap-2 font-semibold">
                            <MdOutlineSecurity className="text-lg" />
                            Resumo do que a IA sabe
                        </div>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Fluxo completo: use case → RabbitMQ → worker → Redis → WebSocket → confirmação.</li>
                            <li>Jobs assíncronos: listagem de notificações, broadcast e exclusões em lote.</li>
                            <li>Preferências determinam se o popup aparece ou só atualiza os badges.</li>
                        </ul>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-900/20 p-4 space-y-3 text-sm text-emerald-900 dark:text-emerald-100">
                        <div className="flex items-center gap-2 font-semibold">
                            <MdOutlineLightbulb className="text-lg" />
                            Onde aprofundar
                        </div>
                        <ul className="list-disc list-inside space-y-2">
                            <li>Arquitetura completa descrita nos arquivos ARCHITECTURE_EXPLAINED.md e ARCHITECTURE_QUEUES.md do repositório.</li>
                            <li>
                                <Link href="/info" className="underline-offset-2 hover:underline">
                                    Página Info com highlights
                                </Link>
                            </li>
                            <li>Docs Swagger em /doc para explorar endpoints reais.</li>
                        </ul>
                    </div>
                </aside>
            </section>

            <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-950/40 p-8 shadow-lg space-y-5">
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-300 p-3">
                        <MdOutlineNetworkCheck className="text-2xl" />
                    </span>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Como seria no ambiente real?</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">O demo simula respostas, mas o pipeline abaixo é o mesmo usado na plataforma.</p>
                    </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    {pipelineExplainer.map((step) => (
                        <article key={step.title} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/40 p-5 space-y-3 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <MdOutlineTimeline className="text-lg" />
                                <p className="text-sm font-semibold">{step.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{step.description}</p>
                        </article>
                    ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Em produção, o chat escreveria em um tópico dedicado (`chat.messages.requests`), um consumer registraria cada mensagem e o EventsGateway entregaria aos participantes conectados.
                    Esta página permite visualizar a narrativa antes de integrar com o backend.
                </p>
            </section>
        </div>
    );
}



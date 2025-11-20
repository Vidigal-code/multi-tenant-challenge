"use client";

import Link from "next/link";
import {
    MdArchitecture,
    MdNotificationsActive,
    MdOutlineDeviceHub,
    MdOutlineSecurity,
    MdOutlineSettingsBackupRestore,
    MdOutlineChecklist,
    MdSend,
    MdGroups,
    MdDashboardCustomize,
} from "react-icons/md";

const highlightCards = [
    {
        title: "Arquitetura orientada a eventos",
        description: "Use cases publicam eventos no RabbitMQ; múltiplos workers consomem e mantêm o sistema responsivo mesmo em grandes volumes.",
        icon: MdArchitecture,
        accent: "from-blue-500/20 to-blue-500/5 border-blue-500/40",
    },
    {
        title: "Realtime com confirmação",
        description: "Cada notificação passa pelo Redis até o frontend confirmar o recebimento. Isso evita perder pop-ups e garante consistência.",
        icon: MdNotificationsActive,
        accent: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/40",
    },
    {
        title: "Preferências por usuário",
        description: "O perfil controla popup, badge e categorias monitoradas. O backend respeita essas flags antes de emitir qualquer evento.",
        icon: MdOutlineSettingsBackupRestore,
        accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
    },
    {
        title: "Filas dedicadas",
        description: "`events` para domínio, `events.invites` para convites e `notifications.realtimes` para entregas. Fácil escalar por serviço.",
        icon: MdOutlineDeviceHub,
        accent: "from-purple-500/20 to-purple-500/5 border-purple-500/40",
    },
];

const toggleMatrix = [
    { label: "Convites de Empresa", effect: "Pausa popups sobre convites, mas eles permanecem listados na página de notificações." },
    { label: "Solicitações de Amizade", effect: "Silencia alertas `friend.request.*` – útil para quem não quer popups sociais." },
    { label: "Mensagens da Empresa", effect: "Controle para broadcast interno (`notification.sent`). Ideal para reduzir ruído em grandes companhias." },
    { label: "Mensagens de Amigos", effect: "Filtra mensagens diretas canal `friend`. Mantém a experiência social separada das solicitações." },
    { label: "Mudanças de Membros", effect: "Desliga alertas quando alguém entra/sai de uma empresa que você acompanha." },
    { label: "Mudanças de Cargo", effect: "Só dispara quando o usuário alvo é você. Desativar impede popups, mas o histórico permanece." },
];

const actionLinks = [
    { href: "/notifications", label: "Ver notificações", icon: MdSend },
    { href: "/dashboard", label: "Abrir dashboard", icon: MdDashboardCustomize },
    { href: "/profile", label: "Editar preferências", icon: MdOutlineChecklist },
];

export default function InfoPage() {
    return (
        <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
            <header className="text-center space-y-4">
                <p className="text-sm font-semibold tracking-widest text-blue-500 uppercase">Multi-Tenant Challenge</p>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">Como o sistema funciona</h1>
                <p className="text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                    Este painel reúne as principais decisões de arquitetura, como notificações percorrem RabbitMQ + Redis e de que forma o frontend
                    interpreta cada evento. Use como referência rápida ao debugar ou demonstrar o projeto.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {actionLinks.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-gray-200
                            dark:border-gray-700 bg-white/80 dark:bg-gray-900/40 px-5 py-2 text-sm font-medium
                            text-gray-900 dark:text-white shadow-sm hover:border-blue-500 hover:text-blue-600
                            dark:hover:text-blue-400 transition-colors"
                        >
                            <Icon className="text-lg" />
                            {label}
                        </Link>
                    ))}
                </div>
            </header>

            <section className="grid gap-6 md:grid-cols-2">
                {highlightCards.map(({ title, description, icon: Icon, accent }) => (
                    <article
                        key={title}
                        className={`rounded-2xl border bg-white/80 dark:bg-gray-900/40 ${accent} p-6 shadow-sm backdrop-blur`}
                    >
                        <div className="flex items-start gap-4">
                            <span className="rounded-2xl bg-white/80 dark:bg-gray-900/80 p-3 shadow-inner">
                                <Icon className="text-3xl text-blue-500" />
                            </span>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{description}</p>
                            </div>
                        </div>
                    </article>
                ))}
            </section>

            <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-950/40 p-8 shadow-lg space-y-6">
                <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-300 p-3">
                        <MdOutlineSecurity className="text-2xl" />
                    </span>
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Fluxo completo de uma notificação</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Da API ao popup, o caminho é sempre o mesmo.</p>
                    </div>
                </div>
                <ol className="space-y-4">
                    {[
                        {
                            title: "Use case + Domain Events",
                            desc: "Controllers chamam os use cases (ex.: SendNotificationUseCase). Cada ação publica um `notifications.sent`, " +
                                "`friend.request.*` ou evento equivalente.",
                        },
                        {
                            title: "RabbitMQ encadeia o trabalho",
                            desc: "O `GenericEventsConsumer` lê da fila `events`, enriquece com `eventId` e envia para `notifications.realtimes` " +
                                "ou filas temáticas como `events.invites`.",
                        },
                        {
                            title: "Redis mantém a confirmação",
                            desc: "O `RealtimeNotificationsConsumer` guarda o payload no Redis até o frontend enviar `notifications.delivered`." +
                                " Se o usuário desligou realtime, o worker salva direto e marca como entregue.",
                        },
                        {
                            title: "Frontend aplica preferências",
                            desc: "Hooks (`useNotificationPreferences`) determinam se mostra popup, badge ou apenas atualiza a lista. " +
                                "Mesmo sem alerta visual, a notificação já está persistida.",
                        },
                    ].map((step, index) => (
                        <li key={step.title} className="flex gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white font-semibold">
                                {index + 1}
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-300">{step.desc}</p>
                            </div>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/30 p-8 space-y-5 shadow">
                <div className="flex items-center gap-3">
                    <MdGroups className="text-2xl text-blue-500" />
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">O que cada toggle faz?</h2>
                </div>
                <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/40">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Categoria</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Efeito prático</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {toggleMatrix.map(({ label, effect }) => (
                                <tr key={label} className="bg-white/70 dark:bg-gray-950/20">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{label}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{effect}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
                <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80
                dark:bg-gray-900/40 p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-3">
                        <MdOutlineChecklist className="text-2xl text-emerald-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Checklist rápido</h2>
                    </div>
                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                        <li>✔️ Vai mandar mensagens em lote? Use os use cases existentes e deixe o RabbitMQ cuidar da fila.</li>
                        <li>✔️ Se o usuário desativar realtime, notificações continuam no banco; apenas o push é silenciado.</li>
                        <li>✔️ Preferências novas devem ser adicionadas em `useNotificationPreferences` e no DTO `/auth/profile`.</li>
                        <li>✔️ Precisa de mais escalabilidade? Suba instâncias extras dos consumers e ajuste o `prefetch`.</li>
                    </ul>
                </article>
                <article className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-blue-50/80
                dark:bg-blue-900/20 p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-3 text-blue-700 dark:text-blue-200">
                        <MdOutlineSecurity className="text-2xl" />
                        <h2 className="text-lg font-semibold">Dicas de operação</h2>
                    </div>
                    <ul className="space-y-3 text-sm text-blue-800 dark:text-blue-100">
                        <li>• Purge das filas: `rabbitmqctl purge_queue notifications.realtimes` antes de rodar grandes migrações.</li>
                        <li>• Redis armazena apenas confirmações; se precisar zerar tudo, rode `FLUSHDB` após parar os workers.</li>
                        <li>• A página de perfil é o ponto único de verdade para preferências. Qualquer nova categoria deve estar documentada aqui.</li>
                    </ul>
                </article>
            </section>
        </div>
    );
}


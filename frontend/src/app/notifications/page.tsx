"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getErrorMessage } from "../../lib/error";
import { useToast } from "../../hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import Skeleton from "../../components/skeleton/Skeleton";
import { queryKeys } from "../../lib/queryKeys";
import { ConfirmModal } from "../../components/modals/ConfirmModal";
import { subscribe, whenReady, RT_EVENTS } from "../../lib/realtime";
import {
    formatNotificationMessage,
    getNotificationStyle,
    removeEventCodeFromTitle,
    extractEventCode,
    NotificationData
} from "../../lib/notification-messages";
import { formatDate } from "../../lib/date-utils";
import { translateGenericMessage, getNotificationCodeMessage } from "../../lib/messages";
import {
    MdPerson,
    MdBusiness,
    MdMail,
    MdPersonAdd,
    MdRefresh,
    MdChevronLeft,
    MdChevronRight,
    MdSend,
    MdInbox,
    MdWork,
    MdGroup,
    MdLink,
    MdChat,
    MdDeleteSweep,
} from "react-icons/md";
import { formatNotificationBody } from "../../lib/notification-formatter";

import {
    useMarkNotificationRead,
    useDeleteNotification,
    useReplyToNotification,
    useNotificationListing,
    useNotificationDeletionJob,
    type Notification
} from "../../services/api";

import { useFriendRequests } from "../../services/api";

/**
 *      
 * EN: Truncate text to a maximum length
 *
 * PT: Truncar texto para um comprimento máximo
 *
 * @params text - Text to truncate
 * @params max - Maximum length
 * @returns Truncated text
 */
function truncate(text: string, max: number) {
    if (!text) return "";
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

interface ParseNotificationBodyOptions {
    showFriendshipLink?: boolean;
}


/**
 *      
 * EN: Get translated title for notification
 *
 * PT: Obter título traduzido para notificação
 *
 * @params title - Notification title
 * @returns Translated title string
 */
function getTranslatedTitle(title: string): string {
    if (!title) return title;

    const normalizedTitle = title.toUpperCase().trim();

    if (normalizedTitle === "NOTIFICATION_REPLY" || normalizedTitle === "[NOTIFICATION_REPLY]") {
        return getNotificationCodeMessage("NOTIFICATION_REPLY");
    }

    const eventCode = extractEventCode(title);
    if (eventCode && eventCode.toUpperCase() === "NOTIFICATION_REPLY") {
        return getNotificationCodeMessage("NOTIFICATION_REPLY");
    }

    if (eventCode) {
        const translated = getNotificationCodeMessage(eventCode);
        if (translated !== eventCode) {
            return translated;
        }
    }

    const translated = getNotificationCodeMessage(normalizedTitle);
    if (translated !== normalizedTitle) {
        return translated;
    }

    return removeEventCodeFromTitle(title);
}

/**
 *      
 * EN: Get context description for notification
 *
 * PT: Obter descrição de contexto para notificação
 *
 * @params notification - Notification object
 * @returns Context string
 */
function getNotificationContext(notification: Notification): string {
    const kind = (notification.meta?.kind || "").toLowerCase();
    const eventCode = extractEventCode(notification.title);
    const titleUpper = (notification.title || "").toUpperCase();
    const bodyUpper = (notification.body || "").toUpperCase();

    if (kind.includes("invite.created") || kind.includes("invites.created")) {
        return "Esta é uma resposta sobre um convite para entrar em uma empresa";
    }
    if (kind.includes("invite.accepted") || kind.includes("invites.accepted")) {
        return "Esta é uma resposta sobre um convite aceito";
    }
    if (kind.includes("invite.rejected") || kind.includes("invites.rejected")) {
        return "Esta é uma resposta sobre um convite rejeitado";
    }
    if (kind.includes("role.changed") || kind.includes("membership.role.updated")) {
        return "Esta é uma resposta sobre uma mudança de cargo";
    }
    if (kind.includes("member.added") || kind.includes("membership.joined")) {
        return "Esta é uma resposta sobre um membro adicionado à empresa";
    }
    if (kind.includes("member.removed") || kind.includes("membership.removed")) {
        return "Esta é uma resposta sobre um membro removido da empresa";
    }
    if (kind.includes("friend.request.sent")) {
        return "Esta é uma resposta sobre uma solicitação de amizade";
    }
    if (kind.includes("friend.request.accepted")) {
        return "Esta é uma resposta sobre uma solicitação de amizade aceita";
    }
    if (kind.includes("friend.request.rejected")) {
        return "Esta é uma resposta sobre uma solicitação de amizade rejeitada";
    }
    if (kind.includes("friend.removed")) {
        return "Esta é uma resposta sobre uma remoção de amizade";
    }
    if (kind.includes("notification.sent") || kind.includes("notifications.sent")) {
        return "Esta é uma resposta sobre uma notificação";
    }
    if (kind.includes("company.created")) {
        return "Esta é uma resposta sobre uma empresa criada";
    }
    if (kind.includes("company.updated")) {
        return "Esta é uma resposta sobre uma empresa atualizada";
    }
    if (kind.includes("company.deleted")) {
        return "Esta é uma resposta sobre uma empresa excluída";
    }

    if (eventCode === "INVITE_CREATED" || titleUpper.includes("INVITE_CREATED") || bodyUpper.includes("CONVITE")) {
        return "Esta é uma resposta sobre um convite para entrar em uma empresa";
    }
    if (eventCode === "INVITE_ACCEPTED" || titleUpper.includes("INVITE_ACCEPTED")) {
        return "Esta é uma resposta sobre um convite aceito";
    }
    if (eventCode === "INVITE_REJECTED" || titleUpper.includes("INVITE_REJECTED") || titleUpper.includes("REJECT_COMPANY_INVITE")) {
        return "Esta é uma resposta sobre um convite rejeitado";
    }
    if (eventCode === "ROLE_CHANGED" || eventCode === "USER_STATUS_UPDATED" || titleUpper.includes("ROLE_CHANGED") || titleUpper.includes("USER_STATUS_UPDATED") || bodyUpper.includes("CARGO")) {
        return "Esta é uma resposta sobre uma mudança de cargo";
    }
    if (eventCode === "MEMBER_ADDED" || eventCode === "USER_JOINED" || titleUpper.includes("MEMBER_ADDED") || titleUpper.includes("USER_JOINED")) {
        return "Esta é uma resposta sobre um membro adicionado à empresa";
    }
    if (eventCode === "MEMBER_REMOVED" || eventCode === "USER_REMOVED" || titleUpper.includes("MEMBER_REMOVED") || titleUpper.includes("USER_REMOVED")) {
        return "Esta é uma resposta sobre um membro removido da empresa";
    }
    if (eventCode === "FRIEND_REQUEST_SENT" || titleUpper.includes("FRIEND_REQUEST_SENT")) {
        return "Esta é uma resposta sobre uma solicitação de amizade";
    }
    if (eventCode === "FRIEND_REQUEST_ACCEPTED" || eventCode === "ACCEPTED_FRIEND" || titleUpper.includes("FRIEND_REQUEST_ACCEPTED") || titleUpper.includes("ACCEPTED_FRIEND")) {
        return "Esta é uma resposta sobre uma solicitação de amizade aceita";
    }
    if (eventCode === "FRIEND_REQUEST_REJECTED" || eventCode === "REJECTED_FRIEND" || titleUpper.includes("FRIEND_REQUEST_REJECTED") || titleUpper.includes("REJECTED_FRIEND")) {
        return "Esta é uma resposta sobre uma solicitação de amizade rejeitada";
    }
    if (eventCode === "FRIEND_REMOVED" || titleUpper.includes("FRIEND_REMOVED")) {
        return "Esta é uma resposta sobre uma remoção de amizade";
    }
    if (eventCode === "COMPANY_CREATED" || titleUpper.includes("COMPANY_CREATED")) {
        return "Esta é uma resposta sobre uma empresa criada";
    }
    if (eventCode === "NOTIFICATION_SENT" || titleUpper.includes("NOTIFICATION_SENT")) {
        return "Esta é uma resposta sobre uma notificação";
    }

    if (bodyUpper.includes("CONVITE") || bodyUpper.includes("INVITE")) {
        return "Esta é uma resposta sobre um convite";
    }
    if (bodyUpper.includes("CARGO") || bodyUpper.includes("ROLE") || bodyUpper.includes("PAPEL")) {
        return "Esta é uma resposta sobre uma mudança de cargo";
    }
    if (bodyUpper.includes("MEMBRO") || bodyUpper.includes("MEMBER")) {
        return "Esta é uma resposta sobre um membro";
    }
    if (bodyUpper.includes("AMIGO") || bodyUpper.includes("FRIEND")) {
        return "Esta é uma resposta sobre uma amizade";
    }

    return "Esta é uma resposta a uma notificação anterior";
}

/**
 *      
 * EN: Parse and format notification body
 *
 * PT: Analisar e formatar corpo da notificação
 *
 * @params body - Notification body
 * @params title - Notification title
 * @params meta - Notification metadata
 * @params options - Parsing options
 * @returns React Node
 */
function parseNotificationBody(
    body: string,
    title?: string,
    meta?: Notification["meta"],
    options?: ParseNotificationBodyOptions
): React.ReactNode {
    if (!body) return null;

    const formattedLines = formatNotificationBody(body, title);
    const isFriendRequest = meta?.kind === "friend.request.sent" || title?.toUpperCase().includes("FRIEND_REQUEST_SENT");
    const friendshipId = meta?.friendshipId;
    const showFriendshipLink = options?.showFriendshipLink !== false;

    return (
        <div className="space-y-2">
            {formattedLines.map((line, index) => {
                if (!line.value.trim()) return null;

                return (
                    <div key={index} className="text-sm flex items-start gap-2">
                        {line.icon && (
                            <span className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">
                                {line.icon}
                            </span>
                        )}
                        <div className="flex-1 min-w-0">
                            {line.label && (
                                <strong className="text-gray-700 dark:text-gray-300">{line.label} </strong>
                            )}
                            {line.isUrl && line.url ? (
                                <a
                                    href={line.url.startsWith("http") ? line.url : line.url.startsWith("/") ? line.url : `https://${line.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline break-all font-medium"
                                >
                                    {line.url}
                                </a>
                            ) : (
                                <span className="text-gray-700 dark:text-gray-300">
                                    {(() => {
                                        if (line.value.includes("[") && line.value.includes("]")) {
                                            const translated = translateGenericMessage(line.value);
                                            return translated !== line.value ? translated : line.value;
                                        }
                                        return line.value;
                                    })()}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
            {showFriendshipLink && isFriendRequest && friendshipId && (
                <div className="text-sm flex items-start gap-2 mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                    <span className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">
                        <MdLink className="inline mr-1" />
                    </span>
                    <div className="flex-1 min-w-0">
                        <strong className="text-gray-700 dark:text-gray-300">Link da Solicitação: </strong>
                        <Link
                            href={`/friends/${friendshipId}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline break-all font-medium"
                        >
                            Ver solicitação de amizade
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}

type NotificationTab = "all" | "friends" | "friend-messages"
 | "company-messages" | "invites" | "members" | "roles";

interface NotificationCategory {
    id: NotificationTab;
    label: string;
    icon: React.ReactNode;
    filter: (notification: Notification) => boolean;
}

/**
 *      
 * EN: Notification Page Component
 *
 * PT: Componente da Página de Notificações
 *
 * @returns JSX.Element
 */
export default function NotificationsPage() {
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<NotificationTab>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected] = useState<string[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showClearAllModal, setShowClearAllModal] = useState(false);
    const [deleteIds, setDeleteIds] = useState<string[]>([]);
    const itemsPerPage = 10;
    const { show } = useToast();
    const queryClient = useQueryClient();

    const deletionJob = useNotificationDeletionJob();
    const notificationsQuery = useNotificationListing(currentPage, itemsPerPage, activeTab); 
    const notifications = (notificationsQuery.data && "items" in notificationsQuery.data &&
         Array.isArray(notificationsQuery.data.items)) ?
     notificationsQuery.data.items as Notification[] : [];
    const isLoading = notificationsQuery.isLoading;
    const totalNotifications = (notificationsQuery.data && "total" in notificationsQuery.data) ? notificationsQuery.data.total : 0;
    const friendRequestsQuery = useFriendRequests();

    const markReadMutation = useMarkNotificationRead();
    const deleteMutation = useDeleteNotification();
    const replyMutation = useReplyToNotification();

    useEffect(() => {
        let unsub: (() => void) | undefined;

        const setupRealtime = async () => {
            try {
                await whenReady();
                unsub = subscribe(RT_EVENTS.NOTIFICATION_CREATED, () => {
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.notifications()
                    });
                    if (activeTab !== "all") {
                        queryClient.invalidateQueries({
                            queryKey: queryKeys.notificationListing(activeTab, currentPage, itemsPerPage)
                        });
                    }
                    friendRequestsQuery.refetch();
                });
            } catch (error) {
                console.error("Failed to setup realtime for notifications page:", error);
            }
        };

        setupRealtime();

        return () => {
            if (unsub) unsub();
        };
    }, [queryClient, activeTab, currentPage, itemsPerPage, friendRequestsQuery]);

    useEffect(() => {
        if (deletionJob.jobStatus?.status === 'completed' && deletionJob.jobStatus.done) {
            notificationsQuery.restartJob();
            setSelected([]);
            setDeleteIds([]);
            if (showDeleteModal) setShowDeleteModal(false);
            if (showClearAllModal) setShowClearAllModal(false);
            
            show({
                type: "success",
                message: "Notificações excluídas com sucesso"
            });
            deletionJob.reset();
        } else if (deletionJob.jobStatus?.status === 'failed') {
             show({
                type: "error",
                message: deletionJob.jobStatus.error || "Falha ao excluir notificações"
            });
        }
    }, [deletionJob.jobStatus?.status, deletionJob.jobStatus?.done]); 

    useEffect(() => {
        setCurrentPage(1);
        notificationsQuery.restartJob();
    }, [activeTab]); 

    const handleMarkRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await markReadMutation.mutateAsync(id);
        } catch (error) {
            show({
                type: "error",
                message: "Erro ao marcar notificação como lida"
            });
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMutation.mutateAsync(id);
            if (expandedNotifications[id]) {
                setExpandedNotifications(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }
            setDeleteConfirm(null);
            show({
                type: "success",
                message: "Notificação removida com sucesso"
            });
            notificationsQuery.restartJob();
        } catch (error) {
            show({
                type: "error",
                message: getErrorMessage(error)
            });
        }
    };

    const handleBulkDelete = async (ids: string[]) => {
        try {
            await deletionJob.createJobAsync({ ids });
            // Modal closing and success message will be handled by the useEffect monitoring job status
        } catch (error) {
            show({
                type: "error",
                message: getErrorMessage(error)
            });
        }
    };

    const handleClearAll = async () => {
        try {
            await deletionJob.createJobAsync({ deleteAll: true });
             // Modal closing and success message will be handled by the useEffect monitoring job status
        } catch (error) {
            show({
                type: "error",
                message: getErrorMessage(error)
            });
        }
    };

    const handleReply = async (notification: Notification) => {
        if (!replyBody.trim()) return;

        try {
            await replyMutation.mutateAsync({
                id: notification.id,
                body: replyBody
            });
            setReplyingTo(null);
            setReplyBody("");
            show({
                type: "success",
                message: "Resposta enviada com sucesso"
            });
        } catch (error) {
            show({
                type: "error",
                message: getErrorMessage(error)
            });
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedNotifications(prev => ({
            ...prev,
            [id]: !prev[id]
        }));

        if (!expandedNotifications[id]) {
            const notification = notifications.find(n => n.id === id);
            if (notification && !notification.read) {
                markReadMutation.mutate(id);
            }
        }
    };

    const categories: NotificationCategory[] = [
        {
            id: "all",
            label: "Todas",
            icon: <MdInbox className="text-xl" />,
            filter: () => true
        },
        {
            id: "friends",
            label: "Amigos",
            icon: <MdPerson className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("friend") ||
                    title.toUpperCase().includes("FRIEND") ||
                    (!!n.meta?.friendshipId);
            }
        },
        {
            id: "invites",
            label: "Convites",
            icon: <MdMail className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("invite") ||
                    title.toUpperCase().includes("INVITE") ||
                    (!!n.meta?.inviteId);
            }
        },
        {
            id: "company-messages",
            label: "Empresas",
            icon: <MdBusiness className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("company") ||
                    title.toUpperCase().includes("COMPANY") ||
                    (!!n.meta?.companyId && !kind.includes("invite"));
            }
        },
        {
            id: "members",
            label: "Membros",
            icon: <MdGroup className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("member") ||
                    title.toUpperCase().includes("MEMBER") ||
                    title.toUpperCase().includes("USER_JOINED") ||
                    title.toUpperCase().includes("USER_REMOVED");
            }
        },
        {
            id: "roles",
            label: "Cargos",
            icon: <MdWork className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("role") ||
                    title.toUpperCase().includes("ROLE") ||
                    title.toUpperCase().includes("USER_STATUS_UPDATED");
            }
        },
        {
            id: "friend-messages",
            label: "Mensagens",
            icon: <MdChat className="text-xl" />,
            filter: (n) => {
                const kind = n.meta?.kind || "";
                const title = n.title || "";
                return kind.includes("notification") ||
                    title.toUpperCase().includes("NOTIFICATION");
            }
        }
    ];


    const filteredNotifications = useMemo(() => {
        const category = categories.find(c => c.id === activeTab);
        if (!category) return notifications;
        return notifications.filter(category.filter);
    }, [categories, notifications, activeTab]);

    const totalPages = Math.ceil(totalNotifications / itemsPerPage);

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const toggleSelection = (id: string) => {
        setSelected(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        );
    };

    const areAllVisibleSelected = filteredNotifications.length > 0 && filteredNotifications.every(n => selected.includes(n.id));

    const toggleAllSelection = () => {
        if (areAllVisibleSelected) {
            setSelected(prev => prev.filter(id => !filteredNotifications.some(n => n.id === id)));
        } else {
            const newIds = filteredNotifications
                .map(n => n.id)
                .filter(id => !selected.includes(id));
            setSelected(prev => [...prev, ...newIds]);
        }
    };

    const handleDeleteSelected = () => {
        setDeleteIds(selected);
        setShowDeleteModal(true);
    };

    const tabsContainerRef = React.useRef<HTMLDivElement>(null);

    const scrollTabs = (direction: "left" | "right") => {
        if (tabsContainerRef.current) {
            const scrollAmount = 200;
            const currentScroll = tabsContainerRef.current.scrollLeft;
            tabsContainerRef.current.scrollTo({
                left: direction === "left" ? currentScroll - scrollAmount : currentScroll + scrollAmount,
                behavior: "smooth"
            });
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-5xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <MdInbox className="text-blue-600 dark:text-blue-400" />
                        Notificações
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400">
                        Gerencie suas notificações, convites e mensagens.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {notifications.length > 0 && (
                         <button
                            onClick={() => setShowClearAllModal(true)}
                            disabled={deletionJob.isLoading || isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600
                            bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40
                            dark:text-red-400 rounded-lg transition-colors shadow-sm border border-red-200
                            dark:border-red-800 disabled:opacity-50"
                        >
                            <MdDeleteSweep className="text-lg" /> Limpar tudo
                        </button>
                    )}
                    {selected.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={deletionJob.isLoading || isLoading}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white
                            bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        >
                            <MdPersonAdd className="text-lg" /> Excluir ({selected.length})
                        </button>
                    )}
                    <button
                        onClick={() => {
                            notificationsQuery.restartJob();
                            notificationsQuery.refetch();
                        }}
                        disabled={isLoading}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100
                        dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
                        title="Atualizar notificações"
                    >
                        <MdRefresh className={`text-2xl ${isLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            <div
                className="relative mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border
                border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="flex items-center">
                    <button
                        onClick={() => scrollTabs("left")}
                        className="p-2 m-1 flex-shrink-0 text-gray-500 hover:bg-gray-100
                         dark:hover:bg-gray-700 rounded-lg transition-colors z-10"
                        aria-label="Previous tabs"
                    >
                        <MdChevronLeft className="text-2xl" />
                    </button>

                    <div
                        ref={tabsContainerRef}
                        className="flex-1 flex overflow-x-auto scrollbar-hide snap-x"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        {categories.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => {
                                    setActiveTab(category.id);
                                    setCurrentPage(1);
                                }}
                                className={`flex items-center justify-center gap-2 px-6 py-4 text-sm
                                 font-medium transition-all whitespace-nowrap snap-start min-w-[120px] border-b-2 
                                 hover:bg-gray-50 dark:hover:bg-gray-700/50
                                    ${activeTab === category.id
                                    ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20"
                                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                }`}
                            >
                                {category.icon}
                                <span>{category.label}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => scrollTabs("right")}
                        className="p-2 m-1 flex-shrink-0 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700
                        rounded-lg transition-colors z-10"
                        aria-label="Next tabs"
                    >
                        <MdChevronRight className="text-2xl" />
                    </button>
                </div>
            </div>

            {filteredNotifications.length > 0 && (
                <div
                    className="mb-4 flex items-center justify-between bg-white dark:bg-gray-800 px-4 py-2
                    rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={areAllVisibleSelected}
                            onChange={toggleAllSelection}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500
                            dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Selecionar todos
                                                        </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        Exibindo {filteredNotifications.length} de {totalNotifications}
                                                            </span>
                </div>
            )}

            <div className="space-y-4 min-h-[400px]">
                {isLoading && notifications.length === 0 ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i}
                             className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border
                             border-gray-200 dark:border-gray-700">
                            <div className="flex gap-4">
                                <Skeleton className="w-12 h-12 rounded-full" />
                                <div className="flex-1 space-y-3">
                                    <Skeleton className="h-5 w-3/4" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => {
                        const style = getNotificationStyle(notification.meta?.kind);
                        const isExpanded = expandedNotifications[notification.id];
                        const isSelected = selected.includes(notification.id);

                        return (
                            <div
                                key={notification.id}
                                className={`group bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-200
                                    ${!notification.read ? "border-l-4 border-l-blue-500 border-y-gray-200 dark:border-y-gray-700 " +
                                    "border-r-gray-200 dark:border-r-gray-700 bg-blue-50/10 dark:bg-blue-900/5" : "border-gray-200 " +
                                    "dark:border-gray-700"}
                                    ${isSelected ? "ring-2 ring-blue-500 dark:ring-blue-400" : "hover:shadow-md"}
                                `}
                            >
                                <div
                                    className="p-4 cursor-pointer"
                                    onClick={() => toggleExpand(notification.id)}
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelection(notification.id)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500
                                                dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                                            />
                                        </div>

                                        <div
                                            className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-2xl ${style.color} bg-gray-50 dark:bg-gray-700/50`}>
                                            {style.icon}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <h3 className={`text-base font-semibold text-gray-900 dark:text-white mb-1 ${!notification.read ? "font-bold" : ""}`}>
                                                    {getTranslatedTitle(notification.title)}
                                                </h3>
                                                <span
                                                    className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0"
                                                    suppressHydrationWarning
                                                >
                                                    {formatDate(notification.createdAt)}
                                                </span>
                                            </div>

                                            <div className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mb-2">
                                                {truncate(formatNotificationMessage(notification as unknown as NotificationData), 150)}
                                            </div>

                                            {(notification.meta?.sender || notification.sender) && (
                                                <div
                                                    className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <div
                                                        className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                                                        {(notification.meta?.sender?.name || notification.sender?.name) ? (
                                                            <span
                                                                className="font-medium text-[10px]">{(notification.meta?.sender?.name ||
                                                                notification.sender?.name || "")[0].toUpperCase()}</span>
                                                        ) : (
                                                            <MdPerson />
                                                        )}
                                                    </div>
                                                    <span>{notification.meta?.sender?.name || notification.sender?.name}</span>
                                                    {notification.meta?.companyName && (
                                                        <>
                                                            <span
                                                                className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                                                            <span className="flex items-center gap-1">
                                                                <MdBusiness className="text-xs" />
                                                                {notification.meta.companyName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => e.stopPropagation()}>
                                            {!notification.read && (
                                                <button
                                                    onClick={(e) => handleMarkRead(notification.id, e)}
                                                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                                                    title="Marcar como lida"
                                                >
                                                    <div className="w-2 h-2 rounded-full bg-current" />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setDeleteIds([notification.id]);
                                                    setDeleteConfirm(notification.id);
                                                }}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                                title="Excluir"
                                            >
                                                <MdPersonAdd className="text-lg rotate-45" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 animate-fadeIn">
                                        <div
                                            className="ml-16 pl-4 border-l-2 border-gray-100 dark:border-gray-700 pt-2 space-y-4">
                                            <div
                                                className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-300">
                                                {parseNotificationBody(
                                                    notification.body,
                                                    notification.title,
                                                    notification.meta,
                                                    { showFriendshipLink: true }
                                                )}
                                            </div>

                                            <div className="flex gap-3">
                                                {notification.meta?.inviteId && !notification.title.includes("ACCEPTED") && !notification.title.includes("REJECTED") && (
                                                    <Link
                                                        href={`/invites?id=${notification.meta.inviteId}`}
                                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                    >
                                                        <MdMail className="text-lg" /> Ver Convite
                                                    </Link>
                                                )}

                                                {notification.meta?.friendshipId && (notification.meta.kind === "friend.request.sent" || notification.title.includes("FRIEND_REQUEST_SENT")) && (
                                                    <Link
                                                        href={`/friends?id=${notification.meta.friendshipId}`}
                                                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                                                    >
                                                        <MdPersonAdd className="text-lg" /> Ver Solicitação
                                                    </Link>
                                                )}

                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setReplyingTo(notification.id);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                >
                                                    <MdChat className="text-lg" /> Responder
                                                </button>
                                            </div>

                                            {replyingTo === notification.id && (
                                                <div
                                                    className="mt-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm animate-slideDown">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                                            Responder
                                                            para {notification.meta?.sender?.name || notification.sender?.name || "Remetente"}
                                                        </h4>
                                                        <button
                                                            onClick={() => setReplyingTo(null)}
                                                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                                        >
                                                            <MdPersonAdd className="text-lg rotate-45" />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mb-3">
                                                        {getNotificationContext(notification)}
                                                    </p>
                                                    <textarea
                                                        value={replyBody}
                                                        onChange={(e) => setReplyBody(e.target.value)}
                                                        placeholder="Escreva sua resposta..."
                                                        className="w-full p-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-white min-h-[100px] resize-y mb-3"
                                                        autoFocus
                                                    />
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setReplyingTo(null)}
                                                            className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => handleReply(notification)}
                                                            disabled={!replyBody.trim() || replyMutation.isPending}
                                                            className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                                                        >
                                                            {replyMutation.isPending ? (
                                                                <div
                                                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <MdSend className="text-sm" />
                                                            )}
                                                            Enviar Resposta
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div
                        className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div
                            className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MdInbox className="text-3xl text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                            Nenhuma notificação encontrada
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400">
                            Não encontramos notificações nesta categoria.
                        </p>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex justify-center mt-8 gap-2">
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1 || isLoading}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <MdChevronLeft className="text-xl" />
                    </button>

                    <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                disabled={isLoading}
                                className={`w-10 h-10 rounded-lg font-medium transition-colors
                                    ${currentPage === page
                                    ? "bg-blue-600 text-white"
                                    : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages || isLoading}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <MdChevronRight className="text-xl" />
                    </button>
                </div>
            )}

            <ConfirmModal
                open={!!deleteConfirm}
                onCancel={() => setDeleteConfirm(null)}
                onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
                title="Excluir notificação"
                confirmLabel="Excluir"
                cancelLabel="Cancelar"
            >
                Tem certeza que deseja excluir esta notificação? Esta ação não pode ser desfeita.
            </ConfirmModal>

            <ConfirmModal
                open={showDeleteModal}
                onCancel={() => setShowDeleteModal(false)}
                onConfirm={() => handleBulkDelete(deleteIds)}
                title="Excluir notificações"
                confirmLabel="Excluir Selecionadas"
                cancelLabel="Cancelar"
            >
                {`Tem certeza que deseja excluir ${deleteIds.length} notificações selecionadas? Esta ação não pode ser desfeita.`}
            </ConfirmModal>
            
            <ConfirmModal
                open={showClearAllModal}
                onCancel={() => setShowClearAllModal(false)}
                onConfirm={handleClearAll}
                title="Limpar todas as notificações"
                confirmLabel="Limpar Tudo"
                cancelLabel="Cancelar"
            >
                Tem certeza que deseja excluir TODAS as suas notificações? Esta ação não pode ser desfeita.
            </ConfirmModal>
        </div>
    );
}

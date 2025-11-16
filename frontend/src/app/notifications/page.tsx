"use client";
import React, {useEffect, useState, useMemo} from 'react';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import {useQueryClient} from '@tanstack/react-query';
import Skeleton from '../../components/skeleton/Skeleton';
import {queryKeys} from '../../lib/queryKeys';
import {ConfirmModal} from '../../components/modals/ConfirmModal';
import {subscribe, whenReady, RT_EVENTS} from '../../lib/realtime';
import {formatNotificationMessage, getNotificationStyle, NotificationData, removeEventCodeFromTitle, extractEventCode} from '../../lib/notification-messages';
import {formatDate} from '../../lib/date-utils';
import {translateChannel, translateRole, translateGenericMessage, getNotificationCodeMessage} from '../../lib/messages';
import {DEFAULT_COMPANY_LOGO} from '../../types';
import {MdPerson, MdBusiness, MdMail, MdPersonAdd, MdRefresh, MdChevronLeft, MdChevronRight, MdSend, MdInbox, MdEmail, MdWork, MdDescription, MdPersonPin, MdEvent, MdGroup, MdConfirmationNumber, MdLink, MdBadge, MdSwapHoriz, MdChat, MdTitle} from 'react-icons/md';
import {
    useNotifications,
    useMarkNotificationRead,
    useDeleteNotification,
    useDeleteNotifications,
    useReplyToNotification,
    type Notification,
} from '../../services/api/notification.api';
import {useProfile} from '../../services/api/auth.api';

function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

interface FormattedLine {
    icon: React.ReactNode;
    label: string;
    value: string;
    isDate?: boolean;
    isUrl?: boolean;
    url?: string;
}

function formatNotificationBody(body: string, title?: string): FormattedLine[] {
    if (!body) return [];
    
    const eventCode = extractEventCode(title || '');
    let formattedBody = body;
    
    if (eventCode) {
        formattedBody = formattedBody.replace(new RegExp(`${eventCode}:`, 'gi'), '').trim();
        formattedBody = formattedBody.replace(new RegExp(`\\[${eventCode}\\]`, 'gi'), '').trim();
    }
    
    const lines = formattedBody.split('\n').filter(line => line.trim());
    const formattedLines: FormattedLine[] = [];
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.match(/^[A-Z_]+:\[.*\]$/) || line.match(/^\[.*\]$/)) {
            const translated = translateGenericMessage(line);
            if (translated !== line) {
                formattedLines.push({
                    icon: <MdMail className="inline mr-1" />,
                    label: '',
                    value: translated
                });
                continue;
            }
        }
        
        const genericMessageMatch = line.match(/\[([^\]]+)\]/);
        if (genericMessageMatch) {
            const extractedMessage = `[${genericMessageMatch[1]}]`;
            const translated = translateGenericMessage(extractedMessage);
            if (translated !== extractedMessage) {
                const translatedLine = line.replace(extractedMessage, translated);
                formattedLines.push({
                    icon: <MdMail className="inline mr-1" />,
                    label: '',
                    value: translatedLine
                });
                continue;
            }
        }
        
        if (line.match(/^[A-Z_]+:\[.*\]$/)) {
            const genericMatch = line.match(/\[([^\]]+)\]/);
            if (genericMatch) {
                const extractedMessage = `[${genericMatch[1]}]`;
                const translated = translateGenericMessage(extractedMessage);
                if (translated !== extractedMessage) {
                    formattedLines.push({
                        icon: <MdMail className="inline mr-1" />,
                        label: '',
                        value: translated
                    });
                    continue;
                }
            }
            continue;
        }
        
        if (line.match(/^[A-Z_]+:$/)) {
            continue;
        }
        
        if (line.startsWith('Sender:')) {
            formattedLines.push({
                icon: <MdSend className="inline mr-1" />,
                label: 'Remetente:',
                value: line.replace('Sender:', '').trim()
            });
        } else if (line.startsWith('Recipient:')) {
            formattedLines.push({
                icon: <MdInbox className="inline mr-1" />,
                label: 'Destinatário:',
                value: line.replace('Recipient:', '').trim()
            });
        } else if (line.startsWith('Friend Email:')) {
            formattedLines.push({
                icon: <MdPerson className="inline mr-1" />,
                label: 'Email do Amigo:',
                value: line.replace('Friend Email:', '').trim()
            });
        } else if (line.startsWith('Company:')) {
            formattedLines.push({
                icon: <MdBusiness className="inline mr-1" />,
                label: 'Empresa:',
                value: line.replace('Company:', '').trim()
            });
        } else if (line.startsWith('Company ID:')) {
            formattedLines.push({
                icon: <MdBadge className="inline mr-1" />,
                label: 'ID da Empresa:',
                value: line.replace('Company ID:', '').trim()
            });
        } else if (line.startsWith('Description:')) {
            formattedLines.push({
                icon: <MdDescription className="inline mr-1" />,
                label: 'Descrição:',
                value: line.replace('Description:', '').trim()
            });
        } else if (line.startsWith('Primary Owner:')) {
            formattedLines.push({
                icon: <MdPersonPin className="inline mr-1" />,
                label: 'Proprietário Principal:',
                value: line.replace('Primary Owner:', '').trim()
            });
        } else if (line.startsWith('Created At:')) {
            const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}T[\d:.-]+Z?)/);
            if (dateMatch) {
                try {
                    const date = new Date(dateMatch[1]);
                    formattedLines.push({
                        icon: <MdEvent className="inline mr-1" />,
                        label: 'Empresa criada em: ',
                        value: date.toLocaleDateString('pt-BR', 
                            { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        isDate: true
                    });
                } catch {
                    formattedLines.push({
                        icon: <MdEvent className="inline mr-1" />,
                        label: 'Empresa criada em: ',
                        value: line.replace('Created At:', '').trim(),
                        isDate: true
                    });
                }
            } else {
                formattedLines.push({
                    icon: <MdEvent className="inline mr-1" />,
                    label: 'Data de Criação:',
                    value: line.replace('Created At:', '').trim(),
                    isDate: true
                });
            }
        } else if (line.startsWith('Members:')) {
            formattedLines.push({
                icon: <MdGroup className="inline mr-1" />,
                label: 'Membros:',
                value: line.replace('Members:', '').trim()
            });
        } else if (line.startsWith('Logo URL:')) {
            continue;
        } else if (line.startsWith('Invite ID:')) {
            formattedLines.push({
                icon: <MdConfirmationNumber className="inline mr-1" />,
                label: 'ID do Convite:',
                value: line.replace('Invite ID:', '').trim()
            });
        } else if (line.startsWith('Invite Email:')) {
            formattedLines.push({
                icon: <MdEmail className="inline mr-1" />,
                label: 'Email do Convite:',
                value: line.replace('Invite Email:', '').trim()
            });
        } else if (line.startsWith('Invite URL:')) {
            const urlMatch = line.match(/(https?:\/\/[^\s]+|www\.[^\s]+|\/[^\s]+)/);
            const url = urlMatch ? urlMatch[1] : line.replace('Invite URL:', '').trim();
            formattedLines.push({
                icon: <MdLink className="inline mr-1" />,
                label: 'Link do Convite:',
                value: url,
                isUrl: true,
                url: url
            });
        } else if (line.startsWith('Role:')) {
            const roleValue = line.replace('Role:', '').trim();
            formattedLines.push({
                icon: <MdWork className="inline mr-1" />,
                label: 'Cargo:',
                value: translateRole(roleValue)
            });
        } else if (line.startsWith('Previous Role:')) {
            const previousRoleValue = line.replace('Previous Role:', '').trim();
            formattedLines.push({
                icon: <MdSwapHoriz className="inline mr-1" />,
                label: 'Cargo Anterior:',
                value: translateRole(previousRoleValue)
            });
        } else if (line.startsWith('Message:')) {
            formattedLines.push({
                icon: <MdChat className="inline mr-1" />,
                label: 'Mensagem:',
                value: line.replace('Message:', '').trim()
            });
        } else if (line.startsWith('Title:')) {
            formattedLines.push({
                icon: <MdTitle className="inline mr-1" />,
                label: 'Título:',
                value: line.replace('Title:', '').trim()
            });
        } else {
            formattedLines.push({
                icon: null,
                label: '',
                value: line
            });
        }
    }
    
    return formattedLines;
}

function getNotificationContext(notification: Notification): string {
    const kind = (notification.meta?.kind || '').toLowerCase();
    const eventCode = extractEventCode(notification.title);
    const titleUpper = (notification.title || '').toUpperCase();
    const bodyUpper = (notification.body || '').toUpperCase();
    
    if (kind.includes('invite.created') || kind.includes('invites.created')) {
        return 'Esta é uma resposta sobre um convite para entrar em uma empresa';
    }
    if (kind.includes('invite.accepted') || kind.includes('invites.accepted')) {
        return 'Esta é uma resposta sobre um convite aceito';
    }
    if (kind.includes('invite.rejected') || kind.includes('invites.rejected')) {
        return 'Esta é uma resposta sobre um convite rejeitado';
    }
    if (kind.includes('role.changed') || kind.includes('membership.role.updated')) {
        return 'Esta é uma resposta sobre uma mudança de cargo';
    }
    if (kind.includes('member.added') || kind.includes('membership.joined')) {
        return 'Esta é uma resposta sobre um membro adicionado à empresa';
    }
    if (kind.includes('member.removed') || kind.includes('membership.removed')) {
        return 'Esta é uma resposta sobre um membro removido da empresa';
    }
    if (kind.includes('friend.request.sent')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade';
    }
    if (kind.includes('friend.request.accepted')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade aceita';
    }
    if (kind.includes('friend.request.rejected')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade rejeitada';
    }
    if (kind.includes('friend.removed')) {
        return 'Esta é uma resposta sobre uma remoção de amizade';
    }
    if (kind.includes('notification.sent') || kind.includes('notifications.sent')) {
        return 'Esta é uma resposta sobre uma notificação';
    }
    if (kind.includes('company.created')) {
        return 'Esta é uma resposta sobre uma empresa criada';
    }
    if (kind.includes('company.updated')) {
        return 'Esta é uma resposta sobre uma empresa atualizada';
    }
    if (kind.includes('company.deleted')) {
        return 'Esta é uma resposta sobre uma empresa excluída';
    }
    
    if (eventCode === 'INVITE_CREATED' || titleUpper.includes('INVITE_CREATED') || bodyUpper.includes('CONVITE')) {
        return 'Esta é uma resposta sobre um convite para entrar em uma empresa';
    }
    if (eventCode === 'INVITE_ACCEPTED' || titleUpper.includes('INVITE_ACCEPTED')) {
        return 'Esta é uma resposta sobre um convite aceito';
    }
    if (eventCode === 'INVITE_REJECTED' || titleUpper.includes('INVITE_REJECTED') || titleUpper.includes('REJECT_COMPANY_INVITE')) {
        return 'Esta é uma resposta sobre um convite rejeitado';
    }
    if (eventCode === 'ROLE_CHANGED' || eventCode === 'USER_STATUS_UPDATED' || titleUpper.includes('ROLE_CHANGED') || titleUpper.includes('USER_STATUS_UPDATED') || bodyUpper.includes('CARGO')) {
        return 'Esta é uma resposta sobre uma mudança de cargo';
    }
    if (eventCode === 'MEMBER_ADDED' || eventCode === 'USER_JOINED' || titleUpper.includes('MEMBER_ADDED') || titleUpper.includes('USER_JOINED')) {
        return 'Esta é uma resposta sobre um membro adicionado à empresa';
    }
    if (eventCode === 'MEMBER_REMOVED' || eventCode === 'USER_REMOVED' || titleUpper.includes('MEMBER_REMOVED') || titleUpper.includes('USER_REMOVED')) {
        return 'Esta é uma resposta sobre um membro removido da empresa';
    }
    if (eventCode === 'FRIEND_REQUEST_SENT' || titleUpper.includes('FRIEND_REQUEST_SENT')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade';
    }
    if (eventCode === 'FRIEND_REQUEST_ACCEPTED' || eventCode === 'ACCEPTED_FRIEND' || titleUpper.includes('FRIEND_REQUEST_ACCEPTED') || titleUpper.includes('ACCEPTED_FRIEND')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade aceita';
    }
    if (eventCode === 'FRIEND_REQUEST_REJECTED' || eventCode === 'REJECTED_FRIEND' || titleUpper.includes('FRIEND_REQUEST_REJECTED') || titleUpper.includes('REJECTED_FRIEND')) {
        return 'Esta é uma resposta sobre uma solicitação de amizade rejeitada';
    }
    if (eventCode === 'FRIEND_REMOVED' || titleUpper.includes('FRIEND_REMOVED')) {
        return 'Esta é uma resposta sobre uma remoção de amizade';
    }
    if (eventCode === 'COMPANY_CREATED' || titleUpper.includes('COMPANY_CREATED')) {
        return 'Esta é uma resposta sobre uma empresa criada';
    }
    if (eventCode === 'NOTIFICATION_SENT' || titleUpper.includes('NOTIFICATION_SENT')) {
        return 'Esta é uma resposta sobre uma notificação';
    }
    
    // Fallback: try to infer from body content
    if (bodyUpper.includes('CONVITE') || bodyUpper.includes('INVITE')) {
        return 'Esta é uma resposta sobre um convite';
    }
    if (bodyUpper.includes('CARGO') || bodyUpper.includes('ROLE') || bodyUpper.includes('PAPEL')) {
        return 'Esta é uma resposta sobre uma mudança de cargo';
    }
    if (bodyUpper.includes('MEMBRO') || bodyUpper.includes('MEMBER')) {
        return 'Esta é uma resposta sobre um membro';
    }
    if (bodyUpper.includes('AMIGO') || bodyUpper.includes('FRIEND')) {
        return 'Esta é uma resposta sobre uma amizade';
    }
    
    return 'Esta é uma resposta a uma notificação anterior';
}

function parseNotificationBody(body: string, title?: string, meta?: Notification['meta']): React.ReactNode {
    if (!body) return null;
    
    const formattedLines = formatNotificationBody(body, title);
    
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
                                    href={line.url.startsWith('http') ? line.url : line.url.startsWith('/') ? line.url : `https://${line.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 dark:text-blue-400 hover:underline break-all font-medium"
                                >
                                    {line.url}
                                </a>
                            ) : (
                                <span className="text-gray-700 dark:text-gray-300">
                                    {(() => {
                                        // Always try to translate generic messages
                                        if (line.value.includes('[') && line.value.includes(']')) {
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
        </div>
    );
}

type NotificationTab = 'all' | 'friends' | 'company-messages' | 'invites' | 'members' | 'roles';

interface NotificationCategory {
    id: NotificationTab;
    label: string;
    icon: React.ReactNode;
    filter: (notification: Notification) => boolean;
}

export default function NotificationsPage() {
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyBody, setReplyBody] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
    const [activeTab, setActiveTab] = useState<NotificationTab>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [tabIndex, setTabIndex] = useState(0);
    const [selected, setSelected] = useState<string[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteIds, setDeleteIds] = useState<string[]>([]);
    const itemsPerPage = 10;
    const {show} = useToast();
    const queryClient = useQueryClient();

    const {data: notifications = [], isLoading} = useNotifications();
    const profileQuery = useProfile();
    const currentUserId = profileQuery.data?.id || null;

    const baseCategories: NotificationCategory[] = useMemo(() => [
        {
            id: 'friends',
            label: 'Solicitações de Amizade',
            icon: <MdPerson className="text-lg" />,
                    filter: (notification) => {
                        const kind = notification.meta?.kind || '';
                        const title = (notification.title || '').toUpperCase();
                        const eventCode = extractEventCode(notification.title || '')?.toUpperCase();
                        return kind.includes('friend') || 
                               title.includes('FRIEND') || 
                               (eventCode?.includes('FRIEND') ?? false) ||
                               eventCode === 'FRIEND_REQUEST_SENT' ||
                               eventCode === 'FRIEND_REQUEST_ACCEPTED' ||
                               eventCode === 'ACCEPTED_FRIEND' ||
                               eventCode === 'REJECTED_FRIEND' ||
                               eventCode === 'FRIEND_REMOVED' ||
                               notification.meta?.channel === 'friend';
                    },
        },
        {
            id: 'company-messages',
            label: 'Mensagens da Empresa',
            icon: <MdMail className="text-lg" />,
                    filter: (notification) => {
                        const kind = notification.meta?.kind || '';
                        const title = (notification.title || '').toUpperCase();
                        const eventCode = extractEventCode(notification.title || '')?.toUpperCase();
                        return (kind === 'notification.sent' || kind === 'notification.reply') ||
                               title.includes('NOTIFICATION_SENT') || 
                               title.includes('MENSAGEM') ||
                               eventCode === 'NOTIFICATION_SENT' ||
                               (notification.meta?.channel === 'company' && kind.includes('notification'));
                    },
        },
        {
            id: 'invites',
            label: 'Convites de Empresa',
            icon: <MdBusiness className="text-lg" />,
                    filter: (notification) => {
                        const kind = notification.meta?.kind || '';
                        const title = (notification.title || '').toUpperCase();
                        const eventCode = extractEventCode(notification.title || '')?.toUpperCase();
                        return kind.includes('invite') || 
                               title.includes('INVITE') || 
                               title.includes('CONVITE') ||
                               (eventCode?.includes('INVITE') ?? false) ||
                               eventCode === 'INVITE_CREATED' ||
                               eventCode === 'INVITE_ACCEPTED' ||
                               eventCode === 'INVITE_REJECTED' ||
                               eventCode === 'REJECT_COMPANY_INVITE';
                    },
        },
        {
            id: 'members',
            label: 'Mudanças de Membros',
            icon: <MdPersonAdd className="text-lg" />,
                    filter: (notification) => {
                        if (!currentUserId) return false;
                        
                        const kind = notification.meta?.kind || '';
                        const title = (notification.title || '').toUpperCase();
                        const eventCode = extractEventCode(notification.title || '')?.toUpperCase();
                        const recipientUserId = notification.recipientUserId || notification.meta?.recipientUserId;
                        
                        const isMemberOrRoleEvent = kind.includes('member') || 
                                                   kind.includes('membership') ||
                                                   kind.includes('role') ||
                                                   title.includes('MEMBER') || 
                                                   title.includes('MEMBRO') ||
                                                   title.includes('ROLE') ||
                                                   title.includes('CARGO') ||
                                                   title.includes('PAPEL') ||
                                                   (eventCode?.includes('MEMBER') ?? false) ||
                                                   (eventCode?.includes('ROLE') ?? false) ||
                                                   (eventCode === 'MEMBER_ADDED') ||
                                                   (eventCode === 'MEMBER_REMOVED') ||
                                                   (eventCode === 'USER_JOINED') ||
                                                   (eventCode === 'USER_REMOVED') ||
                                                   (eventCode === 'ROLE_CHANGED') ||
                                                   (eventCode === 'USER_STATUS_UPDATED');
                        
                        if (!isMemberOrRoleEvent) return false;
                        
                        return recipientUserId !== currentUserId;
                    },
        },
        {
            id: 'roles',
            label: 'Mudanças de Cargo',
            icon: <MdRefresh className="text-lg" />,
                    filter: (notification) => {
                        if (!currentUserId) return false;
                        
                        const kind = notification.meta?.kind || '';
                        const title = (notification.title || '').toUpperCase();
                        const eventCode = extractEventCode(notification.title || '')?.toUpperCase();
                        const recipientUserId = notification.recipientUserId || notification.meta?.recipientUserId;
                        
                        const isMemberOrRoleEvent = kind.includes('member') || 
                                                   kind.includes('membership') ||
                                                   kind.includes('role') ||
                                                   title.includes('MEMBER') || 
                                                   title.includes('MEMBRO') ||
                                                   title.includes('ROLE') ||
                                                   title.includes('CARGO') ||
                                                   title.includes('PAPEL') ||
                                                   (eventCode?.includes('MEMBER') ?? false) ||
                                                   (eventCode?.includes('ROLE') ?? false) ||
                                                   (eventCode === 'MEMBER_ADDED') ||
                                                   (eventCode === 'MEMBER_REMOVED') ||
                                                   (eventCode === 'USER_JOINED') ||
                                                   (eventCode === 'USER_REMOVED') ||
                                                   (eventCode === 'ROLE_CHANGED') ||
                                                   (eventCode === 'USER_STATUS_UPDATED');
                        
                        if (!isMemberOrRoleEvent) return false;
                        
                        return recipientUserId === currentUserId;
                    },
        },
    ], [currentUserId]);

    const dynamicCategories = useMemo(() => {
        const categoriesWithNotifications = baseCategories.map(category => {
            const filtered = notifications.filter(category.filter);
            const latestNotification = filtered.length > 0 
                ? filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
                : null;
            
            return {
                ...category,
                count: filtered.length,
                latestTimestamp: latestNotification ? new Date(latestNotification.createdAt).getTime() : 0,
            };
        });

        return categoriesWithNotifications
            .filter(cat => cat.count > 0)
            .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
            .map(({count, latestTimestamp, ...category}) => category);
    }, [notifications, baseCategories]);

    const allCategories: NotificationCategory[] = useMemo(() => [
        {
            id: 'all',
            label: 'Todas',
            icon: <MdMail className="text-lg" />,
            filter: () => true,
        },
        ...dynamicCategories,
    ], [dynamicCategories]);

    const filteredNotifications = useMemo(() => {
        let filtered = notifications;
        if (activeTab !== 'all') {
            const category = allCategories.find(cat => cat.id === activeTab);
            if (category) {
                filtered = notifications.filter(category.filter);
            }
        }
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [notifications, activeTab, allCategories]);

    const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedNotifications = filteredNotifications.slice(startIndex, endIndex);

    useEffect(() => {
        setCurrentPage(1);
    }, [activeTab]);

    const categoryCounts = useMemo(() => {
        const counts: Record<NotificationTab, number> = {
            all: notifications.length,
            friends: 0,
            'company-messages': 0,
            invites: 0,
            members: 0,
            roles: 0,
        };
        
        baseCategories.forEach(category => {
            if (category.id !== 'all') {
                counts[category.id] = notifications.filter(category.filter).length;
            }
        });
        
        return counts;
    }, [notifications, baseCategories]);

    const visibleTabs = useMemo(() => {
        const tabs = allCategories.filter(cat => cat.id === 'all' || categoryCounts[cat.id] > 0);
        return tabs;
    }, [allCategories, categoryCounts]);

    const maxVisibleTabs = 3;
    
    const activeIndex = useMemo(() => {
        return visibleTabs.findIndex(tab => tab.id === activeTab);
    }, [visibleTabs, activeTab]);
    
    useEffect(() => {
        const currentActiveIndex = visibleTabs.findIndex(tab => tab.id === activeTab);
        if (currentActiveIndex !== -1 && visibleTabs.length > 0) {
            const maxStart = Math.max(0, visibleTabs.length - maxVisibleTabs);
            const newTabIndex = Math.max(0, Math.min(currentActiveIndex, maxStart));
            
            setTabIndex(prev => {
                const currentStart = Math.max(0, Math.min(prev, maxStart));
                const currentEnd = currentStart + maxVisibleTabs;
                
                if (currentActiveIndex < currentStart || currentActiveIndex >= currentEnd) {
                    return newTabIndex;
                }
                return prev;
            });
        }
    }, [activeTab, visibleTabs]); 
    
    const startTabIndex = useMemo(() => {
        return Math.max(0, Math.min(tabIndex, Math.max(0, visibleTabs.length - maxVisibleTabs)));
    }, [tabIndex, visibleTabs.length, maxVisibleTabs]);
    
    const visibleTabsSlice = useMemo(() => {
        return visibleTabs.slice(startTabIndex, startTabIndex + maxVisibleTabs);
    }, [visibleTabs, startTabIndex, maxVisibleTabs]);

    const handlePreviousTab = () => {
        setTabIndex(prev => {
            const newIndex = Math.max(0, prev - 1);
            return newIndex;
        });
    };

    const handleNextTab = () => {
        setTabIndex(prev => {
            const newIndex = Math.min(Math.max(0, visibleTabs.length - maxVisibleTabs), prev + 1);
            return newIndex;
        });
    };

    useEffect(() => {
        let active = true;
        const unsubscribers: Array<() => void> = [];
        let debounceTimer: NodeJS.Timeout | null = null;

        whenReady().then(() => {
            if (!active) return;
            const refetch = () => {
                if (!active) return;
                
                if (debounceTimer) {
                    clearTimeout(debounceTimer);
                }
                
                debounceTimer = setTimeout(() => {
                    if (!active) return;
                    queryClient.invalidateQueries({
                        queryKey: queryKeys.notifications(),
                    }).catch((error: any) => {
                        if (error?.name !== 'CancelledError') {
                            console.error('[NotificationsPage] Error invalidating queries:', error);
                        }
                    });
                }, 300);
            };
            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_READ, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_ACCEPTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.INVITE_REJECTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_SENT, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REQUEST_ACCEPTED, refetch));
            unsubscribers.push(subscribe(RT_EVENTS.FRIEND_REMOVED, refetch));
        });

        return () => {
            active = false;
            if (debounceTimer) {
                clearTimeout(debounceTimer);
            }
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [queryClient]);

    const markReadMutation = useMarkNotificationRead();
    const deleteMutation = useDeleteNotification();
    const deleteNotificationsMutation = useDeleteNotifications();
    const replyMutation = useReplyToNotification();

    const handleReply = () => {
        if (!replyBody.trim()) {
            show({message: 'Por favor escreva uma resposta', type: 'error'});
            return;
        }
        if (!replyingTo) return;
        replyMutation.mutate({id: replyingTo, body: replyBody.trim()}, {
            onSuccess: () => {
                setReplyingTo(null);
                setReplyBody('');
                show({message: 'Resposta enviada', type: 'success'});
            },
            onError: (error) => {
                show({message: getErrorMessage(error), type: 'error'});
            },
        });
    };

    function handleSelectAll(items: Notification[]) {
        setSelected(items.map(i => i.id));
    }

    function handleDelete(ids: string[]) {
        setShowDeleteModal(false);
        if (ids.length === 1) {
            deleteMutation.mutate(ids[0], {
                onSuccess: () => {
                    setSelected([]);
                    setDeleteIds([]);
                    show({message: 'Notificação deletada', type: 'success'});
                },
                onError: (err: any) => {
                    const m = getErrorMessage(err, 'Não foi possível deletar a notificação');
                    show({type: 'error', message: m});
                },
            });
        } else {
            deleteNotificationsMutation.mutate(ids, {
                onSuccess: () => {
                    setSelected([]);
                    setDeleteIds([]);
                    show({message: 'Notificações deletadas', type: 'success'});
                },
                onError: (err: any) => {
                    const m = getErrorMessage(err, 'Não foi possível deletar as notificações');
                    show({type: 'error', message: m});
                },
            });
        }
    }

    useEffect(() => {
        setSelected([]);
    }, [activeTab]);

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Notificações</h1>
                    <p className="text-gray-600 dark:text-gray-400">Gerencie suas notificações e mensagens</p>
                </div>
                <Skeleton className="h-32 mb-4"/>
                <Skeleton className="h-32 mb-4"/>
                <Skeleton className="h-32"/>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Notificações</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas notificações e mensagens.</p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-800 w-full">
                <div className="flex items-center gap-2 w-full">
                    {startTabIndex > 0 && (
                        <button
                            onClick={handlePreviousTab}
                            className="flex-shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            aria-label="Aba anterior"
                        >
                            <MdChevronLeft className="text-xl text-gray-600 dark:text-gray-400" />
                        </button>
                    )}
                    
                    <nav className="flex-1 flex space-x-1 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                        {visibleTabsSlice.map((category) => (
                            <button
                                key={category.id}
                                onClick={() => setActiveTab(category.id)}
                                className={`
                                    flex items-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                                    ${activeTab === category.id
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    }
                                `}
                            >
                                <span className="hidden xs:inline">{category.icon}</span>
                                <span className="text-xs sm:text-sm">{category.label}</span>
                                {categoryCounts[category.id] > 0 && (
                                    <span className={`
                                        ml-1 px-1.5 sm:px-2 py-0.5 text-xs rounded-full flex-shrink-0
                                        ${activeTab === category.id
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                                        }
                                    `}>
                                        {categoryCounts[category.id]}
                                    </span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {(startTabIndex + maxVisibleTabs < visibleTabs.length) && visibleTabs.length > maxVisibleTabs && (
                        <button
                            onClick={handleNextTab}
                            className="flex-shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            aria-label="Próxima aba"
                        >
                            <MdChevronRight className="text-xl text-gray-600 dark:text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {filteredNotifications.length === 0 ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 sm:p-12 text-center bg-gray-50 dark:bg-gray-900">
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                        {notifications.length === 0 
                            ? 'Nenhuma notificação encontrada'
                            : `Nenhuma notificação encontrada na categoria "${allCategories.find(c => c.id === activeTab)?.label || 'selecionada'}"`
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex flex-wrap gap-2 mb-4">
                        <button 
                            className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap" 
                            onClick={() => handleSelectAll(paginatedNotifications)}
                        >
                            Selecionar todos
                        </button>
                        <button 
                            className="px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap" 
                            disabled={!selected.length} 
                            onClick={() => { 
                                setDeleteIds(selected); 
                                setShowDeleteModal(true); 
                            }}
                        >
                            Deletar selecionados
                        </button>
                        <button 
                            className="px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap" 
                            disabled={!paginatedNotifications.length} 
                            onClick={() => { 
                                setDeleteIds(paginatedNotifications.map(n => n.id)); 
                                setShowDeleteModal(true); 
                            }}
                        >
                            Limpar todos
                        </button>
                    </div>
                    <div className="space-y-4">
                        {paginatedNotifications.map((notification) => {
                            const notificationData: NotificationData = {
                                id: notification.id,
                                title: notification.title,
                                body: notification.body,
                                createdAt: notification.createdAt,
                                read: notification.read,
                                senderUserId: notification.senderUserId || notification.senderId || '',
                                recipientUserId: notification.recipientUserId || null,
                                companyId: notification.companyId || null,
                                meta: notification.meta,
                            };
                            
                            return (
                                <div
                                    key={notification.id}
                                    className={`border rounded-lg p-4 sm:p-6 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 ${
                                        notification.read 
                                            ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950' 
                                            : 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20'
                                    }`}
                                >
                                    <div className="flex items-start gap-3 mb-4">
                                        <input 
                                            type="checkbox" 
                                            checked={selected.includes(notification.id)} 
                                            onChange={e => {
                                                setSelected(sel => e.target.checked ? [...sel, notification.id] : sel.filter(sid => sid !== notification.id));
                                            }} 
                                            className="mt-1 flex-shrink-0 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2 flex-wrap mb-2">
                                                <span className={getNotificationStyle(notification.meta?.kind).color}>
                                                    {getNotificationStyle(notification.meta?.kind).icon}
                                                </span>
                                                <span className="break-words">{removeEventCodeFromTitle(formatNotificationMessage(notificationData))}</span>
                                                {!notification.read && (
                                                    <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs px-2 py-1 rounded whitespace-nowrap">
                                                        Nova
                                                    </span>
                                                )}
                                                {notification.meta?.kind === 'notifications.reply' && (
                                                    <span className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs px-2 py-1 rounded whitespace-nowrap">
                                                        Resposta
                                                    </span>
                                                )}
                                            </h3>
                                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                <div><strong>De:</strong> {notification.meta?.sender?.name || notification.senderName || 'Usuário Desconhecido'} ({notification.meta?.sender?.email || notification.senderUserId || notification.senderId || 'N/A'})</div>
                                                <div><strong>Data e Hora:</strong> {notification.createdAt ? formatDate(notification.createdAt) : '-'}</div>
                                                {notification.meta?.channel && (
                                                    <div><strong>Canal:</strong> {translateChannel(notification.meta.channel)}</div>
                                                )}
                                                {notification.companyId && (
                                                    <div><strong>ID da Empresa:</strong> {notification.companyId}</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {notification.meta?.company && (
                                        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-800">
                                            <div className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Empresa:</div>
                                            <div className="flex items-start gap-3">
                                                {notification.meta.company.logoUrl && (
                                                    <img 
                                                        src={notification.meta.company.logoUrl || DEFAULT_COMPANY_LOGO} 
                                                        alt={notification.meta.company.name}
                                                        className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-800 flex-shrink-0"
                                                        onError={(e) => {
                                                            const target = e.target as HTMLImageElement;
                                                            if (target.src !== DEFAULT_COMPANY_LOGO) {
                                                                target.src = DEFAULT_COMPANY_LOGO;
                                                            }
                                                        }}
                                                    />
                                                )}
                                                <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                    <div><strong>Nome:</strong> {notification.meta.company.name}</div>
                                                    {notification.meta.company.description && (
                                                        <div><strong>Descrição:</strong> {notification.meta.company.description}</div>
                                                    )}
                                                    {notification.meta.company.memberCount !== undefined && (
                                                        <div><strong>Membros:</strong> {notification.meta.company.memberCount}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-4">
                                        <div className="text-sm sm:text-base text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-800">
                                            {expandedNotifications[notification.id] ? (
                                                parseNotificationBody(notification.body, notification.title, notification.meta)
                                            ) : (
                                                <>
                                                    {parseNotificationBody(truncate(notification.body, 400), notification.title, notification.meta)}
                                                    {notification.body.length > 400 && (
                                                        <button
                                                            className="text-blue-600 dark:text-blue-400 underline ml-2 text-sm"
                                                            onClick={() =>
                                                                setExpandedNotifications((prev) => ({
                                                                    ...prev,
                                                                    [notification.id]: !prev[notification.id],
                                                                }))
                                                            }
                                                        >
                                                            Ler mais
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                            {notification.body.length > 400 && expandedNotifications[notification.id] && (
                                                <button
                                                    className="text-blue-600 dark:text-blue-400 underline ml-2 text-sm block mt-2"
                                                    onClick={() =>
                                                        setExpandedNotifications((prev) => ({
                                                            ...prev,
                                                            [notification.id]: !prev[notification.id],
                                                        }))
                                                    }
                                                >
                                                    Mostrar menos
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2 justify-center mb-4 p-3 border border-gray-900 dark:border-white rounded-lg">
                                        {!notification.read && (
                                            <button
                                                onClick={() => markReadMutation.mutate(notification.id, {
                                                    onSuccess: () => {
                                                        show({message: 'Notificação marcada como lida', type: 'success'});
                                                    },
                                                    onError: (error) => {
                                                        show({message: getErrorMessage(error), type: 'error'});
                                                    },
                                                })}
                                                className="px-4 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 transition-colors font-medium whitespace-nowrap flex-1 min-w-[120px]"
                                                disabled={markReadMutation.isPending}
                                            >
                                                Marcar como lida
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setReplyingTo(notification.id)}
                                            className="px-4 py-2 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium whitespace-nowrap flex-1 min-w-[120px]"
                                        >
                                            Responder
                                        </button>
                                        <button
                                            onClick={() => setDeleteConfirm(notification.id)}
                                            className="px-4 py-2 text-xs sm:text-sm border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium whitespace-nowrap flex-1 min-w-[120px]"
                                        >
                                            Excluir
                                        </button>
                                    </div>

                                    {notification.meta?.kind === 'notifications.reply' && (() => {
                                        const originalNotificationId = notification.meta?.originalNotificationId;
                                        const originalNotification = originalNotificationId 
                                            ? notifications.find(n => String(n.id) === String(originalNotificationId))
                                            : null;
                                        
                                        return originalNotification ? (
                                            <div className="mt-4 pt-4 border-t-2 border-gray-300 dark:border-gray-700">
                                                <div className="mb-3">
                                                    <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                                        Contexto: {getNotificationContext(originalNotification)}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                                                    <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-200 dark:border-gray-800">
                                                        Notificação Original
                                                    </div>
                                                    <div className="space-y-2 text-sm">
                                                        <div>
                                                            <strong className="text-gray-600 dark:text-gray-400">Assunto:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{removeEventCodeFromTitle(originalNotification.title)}</span>
                                                        </div>
                                                        <div>
                                                            <strong className="text-gray-600 dark:text-gray-400">De:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta?.sender?.name || originalNotification.senderName || 'Usuário Desconhecido'}</span>
                                                        </div>
                                                        <div>
                                                            <strong className="text-gray-600 dark:text-gray-400">Email:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta?.sender?.email || originalNotification.senderUserId || originalNotification.senderId || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <strong className="text-gray-600 dark:text-gray-400">Data & Hora:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{formatDate(originalNotification.createdAt)}</span>
                                                        </div>
                                                        {originalNotification.companyId && (
                                                            <div>
                                                                <strong className="text-gray-600 dark:text-gray-400">ID da Empresa:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.companyId}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {originalNotification.meta?.company && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            <strong className="text-sm text-gray-600 dark:text-gray-400">Empresa:</strong>
                                                            <div className="mt-1 space-y-1 text-sm">
                                                                <div><strong className="text-gray-600 dark:text-gray-400">Nome:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.company.name}</span></div>
                                                                {originalNotification.meta.company.description && (
                                                                    <div><strong className="text-gray-600 dark:text-gray-400">Descrição:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.company.description}</span></div>
                                                                )}
                                                                {originalNotification.meta.company.memberCount !== undefined && (
                                                                    <div><strong className="text-gray-600 dark:text-gray-400">Membros:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.company.memberCount}</span></div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {originalNotification.meta?.role && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Cargo:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateRole(originalNotification.meta.role)}</span></div>
                                                            {originalNotification.meta.previousRole && (
                                                                <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Cargo Anterior:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateRole(originalNotification.meta.previousRole)}</span></div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {(originalNotification.meta?.inviteId || originalNotification.meta?.inviteEmail || originalNotification.meta?.inviteUrl) && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            {originalNotification.meta.inviteId && (
                                                                <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">ID do Convite:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.inviteId}</span></div>
                                                            )}
                                                            {originalNotification.meta.inviteEmail && (
                                                                <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Email do Convite:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.inviteEmail}</span></div>
                                                            )}
                                                            {originalNotification.meta.inviteUrl && (
                                                                <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Link do Convite:</strong> <a href={originalNotification.meta.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all ml-1">{originalNotification.meta.inviteUrl}</a></div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {originalNotification.meta?.rejectedByName && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Rejeitado por:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.rejectedByName} {originalNotification.meta.rejectedByEmail && `(${originalNotification.meta.rejectedByEmail})`}</span></div>
                                                        </div>
                                                    )}
                                                    {originalNotification.meta?.removedBy && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Removido por:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalNotification.meta.removedBy.name} ({originalNotification.meta.removedBy.email})</span></div>
                                                        </div>
                                                    )}
                                                    {originalNotification.meta?.channel && originalNotification.meta.channel === 'friend' && (
                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                            <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Canal:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateChannel(originalNotification.meta.channel)}</span></div>
                                                        </div>
                                                    )}
                                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                        <strong className="text-sm text-gray-600 dark:text-gray-400">Mensagem Original:</strong>
                                                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800">
                                                            {parseNotificationBody(originalNotification.body, originalNotification.title, originalNotification.meta)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            const originalMeta = notification.meta?.originalMeta;
                                            const originalTitle = notification.meta?.originalTitle || notification.title;
                                            const originalBody = notification.meta?.originalBody || '';
                                            
                                            return (
                                                <div className="mt-4 pt-4 border-t-2 border-gray-300 dark:border-gray-700">
                                                    <div className="mb-3">
                                                        <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                                                            Contexto: {getNotificationContext({ ...notification, title: originalTitle, meta: originalMeta } as Notification)}
                                                        </div>
                                                    </div>
                                                    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
                                                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b border-gray-200 dark:border-gray-800">
                                                            Notificação Original
                                                        </div>
                                                        <div className="space-y-2 text-sm">
                                                            <div>
                                                                <strong className="text-gray-600 dark:text-gray-400">Assunto:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{removeEventCodeFromTitle(originalTitle)}</span>
                                                            </div>
                                                            {originalMeta?.sender && (
                                                                <>
                                                                    <div>
                                                                        <strong className="text-gray-600 dark:text-gray-400">De:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.sender.name || 'Usuário Desconhecido'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <strong className="text-gray-600 dark:text-gray-400">Email:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.sender.email || 'N/A'}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            {notification.companyId && (
                                                                <div>
                                                                    <strong className="text-gray-600 dark:text-gray-400">ID da Empresa:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{notification.companyId}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {originalMeta?.company && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <strong className="text-sm text-gray-600 dark:text-gray-400">Empresa:</strong>
                                                                <div className="mt-1 space-y-1 text-sm">
                                                                    <div><strong className="text-gray-600 dark:text-gray-400">Nome:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.company.name}</span></div>
                                                                    {originalMeta.company.description && (
                                                                        <div><strong className="text-gray-600 dark:text-gray-400">Descrição:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.company.description}</span></div>
                                                                    )}
                                                                    {originalMeta.company.memberCount !== undefined && (
                                                                        <div><strong className="text-gray-600 dark:text-gray-400">Membros:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.company.memberCount}</span></div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {originalMeta?.role && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Cargo:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateRole(originalMeta.role)}</span></div>
                                                                {originalMeta.previousRole && (
                                                                    <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Cargo Anterior:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateRole(originalMeta.previousRole)}</span></div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {(originalMeta?.inviteId || originalMeta?.inviteEmail || originalMeta?.inviteUrl) && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                {originalMeta.inviteId && (
                                                                    <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">ID do Convite:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.inviteId}</span></div>
                                                                )}
                                                                {originalMeta.inviteEmail && (
                                                                    <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Email do Convite:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.inviteEmail}</span></div>
                                                                )}
                                                                {originalMeta.inviteUrl && (
                                                                    <div className="text-sm mt-1"><strong className="text-gray-600 dark:text-gray-400">Link do Convite:</strong> <a href={originalMeta.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all ml-1">{originalMeta.inviteUrl}</a></div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {originalMeta?.rejectedByName && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Rejeitado por:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.rejectedByName} {originalMeta.rejectedByEmail && `(${originalMeta.rejectedByEmail})`}</span></div>
                                                            </div>
                                                        )}
                                                        {originalMeta?.removedBy && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Removido por:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{originalMeta.removedBy.name} ({originalMeta.removedBy.email})</span></div>
                                                            </div>
                                                        )}
                                                        {originalMeta?.channel && originalMeta.channel === 'friend' && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <div className="text-sm"><strong className="text-gray-600 dark:text-gray-400">Canal:</strong> <span className="text-gray-700 dark:text-gray-300 ml-1">{translateChannel(originalMeta.channel)}</span></div>
                                                            </div>
                                                        )}
                                                        {originalBody && (
                                                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                                                <strong className="text-sm text-gray-600 dark:text-gray-400">Mensagem Original:</strong>
                                                                <div className="text-sm text-gray-700 dark:text-gray-300 mt-2 p-2 bg-white dark:bg-gray-950 rounded border border-gray-200 dark:border-gray-800">
                                                                    {parseNotificationBody(originalBody, originalTitle, originalMeta)}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })();
                                    })()}
                                </div>
                            );
                        })}
                    </div>

                    {totalPages > 1 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                            <div className="flex items-center gap-2 flex-wrap justify-center">
                                <button 
                                    className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                >
                                    Anterior
                                </button>
                                <span className="text-sm text-gray-600 dark:text-gray-400">Página {currentPage}</span>
                                <button 
                                    className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                                    onClick={() => setCurrentPage(p => p + 1)} 
                                    disabled={currentPage >= totalPages}
                                >
                                    Próxima
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {replyingTo && (
                <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[9999]">
                    <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 shadow-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Responder Notificação</h3>
                        {(() => {
                            const notification = notifications.find(n => n.id === replyingTo);
                            return notification ? (
                                <div className="mb-4 space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded border">
                                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 pb-2 border-b border-gray-200 dark:border-gray-800">
                                        <strong>Contexto:</strong> {getNotificationContext(notification)}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-sm">
                                            <strong>Assunto:</strong> <span className="text-gray-700 dark:text-gray-300">{(() => {
                                                const eventCode = extractEventCode(notification.title);
                                                if (eventCode) {
                                                    const translated = getNotificationCodeMessage(eventCode);
                                                    if (translated !== eventCode) {
                                                        return translated;
                                                    }
                                                }
                                                const titleUpper = notification.title.toUpperCase().trim();
                                                const translated = getNotificationCodeMessage(titleUpper);
                                                if (translated !== titleUpper) {
                                                    return translated;
                                                }
                                                return removeEventCodeFromTitle(notification.title);
                                            })()}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>De:</strong>
                                            <span className="text-gray-700 dark:text-gray-300">{notification.meta?.sender?.name || notification.senderName || 'Usuário Desconhecido'}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>Email:</strong>
                                            <span className="text-gray-700 dark:text-gray-300">{notification.meta?.sender?.email || notification.senderUserId || notification.senderId || 'N/A'}</span>
                                        </div>
                                        <div className="text-sm">
                                            <strong>Data & Hora:</strong>
                                            <span className="text-gray-700 dark:text-gray-300">{formatDate(notification.createdAt)}</span>
                                        </div>
                                        {notification.companyId && (
                                            <div className="text-sm">
                                                <strong>ID da Empresa:</strong>
                                                <span className="text-gray-700 dark:text-gray-300">{notification.companyId}</span>
                                            </div>
                                        )}
                                        {notification.meta?.channel && (
                                            <div className="text-sm">
                                                <strong>Canal:</strong>
                                                <span className="text-gray-700 dark:text-gray-300">{translateChannel(notification.meta.channel)}</span>
                                            </div>
                                        )}
                                    </div>
                                    {notification.meta?.company && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800">
                                            <strong className="text-sm">Empresa:</strong>
                                            <div className="ml-2 mt-1 space-y-1 text-sm">
                                                <div><strong>Nome:</strong> {notification.meta.company.name}</div>
                                                {notification.meta.company.description && (
                                                    <div><strong>Descrição:</strong> {notification.meta.company.description}</div>
                                                )}
                                                {notification.meta.company.memberCount !== undefined && (
                                                    <div><strong>Membros:</strong> {notification.meta.company.memberCount}</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {notification.meta?.role && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 text-sm">
                                            <div><strong>Cargo:</strong> {translateRole(notification.meta.role)}</div>
                                            {notification.meta.previousRole && (
                                                <div><strong>Cargo Anterior:</strong> {translateRole(notification.meta.previousRole)}</div>
                                            )}
                                        </div>
                                    )}
                                    {(notification.meta?.inviteId || notification.meta?.inviteEmail || notification.meta?.inviteUrl) && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 text-sm">
                                            {notification.meta.inviteId && (
                                                <div><strong>ID do Convite:</strong> {notification.meta.inviteId}</div>
                                            )}
                                            {notification.meta.inviteEmail && (
                                                <div><strong>Email do Convite:</strong> {notification.meta.inviteEmail}</div>
                                            )}
                                            {notification.meta.inviteUrl && (
                                                <div><strong>Link do Convite:</strong> <a href={notification.meta.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline break-all">{notification.meta.inviteUrl}</a></div>
                                            )}
                                        </div>
                                    )}
                                    {notification.meta?.rejectedByName && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 text-sm">
                                            <div><strong>Rejeitado por:</strong> {notification.meta.rejectedByName} {notification.meta.rejectedByEmail && `(${notification.meta.rejectedByEmail})`}</div>
                                        </div>
                                    )}
                                    {notification.meta?.removedBy && (
                                        <div className="pt-3 border-t border-gray-200 dark:border-gray-800 text-sm">
                                            <div><strong>Removido por:</strong> {notification.meta.removedBy.name} ({notification.meta.removedBy.email})</div>
                                        </div>
                                    )}
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                                        <strong className="text-sm">Mensagem Original:</strong>
                                        <div className="text-sm text-gray-700 dark:text-gray-300 mt-1 p-2 bg-white dark:bg-gray-950 rounded">
                                            {parseNotificationBody(notification.body, notification.title, notification.meta)}
                                        </div>
                                    </div>
                                </div>
                            ) : null;
                        })()}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sua Resposta</label>
                            <textarea
                                placeholder="Digite sua resposta..."
                                value={replyBody}
                                onChange={(e) => setReplyBody(e.target.value)}
                                className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded resize-none bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
                                rows={4}
                                required
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Sua resposta será enviada para: {(() => {
                                const notification = notifications.find(n => n.id === replyingTo);
                                return notification ? (
                                    <span className="font-medium">
                                        {notification.meta?.sender?.name || notification.senderName || 'Desconhecido'} ({notification.meta?.sender?.email || notification.senderUserId || notification.senderId || 'N/A'})
                                    </span>
                                ) : 'o remetente original';
                            })()}
                            </p>
                        </div>
                        <div className="flex gap-3 justify-end mt-4">
                            <button
                                onClick={() => {
                                    setReplyingTo(null);
                                    setReplyBody('');
                                }}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReply}
                                disabled={replyMutation.isPending}
                                className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                            >
                                {replyMutation.isPending ? 'Enviando...' : 'Enviar Resposta'}
                            </button>
                        </div>
                    </div>
                    {replyMutation.isSuccess && (
                        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm text-center max-w-md w-full">
                            Resposta enviada com sucesso!
                        </div>
                    )}
                    {replyMutation.isError && (
                        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm text-center max-w-md w-full">
                            {getErrorMessage(replyMutation.error)}
                        </div>
                    )}
                </div>
            )}

            <ConfirmModal
                open={!!deleteConfirm}
                title="Excluir Notificação"
                onConfirm={() => {
                    if (deleteConfirm) {
                        deleteMutation.mutate(deleteConfirm, {
                            onSuccess: () => {
                                setDeleteConfirm(null);
                                show({message: 'Notificação excluída', type: 'success'});
                            },
                            onError: (error) => {
                                show({message: getErrorMessage(error), type: 'error'});
                            },
                        });
                    }
                }}
                onCancel={() => setDeleteConfirm(null)}
            >
                Tem certeza que deseja excluir esta notificação? Esta ação não pode ser desfeita.
            </ConfirmModal>
            <ConfirmModal 
                open={showDeleteModal} 
                title="Deletar notificações?" 
                onCancel={()=>{setShowDeleteModal(false); setDeleteIds([]);}} 
                onConfirm={()=>handleDelete(deleteIds)}
            >
                Tem certeza que deseja deletar {deleteIds.length} notificação? Esta ação não pode ser desfeita.
            </ConfirmModal>
        </div>
    );
}

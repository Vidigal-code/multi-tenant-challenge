"use client";
import React, { useEffect, useState } from 'react';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../components/skeleton/Skeleton';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';
import { DEFAULT_COMPANY_LOGO } from '../../types';
import {
    useInvitesCreated,
    useInvitesReceived,
    useAcceptInvite,
    useRejectInvite,
    useDeleteInvite,
    useDeleteInvites,
    type Invite,
} from '../../services/api/invite.api';
import { useProfile } from '../../services/api/auth.api';


function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
}

const STATUS_LABELS: Record<string, string> = {
    PENDING: 'Pendente',
    ACCEPTED: 'Aceito',
    REJECTED: 'Rejeitado',
    EXPIRED: 'Expirado',
    CANCELED: 'Cancelado',
};

function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        return date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
    } catch {
        return 'Data inválida';
    }
}

function InvitesPageInner() {
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'created' | 'received'>('created');
    const [selected, setSelected] = useState<string[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [deleteIds, setDeleteIds] = useState<string[]>([]);
    const [rejectModal, setRejectModal] = useState(false);
    const [rejectIds, setRejectIds] = useState<string[]>([]);
    const [expandedInvites, setExpandedInvites] = useState<Record<string, boolean>>({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const {show} = useToast();
    const qc = useQueryClient();

    const profileQuery = useProfile();

    useEffect(() => {
        if (profileQuery.data) {
            setCurrentUserId(profileQuery.data.id);
            setCurrentUserEmail(profileQuery.data.email?.toLowerCase());
        }
    }, [profileQuery.data]);

    const createdQuery = useInvitesCreated(page, pageSize, tab === 'created');
    const receivedQuery = useInvitesReceived(page, pageSize, tab === 'received');

    useEffect(() => {
        if (createdQuery.isError || receivedQuery.isError) {
            const err = createdQuery.error || receivedQuery.error;
            const m = getErrorMessage((err as any), 'Falha ao carregar convites');
            show({ type: 'error', message: m });
        }
    }, [createdQuery.isError, receivedQuery.isError, createdQuery.error, receivedQuery.error, show]);

    const acceptMutation = useAcceptInvite();
    const rejectMutation = useRejectInvite();
    const deleteInviteMutation = useDeleteInvite();
    const deleteInvitesMutation = useDeleteInvites();

    function accept(token: string) { 
        setError(null); 
        setMessage(null); 
        acceptMutation.mutate(token, {
            onSuccess: () => {
                setMessage('Convite aceito');
                show({ type:'success', message:'Convite aceito com sucesso' });
            },
            onError: (err: any) => { 
                const m = getErrorMessage(err,'Não foi possível aceitar o convite'); 
                setError(m); 
                show({ type:'error', message:m }); 
            },
        });
    }

    function reject(token: string){ 
        setError(null); 
        setMessage(null); 
        rejectMutation.mutate(token, {
            onSuccess: () => {
                show({type:'info', message:'Convite rejeitado'});
            },
            onError: (err:any) => { 
                const m = getErrorMessage(err,'Não foi possível rejeitar o convite'); 
                setError(m);
                show({type:'error', message:m}); 
            },
        });
    }

    async function handleRejectAll() {
        setRejectModal(false);
        const tokens = rejectIds.map(id => {
            const invite = tab === 'received' 
                ? receivedQuery.data?.data.find(i => i.id === id)
                : null;
            return invite?.token;
        }).filter(Boolean) as string[];

        try {
            for (const token of tokens) {
                await rejectMutation.mutateAsync(token);
            }
            setRejectIds([]);
            setSelected([]);
            setMessage('Convites rejeitados');
        } catch (err: any) {
            const m = getErrorMessage(err, 'Não foi possível rejeitar os convites');
            setError(m); 
            show({ type: 'error', message: m }); 
        }
    }

    function handleDelete(ids: string[]) {
        setShowModal(false);
        if (ids.length === 1) {
            deleteInviteMutation.mutate(ids[0], {
                onSuccess: () => {
                    setSelected([]);
                    setDeleteIds([]);
                    setMessage('Convite deletado');
                },
                onError: (err: any) => {
                    const m = getErrorMessage(err, 'Não foi possível deletar o convite');
                    setError(m); 
                    show({ type: 'error', message: m }); 
                },
            });
        } else {
            deleteInvitesMutation.mutate(ids, {
                onSuccess: () => {
                    setSelected([]);
                    setDeleteIds([]);
                    setMessage('Convites deletados');
                },
                onError: (err: any) => {
                    const m = getErrorMessage(err, 'Não foi possível deletar os convites');
                    setError(m); 
                    show({ type: 'error', message: m }); 
                },
            });
        }
    }

    function handleSelectAll(items: any[]) {
        setSelected(items.map(i => i.id));
    }

    useEffect(() => {
        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;
            unsubscribers.push(
                subscribe(RT_EVENTS.INVITE_REJECTED, () => {
                    qc.invalidateQueries({ queryKey: ['invites-created', page, pageSize] });
                    qc.invalidateQueries({ queryKey: queryKeys.invites(page, pageSize) });
                }),
                subscribe(RT_EVENTS.INVITE_ACCEPTED, () => {
                    qc.invalidateQueries({ queryKey: ['invites-created', page, pageSize] });
                    qc.invalidateQueries({ queryKey: queryKeys.invites(page, pageSize) });
                }),
            );
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [page, pageSize, qc]);

    useEffect(() => {
        setSelected([]);
    }, [tab]);

    function renderList() {
        let items: any[] = [];
        let isLoading = false;

        if (tab === 'created') {
            items = createdQuery.data?.data ?? [];
            isLoading = createdQuery.isLoading;
        } else if (tab === 'received') {
            items = receivedQuery.data?.data ?? [];
            isLoading = receivedQuery.isLoading;
        }

        if (isLoading) {
            return (
                <div className="space-y-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            );
        }

        if (!items.length) {
            let emptyMessage = 'Nenhum convite encontrado.';
            if (tab === 'created') emptyMessage = 'Nenhum convite criado.';
            if (tab === 'received') emptyMessage = 'Nenhum convite recebido.';
            return <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base py-12 sm:py-16 text-center border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">{emptyMessage}</div>;
        }

        const defaultLogo = DEFAULT_COMPANY_LOGO;

        return (
            <>
                <div className="flex flex-wrap gap-2 mb-4">
                    {tab === 'received' && (
                        <>
                            <button className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap" onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
                                disabled={!selected.length} 
                                onClick={() => { 
                                    setRejectIds(selected); 
                                    setRejectModal(true); 
                                }}
                            >
                                Rejeitar selecionados
                            </button>
                            <button 
                                className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
                                disabled={!items.length} 
                                onClick={() => { 
                                    setRejectIds(items.map(i => i.id)); 
                                    setRejectModal(true); 
                                }}
                            >
                                Rejeitar todos
                            </button>
                        </>
                    )}
                    {tab === 'created' && (
                        <>
                            <button className="px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap" onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap" 
                                disabled={!selected.length} 
                                onClick={() => { 
                                    setDeleteIds(selected); 
                                    setShowModal(true); 
                                }}
                            >
                                Deletar selecionados
                            </button>
                            <button 
                                className="px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap" 
                                disabled={!items.length} 
                                onClick={() => { 
                                    setDeleteIds(items.map(i => i.id)); 
                                    setShowModal(true); 
                                }}
                            >
                                Limpar todos
                            </button>
                        </>
                    )}
                </div>
                <ul className="space-y-0 divide-y divide-gray-200 dark:divide-gray-800">
                    {items.map((i: Invite) => {
                        if (!i || !i.id) {
                            return null;
                        }

                        const expanded = expandedInvites[i.id];
                        const description = expanded ? (i.description || '') : truncate(i.description || '', 400);
                        const isRecipient = currentUserEmail && i.email?.toLowerCase() === currentUserEmail;
                        const isInviter = currentUserId && i.inviterId === currentUserId;
                        const canDelete = tab === 'created' && isInviter;

                        return (
                            <li key={i.id} className="py-4 sm:py-5 px-4 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                                <div className="flex items-start gap-3 flex-1 min-w-0 w-full sm:w-auto">
                                    {(tab === 'received' || tab === 'created') && (
                                        <input 
                                            type="checkbox" 
                                            checked={selected.includes(i.id)} 
                                            onChange={e => {
                                                setSelected(sel => e.target.checked ? [...sel, i.id] : sel.filter(sid => sid !== i.id));
                                            }} 
                                            className="mt-1 flex-shrink-0 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                                        />
                                    )}
                                    {i.logoUrl && (
                                        <img 
                                            src={i.logoUrl || defaultLogo} 
                                            alt={i.name || 'Empresa'} 
                                            className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200 dark:border-gray-800" 
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = defaultLogo;
                                            }} 
                                        />
                                    )}
                                    <div className="text-sm sm:text-base flex-1 min-w-0">
                                        <div className="font-semibold text-base sm:text-lg mb-2 text-gray-900 dark:text-white">{i.name || 'Empresa Desconhecida'}</div>
                                        <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">ID da Empresa:</span> <span className="font-mono text-xs sm:text-sm">{i.companyId || 'N/A'}</span>
                                            </div>
                                            {tab === 'created' && (
                                                <>
                                                    <div>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">Para:</span> {i.recipientName || 'N/A'} ({i.recipientEmail || i.email})
                                                    </div>
                                                    {i.inviteUrl && (
                                                        <div className="break-all">
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">Link do Convite:</span>{' '}
                                                            <a href={i.inviteUrl} target="_blank" rel="noopener noreferrer"
                                                               className="text-gray-900 dark:text-white underline hover:no-underline break-all">
                                                                {i.inviteUrl}
                                                            </a>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {tab === 'received' && (
                                                <div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">De:</span> {i.inviterName || 'N/A'} ({i.inviterEmail || 'N/A'})
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">Cargo:</span> {i.role || 'N/A'} • <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span> <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                    i.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' :
                                                    i.status === 'ACCEPTED' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                                                    i.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300' :
                                                    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                                                }`}>{STATUS_LABELS[i.status] || i.status || 'N/A'}</span>
                                            </div>
                                            <div className="text-xs sm:text-sm">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">Enviado:</span> {formatDate(i.createdAt)} • <span className="font-medium text-gray-700 dark:text-gray-300">Expira:</span> {formatDate(i.expiresAt)}
                                            </div>
                                            {i.description && (
                                                <div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">Descrição:</span> {description}
                                                    {i.description.length > 400 && (
                                                        <button
                                                            className="text-gray-900 dark:text-white underline ml-1 hover:no-underline text-sm"
                                                            onClick={() =>
                                                                setExpandedInvites(prev => ({
                                                                    ...prev,
                                                                    [i.id]: !prev[i.id],
                                                                }))
                                                            }
                                                        >
                                                            {expanded ? 'Mostrar menos' : 'Ler mais'}
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                                    {canDelete && (
                                        <button 
                                            className="px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm font-medium whitespace-nowrap" 
                                            onClick={() => { 
                                                setDeleteIds([i.id]); 
                                                setShowModal(true); 
                                            }}
                                        >
                                            Deletar
                                        </button>
                                    )}
                                    {tab === 'received' && i.status === 'PENDING' && i.token && (
                                        <>
                                            <button 
                                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap" 
                                                onClick={() => accept(i.token)}
                                            >
                                                Aceitar
                                            </button>
                                            <button 
                                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap" 
                                                onClick={() => reject(i.token)}
                                            >
                                                Rejeitar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    }).filter(Boolean)}
                </ul>
            </>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Convites</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie seus convites enviados e recebidos</p>
            </div>
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
                <button 
                    className={`px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg font-medium text-sm sm:text-base transition-colors whitespace-nowrap ${
                        tab==='created'
                            ?'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            :'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`} 
                    onClick={()=>setTab('created')}
                >
                    Convites Criados
                </button>
                <button 
                    className={`px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg font-medium text-sm sm:text-base transition-colors whitespace-nowrap ${
                        tab==='received'
                            ?'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                            :'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`} 
                    onClick={()=>setTab('received')}
                >
                    Convites Recebidos
                </button>
            </div>
            {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">{message}</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
            {renderList()}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button 
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                    >
                        Anterior
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Página {page}</span>
                    <button 
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                        onClick={() => setPage(p => p + 1)} 
                        disabled={false}
                    >
                        Próxima
                    </button>
                </div>
            </div>
            <ConfirmModal 
                open={showModal} 
                title="Deletar convites?" 
                onCancel={()=>{setShowModal(false); setDeleteIds([]);}} 
                onConfirm={()=>handleDelete(deleteIds)}
            >
                Tem certeza que deseja deletar {deleteIds.length} convite(s)? Esta ação não pode ser desfeita.
            </ConfirmModal>
            <ConfirmModal 
                open={rejectModal} 
                title="Rejeitar convites?" 
                onCancel={()=>{setRejectModal(false); setRejectIds([]);}} 
                onConfirm={()=>handleRejectAll()}
            >
                Tem certeza que deseja rejeitar {rejectIds.length} convite(s)? Esta ação não pode ser desfeita.
            </ConfirmModal>
        </div>
    );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function InvitesPage() {
    if (process.env.NODE_ENV === 'test') {
        const client = new QueryClient();
        return (
            <QueryClientProvider client={client}>
                <InvitesPageInner />
            </QueryClientProvider>
        );
    }
    return <InvitesPageInner />;
}

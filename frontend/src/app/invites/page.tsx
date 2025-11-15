"use client";
import React, { useEffect, useState } from 'react';
import {http} from '../../lib/http';
import {getErrorMessage} from '../../lib/error';
import {getSuccessMessage, getErrorMessage as getErrorMessageByCode} from '../../lib/messages';
import {useToast} from '../../hooks/useToast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../components/Skeleton';
import { queryKeys } from '../../lib/queryKeys';
import { ConfirmModal } from '../../components/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';

type Invite = {
    id: string;
    companyId: string;
    email: string;
    role: string;
    status: string;
    token: string;
    inviterId?: string | null;
    inviterName?: string | null;
    inviterEmail?: string | null;
    recipientName?: string | null;
    recipientEmail?: string | null;
    inviteUrl?: string;
    createdAt: string;
    expiresAt: string | null;
    name?: string;
    description?: string;
    logoUrl?: string | null;
};

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

    // Get current user ID and email - usando React Query para evitar múltiplas requisições
    const profileQuery = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data } = await http.get('/auth/profile');
            return data;
        },
        staleTime: 60_000, // Cache por 1 minuto
    });

    useEffect(() => {
        if (profileQuery.data) {
            setCurrentUserId(profileQuery.data.id);
            setCurrentUserEmail(profileQuery.data.email?.toLowerCase());
        }
    }, [profileQuery.data]);

    const createdQuery = useQuery<{ data: Invite[]; total: number }>({
        queryKey: ['invites-created', page, pageSize],
        queryFn: async () => {
            const { data } = await http.get('/invites/created', { params: { page, pageSize } });
            return { data: data.data as Invite[], total: data.total as number };
        },
        enabled: tab === 'created',
        staleTime: 30_000,
    });

    const receivedQuery = useQuery<{ data: Invite[]; total: number }>({
        queryKey: queryKeys.invites(page, pageSize),
        queryFn: async () => {
            const { data } = await http.get('/invites', { params: { page, pageSize } });
            // Filtrar apenas convites PENDING na aba received
            const pendingInvites = (data.data as Invite[]).filter(inv => inv.status === 'PENDING');
            return { data: pendingInvites, total: pendingInvites.length };
        },
        enabled: tab === 'received',
        staleTime: 30_000,
    });

    if (createdQuery.isError || receivedQuery.isError) {
        const err = createdQuery.error || receivedQuery.error;
        const m = getErrorMessage((err as any), 'Falha ao carregar dados');
        if (!error) { setError(m); show({ type: 'error', message: m }); }
    }

    const acceptMutation = useMutation({
        mutationFn: async (token: string) => { await http.post('/auth/accept-invite', { token }); },
        onSuccess: async () => {
            setMessage('Convite aceito');
            show({ type:'success', message:'Convite aceito com sucesso' });
            await qc.invalidateQueries({ queryKey: queryKeys.invites(page, pageSize) });
            await qc.invalidateQueries({ queryKey: ['invites-created', page, pageSize] });
        },
        onError: (err: any) => { 
            const m = getErrorMessage(err,'Não foi possível aceitar o convite'); 
            setError(m); 
            show({ type:'error', message:m }); 
        },
    });

    function accept(token: string) { 
        setError(null); 
        setMessage(null); 
        acceptMutation.mutate(token); 
    }

    const rejectMutation = useMutation({
        mutationFn: async (token: string) => { await http.post(`/invites/${token}/reject`); },
        onSuccess: async () => { 
            await qc.invalidateQueries({ queryKey: queryKeys.invites(page, pageSize) }); 
            await qc.invalidateQueries({ queryKey: ['invites-created', page, pageSize] });
            show({type:'info', message:'Convite rejeitado'});
        },
        onError: (err:any) => { 
            const m = getErrorMessage(err,'Não foi possível rejeitar o convite'); 
            setError(m);
            show({type:'error', message:m}); 
        }
    });

    function reject(token: string){ 
        setError(null); 
        setMessage(null); 
        rejectMutation.mutate(token); 
    }

    async function handleRejectAll() {
        setRejectModal(false);
        try {
            const tokens = rejectIds.map(id => {
                const invite = tab === 'received' 
                    ? receivedQuery.data?.data.find(i => i.id === id)
                    : null;
                return invite?.token;
            }).filter(Boolean) as string[];

            for (const token of tokens) {
                await http.post(`/invites/${token}/reject`);
            }
            setRejectIds([]);
            setSelected([]);
            setMessage('Convites rejeitados');
            await qc.invalidateQueries();
        } catch (err: any) {
            const m = getErrorMessage(err, 'Não foi possível rejeitar os convites');
            setError(m); 
            show({ type: 'error', message: m }); 
        }
    }

    async function handleDelete(ids: string[]) {
        setShowModal(false);
        try {
            if (ids.length === 1) {
                await http.delete(`/invites/${ids[0]}`);
            } else {
                await http.delete('/invites', { data: { inviteIds: ids } });
            }
            setSelected([]);
            setDeleteIds([]);
            setMessage('Convite(s) deletado(s)');
            await qc.invalidateQueries();
        } catch (err: any) {
            const m = getErrorMessage(err, 'Não foi possível deletar o convite');
            setError(m); 
            show({ type: 'error', message: m }); 
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
            return <div className="text-gray-500 text-sm py-8 text-center">{emptyMessage}</div>;
        }

        const defaultLogo = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO ||  'https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png';

        return (
            <>
                <div className="flex gap-2 mb-2">
                    {tab === 'received' && (
                        <>
                            <button className="px-2 py-1 border rounded" onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="px-2 py-1 border rounded bg-gray-600 text-white disabled:opacity-50"
                                disabled={!selected.length} 
                                onClick={() => { 
                                    setRejectIds(selected); 
                                    setRejectModal(true); 
                                }}
                            >
                                Rejeitar selecionados
                            </button>
                            <button 
                                className="px-2 py-1 border rounded bg-gray-600 text-white disabled:opacity-50"
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
                            <button className="px-2 py-1 border rounded" onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="px-2 py-1 border rounded bg-red-600 text-white disabled:opacity-50"
                                disabled={!selected.length} 
                                onClick={() => { 
                                    setDeleteIds(selected); 
                                    setShowModal(true); 
                                }}
                            >
                                Deletar selecionados
                            </button>
                            <button 
                                className="px-2 py-1 border rounded bg-red-600 text-white disabled:opacity-50"
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
                <ul className="divide-y">
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
                            <li key={i.id} className="py-3 flex items-start justify-between gap-3 border-b">
                                <div className="flex items-start gap-3 flex-1">
                                    {tab === 'received' && (
                                        <input 
                                            type="checkbox" 
                                            checked={selected.includes(i.id)} 
                                            onChange={e => {
                                                setSelected(sel => e.target.checked ? [...sel, i.id] : sel.filter(sid => sid !== i.id));
                                            }} 
                                            className="mt-1"
                                        />
                                    )}
                                    {tab === 'created' && (
                                        <input 
                                            type="checkbox" 
                                            checked={selected.includes(i.id)} 
                                            onChange={e => {
                                                setSelected(sel => e.target.checked ? [...sel, i.id] : sel.filter(sid => sid !== i.id));
                                            }} 
                                            className="mt-1"
                                        />
                                    )}
                                    {i.logoUrl && (
                                        <img 
                                            src={i.logoUrl || defaultLogo} 
                                            alt={i.name || 'Empresa'} 
                                            className="w-12 h-12 rounded object-cover" 
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = defaultLogo;
                                            }} 
                                        />
                                    )}
                                    <div className="text-sm flex-1">
                                        <div className="font-semibold text-base mb-1">{i.name || 'Empresa Desconhecida'}</div>
                                        <div className="text-gray-600 mb-1">
                                            <span className="font-medium">ID da Empresa:</span> {i.companyId || 'N/A'}
                                        </div>
                                        {tab === 'created' && (
                                            <>
                                                <div className="text-gray-600 mb-1">
                                                    <span className="font-medium">Para:</span> {i.recipientName || 'N/A'} ({i.recipientEmail || i.email})
                                                </div>
                                                {i.inviteUrl && (
                                                    <div className="text-gray-600 mb-1">
                                                        <span className="font-medium">Link do Convite:</span>{' '}
                                                        <a href={i.inviteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                                                            {i.inviteUrl}
                                                        </a>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {tab === 'received' && (
                                            <div className="text-gray-600 mb-1">
                                                <span className="font-medium">De:</span> {i.inviterName || 'N/A'} ({i.inviterEmail || 'N/A'})
                                            </div>
                                        )}
                                        <div className="text-gray-600 mb-1">
                                            <span className="font-medium">Cargo:</span> {i.role || 'N/A'} • <span className="font-medium">Status:</span> {STATUS_LABELS[i.status] || i.status || 'N/A'}
                                        </div>
                                        <div className="text-gray-600 mb-1">
                                            <span className="font-medium">Enviado:</span> {formatDate(i.createdAt)} • <span className="font-medium">Expira:</span> {formatDate(i.expiresAt)}
                                        </div>
                                        <div className="text-gray-600 mb-1">
                                            <span className="font-medium">ID do Convite:</span> {i.id}
                                        </div>
                                        {i.description && (
                                            <div className="text-gray-600 mb-1">
                                                <span className="font-medium">Descrição:</span> {description}
                                                {i.description.length > 400 && (
                                                    <button
                                                        className="text-blue-600 underline ml-1"
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
                                <div className="flex gap-2 flex-shrink-0">
                                    {canDelete && (
                                        <button 
                                            className="px-3 py-1 border rounded bg-red-600 text-white text-sm" 
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
                                                className="px-3 py-1 border rounded bg-blue-600 text-white text-sm" 
                                                onClick={() => accept(i.token)}
                                            >
                                                Aceitar
                                            </button>
                                            <button 
                                                className="px-3 py-1 border rounded bg-gray-600 text-white text-sm" 
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
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Convites</h1>
            <div className="flex gap-2 mb-4">
                <button 
                    className={`px-3 py-1 border rounded ${tab==='created'?'bg-blue-600 text-white':''}`} 
                    onClick={()=>setTab('created')}
                >
                    Convites Criados
                </button>
                <button 
                    className={`px-3 py-1 border rounded ${tab==='received'?'bg-blue-600 text-white':''}`} 
                    onClick={()=>setTab('received')}
                >
                    Convites Recebidos
                </button>
            </div>
            {message && <p className="text-green-700">{message}</p>}
            {error && <p className="text-red-600">{error}</p>}
            {renderList()}
            <div className="flex items-center gap-2 mt-4">
                <button 
                    className="px-2 py-1 border rounded disabled:opacity-50" 
                    onClick={() => setPage(p => Math.max(1, p - 1))} 
                    disabled={page === 1}
                >
                    Anterior
                </button>
                <span className="text-sm">Página {page}</span>
                <button 
                    className="px-2 py-1 border rounded disabled:opacity-50" 
                    onClick={() => setPage(p => p + 1)} 
                    disabled={false}
                >
                    Próxima
                </button>
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

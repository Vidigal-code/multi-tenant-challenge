"use client";
import React, { useEffect, useState } from 'react';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
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
    type Invite,
    createInviteBulkJob,
    fetchInviteBulkJob,
    deleteInviteBulkJob,
} from "../../services/api";
import { useProfile } from "../../services/api";


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

function normalizeInviteUrl(rawUrl: string | undefined | null): string {
    if (!rawUrl) return '';
    try {
        const url = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
        if (typeof window !== 'undefined' && window.location?.origin) {
            return `${window.location.origin}${url.pathname}${url.search}${url.hash}`;
        }
        return url.toString();
    } catch {
        if (typeof window !== 'undefined' && rawUrl.startsWith('/')) {
            return `${window.location.origin}${rawUrl}`;
        }
        return rawUrl;
    }
}

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
    const [deleteScope, setDeleteScope] = useState<'single' | 'selected' | 'all'>('single');
    const [rejectScope, setRejectScope] = useState<'selected' | 'all'>('selected');
    const [expandedInvites, setExpandedInvites] = useState<Record<string, boolean>>({});
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
    const [bulkJobRunning, setBulkJobRunning] = useState(false);
    const {show} = useToast();

    const profileQuery = useProfile();

    useEffect(() => {
        setPage(1);
    }, [tab]);

    useEffect(() => {
        if (profileQuery.data) {
            setCurrentUserId(profileQuery.data.id);
            setCurrentUserEmail(profileQuery.data.email?.toLowerCase());
        }
    }, [profileQuery.data]);

    async function monitorBulkJob(jobId: string) {

        const sleep = (ms: number) => new Promise(resolve =>
            setTimeout(resolve, ms));

        while (true) {
            const status = await fetchInviteBulkJob(jobId);
            setMessage(`Processando lote (${status.processed} convites)...`);
            if (status.status === 'completed') {
                await deleteInviteBulkJob(jobId);
                return status;
            }
            if (status.status === 'failed') {
                await deleteInviteBulkJob(jobId);
                throw new Error(status.error || 'Falha na operação em lote');
            }
            await sleep(1500);
        }
    }

    async function runBulkJob(action: 'delete' | 'reject', scope: 'selected' | 'all', ids?: string[]) {
        try {
            setBulkJobRunning(true);

            const job = await createInviteBulkJob({
                action,
                scope,
                inviteIds: scope === 'selected' ? ids : undefined,
            });

            const finalStatus = await monitorBulkJob(job.jobId);

            const successMessage = action === 'delete'
                ? `Convites deletados (${finalStatus.succeeded})`
                : `Convites rejeitados (${finalStatus.succeeded})`;

            setMessage(successMessage);
            show({type: 'success', message: successMessage});

            if (action === 'delete') {
                createdQuery.restartJob();
            } else {
                receivedQuery.restartJob();
            }

            setPage(1);
        } catch (err: any) {
            const m = getErrorMessage(err, 'Falha ao processar operação em lote');
            setError(m);
            show({type: 'error', message: m});
        } finally {
            setBulkJobRunning(false);
            setDeleteIds([]);
            setRejectIds([]);
            setSelected([]);
            setDeleteScope('single');
            setRejectScope('selected');
            setShowModal(false);
            setRejectModal(false);
        }
    }

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

    function accept(token: string) { 
        setError(null); 
        setMessage(null); 
        acceptMutation.mutate(token, {
            onSuccess: () => {
                setMessage('Convite aceito');
                show({ type:'success', message:'Convite aceito com sucesso' });
                createdQuery.restartJob();
                receivedQuery.restartJob();
                setPage(1);
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
                createdQuery.restartJob();
                receivedQuery.restartJob();
                setPage(1);
            },
            onError: (err:any) => { 
                const m = getErrorMessage(err,'Não foi possível rejeitar o convite'); 
                setError(m);
                show({type:'error', message:m}); 
            },
        });
    }

    async function handleRejectBulk() {
        setRejectModal(false);
        if (rejectScope === 'selected' && rejectIds.length === 0) return;
        await runBulkJob('reject', rejectScope, rejectScope === 'selected' ? rejectIds : undefined);
    }

    function handleDeleteSingle(inviteId: string) {
        deleteInviteMutation.mutate(inviteId, {
            onSuccess: () => {
                setSelected([]);
                setDeleteIds([]);
                setMessage('Convite deletado');
                createdQuery.restartJob();
                setPage(1);
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Não foi possível deletar o convite');
                setError(m);
                show({ type: 'error', message: m });
            },
        });
    }

    async function handleDeleteConfirm() {
        setShowModal(false);
        if (deleteScope === 'single' && deleteIds.length === 1) {
            handleDeleteSingle(deleteIds[0]);
            return;
        }
        if (deleteIds.length === 0) return;
        const ids = deleteIds.slice();
        await runBulkJob('delete', 'selected', ids);
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
                    createdQuery.restartJob();
                    receivedQuery.restartJob();
                }),
                subscribe(RT_EVENTS.INVITE_ACCEPTED, () => {
                    createdQuery.restartJob();
                    receivedQuery.restartJob();
                }),
            );
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [createdQuery, createdQuery.restartJob, receivedQuery, receivedQuery.restartJob]);

    function renderList() {
        const currentQuery = tab === 'created' ? createdQuery : receivedQuery;
        const jobStatus = currentQuery.data?.status ?? (currentQuery.isLoading ? 'processing' : 'pending');
        const jobError = currentQuery.data?.error;
        const isProcessing = jobStatus !== 'completed' || (currentQuery.isLoading && !currentQuery.data);
        let items: Invite[] = currentQuery.data?.data ?? [];
        if (tab === 'received') {
            items = items.filter(invite => invite.status === 'PENDING');
        }

        if (currentQuery.isLoading) {
            return (
                <div className="space-y-2">
                    <Skeleton className="h-14" />
                    <Skeleton className="h-14" />
                </div>
            );
        }

        if (jobError) {
            return (
                <div className="flex flex-col items-center gap-4 border border-red-200
                dark:border-red-800 rounded-lg p-6 text-center bg-red-50 dark:bg-red-900/20">
                    <p className="text-red-700 dark:text-red-300 text-sm sm:text-base">
                        {jobError || 'Falha ao processar convites em lote.'}
                    </p>
                    <button
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium
                        hover:bg-red-500 transition-colors"
                        onClick={() => {
                            currentQuery.restartJob();
                            setPage(1);
                        }}
                    >
                        Tentar novamente
                    </button>
                </div>
            );
        }

        if (!items.length) {
            if (isProcessing) {
                return (
                    <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base py-12 sm:py-16 text-center
                    border border-dashed border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                        Processando milhares de convites... aguarde enquanto carregamos este lote.
                    </div>
                );
            }
            let emptyMessage = 'Nenhum convite encontrado.';
            if (tab === 'created') emptyMessage = 'Nenhum convite criado.';
            if (tab === 'received') emptyMessage = 'Nenhum convite recebido.';
            return <div className="text-gray-600 dark:text-gray-400 text-sm sm:text-base py-12 sm:py-16 text-center border
            border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">{emptyMessage}</div>;
        }

        const defaultLogo = DEFAULT_COMPANY_LOGO;

        return (
            <>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4 justify-center">
                    <button
                        className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                        bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                        dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap"
                        onClick={() => {
                            currentQuery.restartJob();
                            setPage(1);
                            setSelected([]);
                            setDeleteIds([]);
                            setRejectIds([]);
                        }}
                    >
                        Atualizar convites
                    </button>
                    {tab === 'received' && (
                        <>
                            <button className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                            bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                            dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap
                             disabled:opacity-50 disabled:cursor-not-allowed" disabled={bulkJobRunning} onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800
                                rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                                dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium
                                 whitespace-nowrap"
                                disabled={!selected.length || bulkJobRunning} 
                                onClick={() => { 
                                    setRejectScope('selected');
                                    setRejectIds(selected); 
                                    setRejectModal(true); 
                                }}
                            >
                                Rejeitar selecionados
                            </button>
                            <button 
                                className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                                bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                                dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                                 text-sm font-medium whitespace-nowrap"
                                disabled={!items.length || bulkJobRunning} 
                                onClick={() => { 
                                    setRejectScope('all');
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
                            <button className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                            bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                            dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap disabled:opacity-50
                             disabled:cursor-not-allowed" disabled={bulkJobRunning} onClick={() => handleSelectAll(items)}>
                                Selecionar todos
                            </button>
                            <button 
                                className="w-full sm:w-auto px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg
                                bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm
                                font-medium whitespace-nowrap"
                                disabled={!selected.length || bulkJobRunning} 
                                onClick={() => { 
                                    setDeleteScope('selected');
                                    setDeleteIds(selected); 
                                    setShowModal(true); 
                                }}
                            >
                                Deletar selecionados
                            </button>
                            <button 
                                className="w-full sm:w-auto px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white
                                dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                                text-sm font-medium whitespace-nowrap"
                                disabled={!items.length || bulkJobRunning} 
                                onClick={() => { 
                                    setDeleteScope('all');
                                    setDeleteIds(items.map(i => i.id)); 
                                    setShowModal(true); 
                                }}
                            >
                                Limpar todos
                            </button>
                        </>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            <div key={i.id} className="flex flex-col h-full rounded-xl border border-gray-200
                            dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-start gap-3 flex-1">
                                    {(tab === 'received' || tab === 'created') && (
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(i.id)}
                                            onChange={e => {
                                                setSelected(sel => e.target.checked ? [...sel, i.id] : sel.filter(sid => sid !== i.id));
                                            }}
                                            className="mt-1 flex-shrink-0 w-4 h-4 rounded border-gray-300 dark:border-gray-700
                                            text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                                        />
                                    )}
                                    <img
                                        src={i.logoUrl || defaultLogo}
                                        alt={i.name || 'Empresa'}
                                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover flex-shrink-0 border
                                        border-gray-200 dark:border-gray-800"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = defaultLogo;
                                        }}
                                    />
                                    <div className="text-sm sm:text-base flex-1 min-w-0">
                                        <div className="font-semibold text-base sm:text-lg mb-2
                                        text-gray-900 dark:text-white">{i.name || 'Empresa Desconhecida'}</div>
                                        <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                            <div>
                                                <span className="font-medium text-gray-700
                                                dark:text-gray-300">ID da Empresa:</span>
                                                <span className="font-mono text-xs"> {i.companyId || 'N/A'}</span>
                                            </div>
                                            {tab === 'created' && (
                                                <>
                                                    <div>
                                                        <span className="font-medium text-gray-700
                                                        dark:text-gray-300">Para:</span> {i.recipientName || 'N/A'} ({i.recipientEmail || i.email})
                                                    </div>
                                                    {i.inviteUrl && (
                                                        <div className="break-all">
                                                            <span className="font-medium text-gray-700 dark:text-gray-300">Link do Convite:</span>{' '}
                                                            <a
                                                                href={normalizeInviteUrl(i.inviteUrl)}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-gray-900 dark:text-white underline hover:no-underline break-all"
                                                            >
                                                                {normalizeInviteUrl(i.inviteUrl)}
                                                            </a>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                            {tab === 'received' && (
                                                <div>
                                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                                        De:</span> {i.inviterName || 'N/A'} ({i.inviterEmail || 'N/A'})
                                                </div>
                                            )}
                                            <div>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">Cargo:</span> {i.role || 'N/A'} •
                                                <span className="font-medium text-gray-700 dark:text-gray-300">Status:</span>
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                                    i.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' :
                                                    i.status === 'ACCEPTED' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                                                    i.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300' :
                                                    'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                                                }`}>{STATUS_LABELS[i.status] || i.status || 'N/A'}</span>
                                            </div>
                                            <div className="text-xs sm:text-sm">
                                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                                    Enviado:</span> {formatDate(i.createdAt)} • <span className="font-medium text-gray-700 dark:text-gray-300">
                                                Expira:</span> {formatDate(i.expiresAt)}
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
                                <div className="flex gap-2 flex-wrap mt-4">
                                    {canDelete && (
                                        <button
                                            className="px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white
                                            dark:bg-gray-950
                                            text-red-600 dark:text-red-400 hover:bg-red-50
                                            dark:hover:bg-red-900/20 transition-colors text-sm
                                            font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={bulkJobRunning}
                                            onClick={() => {
                                                setDeleteScope('single');
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
                                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                                                bg-gray-900 dark:bg-white text-white dark:text-gray-900
                                                hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap"
                                                onClick={() => accept(i.token)}
                                            >
                                                Aceitar
                                            </button>
                                            <button
                                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                                                 bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                                                 dark:hover:bg-gray-900 transition-colors text-sm font-medium whitespace-nowrap"
                                                onClick={() => reject(i.token)}
                                            >
                                                Rejeitar
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    }).filter(Boolean)}
                </div>
            </>
        );
    }

    const currentQueryForPagination = tab === 'created' ? createdQuery : receivedQuery;
    const disableNext = Boolean(currentQueryForPagination.data?.done && currentQueryForPagination.data?.nextCursor === null);

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
            {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg
            text-green-700 dark:text-green-400 text-center">{message}</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200
            dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
            {renderList()}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button 
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
                        dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50
                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        onClick={() => setPage(p => Math.max(1, p - 1))} 
                        disabled={page === 1}
                    >
                        Anterior
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Página {page}</span>
                    <button 
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
                        dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50
                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        onClick={() => setPage(p => p + 1)} 
                        disabled={disableNext || currentQueryForPagination.isFetching}
                    >
                        Próxima
                    </button>
                </div>
            </div>
            <ConfirmModal 
                open={showModal} 
                title="Deletar convites?" 
                onCancel={()=>{setShowModal(false); setDeleteIds([]); setDeleteScope('single');}} 
                onConfirm={()=>handleDeleteConfirm()}
            >
                {deleteScope === 'all'
                    ? 'Tem certeza que deseja deletar todos os convites criados? Este processo em lote removerá permanentemente cada convite pendente.'
                    : `Tem certeza que deseja deletar ${deleteIds.length} convite(s) selecionado(s)? Esta ação não pode ser desfeita.`}
            </ConfirmModal>
            <ConfirmModal 
                open={rejectModal} 
                title="Rejeitar convites?" 
                onCancel={()=>{setRejectModal(false); setRejectIds([]); setRejectScope('selected');}} 
                onConfirm={()=>handleRejectBulk()}
            >
                {rejectScope === 'all'
                    ? 'Tem certeza que deseja rejeitar todos os convites pendentes? Isso será aplicado a todos os convites recebidos.'
                    : `Tem certeza que deseja rejeitar ${rejectIds.length} convite(s) selecionado(s)? Esta ação não pode ser desfeita.`}
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

"use client";

import React, {useState } from 'react';
import {useParams, useRouter} from 'next/navigation';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {http} from '../../../lib/http';
import {getErrorMessage} from '../../../lib/error';
import {useToast} from '../../../hooks/useToast';
import { ConfirmModal } from '../../../components/modals/ConfirmModal';
import { DEFAULT_COMPANY_LOGO } from '../../../types';
import {queryKeys} from '../../../lib/queryKeys';

type InviteInfo = {
    id: string;
    companyId: string;
    companyName?: string;
    companyLogo?: string | null;
    companyDescription?: string | null;
    email: string;
    inviterEmail?: string | null;
    inviterName?: string | null;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    createdAt: string;
    expiresAt: string;
    inviterId?: string;
    isInviter?: boolean;
    isRecipient?: boolean;
    canAccept?: boolean;
    canReject?: boolean;
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

export default function InviteByCodePage() {

    const { token } = useParams() as { token: string };
    const router = useRouter();
    const { show } = useToast();
    const qc = useQueryClient();
    const [showRejectModal, setShowRejectModal] = useState(false);

    const inviteQuery = useQuery<InviteInfo, any>({
        queryKey: ['invite', token],
        queryFn: async () => {
            const { data } = await http.get(`/invites/${token}`);
            return data as InviteInfo;
        },
        retry: 0,
    });

    const acceptMutation = useMutation({
        mutationFn: async () => {
            await http.post(`/invites/${token}/accept`);
        },
        onSuccess: () => {
            show({ type: 'success', message: 'Convite aceito com sucesso' });
            qc.invalidateQueries({ queryKey: ['invite', token] });
            qc.invalidateQueries({ queryKey: ['invites'] });
            qc.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
            qc.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
            setTimeout(() => {
                router.push('/dashboard');
            }, 1000);
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível aceitar o convite');
            show({ type: 'error', message: m });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async () => {
            await http.post(`/invites/${token}/reject`);
        },
        onSuccess: () => {
            show({ type: 'info', message: 'Convite rejeitado' });
            qc.invalidateQueries({ queryKey: ['invite', token] });
            qc.invalidateQueries({ queryKey: ['invites'] });
            qc.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
            qc.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
            setTimeout(() => {
                router.push('/dashboard');
            }, 1000);
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível rejeitar o convite');
            show({ type: 'error', message: m });
        },
    });

    const defaultLogo = DEFAULT_COMPANY_LOGO;
    const [logoError, setLogoError] = React.useState(false);

    if (inviteQuery.isLoading) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Carregando convite...</h1>
                </div>
            </div>
        );
    }

    if (inviteQuery.isError) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
                <div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{getErrorMessage(inviteQuery.error, 'Convite inválido ou expirado')}</div>
                </div>
            </div>
        );
    }

    const invite = inviteQuery.data;
    if (!invite) return null;

    const STATUS_LABELS: Record<string, string> = {
        PENDING: 'Pendente',
        ACCEPTED: 'Aceito',
        REJECTED: 'Rejeitado',
        EXPIRED: 'Expirado',
        CANCELED: 'Cancelado',
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Detalhes do Convite</h1>
                <p className="text-gray-600 dark:text-gray-400">Visualize e gerencie seu convite</p>
            </div>
            <div className="space-y-6 border border-gray-200 dark:border-gray-800 rounded-lg p-4 sm:p-6 bg-white dark:bg-gray-950">
                {invite.companyLogo && (
                    <div className="flex items-center gap-4">
                        <img
                            src={logoError || !invite.companyLogo ? defaultLogo : invite.companyLogo}
                            alt="Logo da empresa"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg border border-gray-200 dark:border-gray-800 flex-shrink-0"
                            onError={() => setLogoError(true)}
                        />
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1">{invite.companyName || 'Empresa Desconhecida'}</h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400 font-mono truncate">ID: {invite.companyId}</p>
                        </div>
                    </div>
                )}
                {invite.companyDescription && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
                        <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">{invite.companyDescription}</p>
                    </div>
                )}
                <div className="space-y-3 text-sm sm:text-base">
                    <div><strong className="text-gray-700 dark:text-gray-300">Email do Destinatário:</strong> <span className="text-gray-900 dark:text-white">{invite.email}</span></div>
                    {invite.inviterName && (
                        <div><strong className="text-gray-700 dark:text-gray-300">Convidado por:</strong> <span className="text-gray-900 dark:text-white">{invite.inviterName} ({invite.inviterEmail || 'N/A'})</span></div>
                    )}
                    <div><strong className="text-gray-700 dark:text-gray-300">Cargo:</strong> <span className="text-gray-900 dark:text-white">{invite.role}</span></div>
                    <div>
                        <strong className="text-gray-700 dark:text-gray-300">Status:</strong>{' '}
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            invite.status === 'PENDING' ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300' :
                            invite.status === 'ACCEPTED' ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300' :
                            invite.status === 'REJECTED' ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                        }`}>{STATUS_LABELS[invite.status] || invite.status}</span>
                    </div>
                    <div><strong className="text-gray-700 dark:text-gray-300">Data de Envio:</strong> <span className="text-gray-900 dark:text-white">{formatDate(invite.createdAt)}</span></div>
                    <div><strong className="text-gray-700 dark:text-gray-300">Expira em:</strong> <span className="text-gray-900 dark:text-white">{formatDate(invite.expiresAt)}</span></div>
                </div>
                {invite.isInviter && (
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            Você criou este convite. Apenas o destinatário pode aceitar ou rejeitar.
                        </p>
                    </div>
                )}
                {invite.canAccept && invite.canReject && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={() => acceptMutation.mutate()}
                            disabled={acceptMutation.isPending}
                            className="flex-1 sm:flex-initial px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
                        >
                            {acceptMutation.isPending ? 'Aceitando...' : 'Aceitar'}
                        </button>
                        <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={rejectMutation.isPending}
                            className="flex-1 sm:flex-initial px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm sm:text-base whitespace-nowrap"
                        >
                            {rejectMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
                        </button>
                    </div>
                )}
            </div>
            <ConfirmModal
                open={showRejectModal}
                title="Rejeitar convite?"
                onCancel={() => setShowRejectModal(false)}
                onConfirm={() => {
                    setShowRejectModal(false);
                    rejectMutation.mutate();
                }}
            >
                Tem certeza que deseja rejeitar este convite? Esta ação não pode ser desfeita.
            </ConfirmModal>
        </div>
    );
}

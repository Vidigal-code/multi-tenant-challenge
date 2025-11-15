"use client";
import React, { useEffect, useState } from 'react';
import {useParams, useRouter} from 'next/navigation';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {http} from '../../../lib/http';
import {getErrorMessage} from '../../../lib/error';
import {getSuccessMessage, getErrorMessage as getErrorMessageByCode} from '../../../lib/messages';
import {useToast} from '../../../hooks/useToast';
import { ConfirmModal } from '../../../components/ConfirmModal';

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
            qc.invalidateQueries({ queryKey: ['invites-created'] });
            qc.invalidateQueries({ queryKey: ['invites-received'] });
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
            qc.invalidateQueries({ queryKey: ['invites-created'] });
            qc.invalidateQueries({ queryKey: ['invites-received'] });
            setTimeout(() => {
                router.push('/dashboard');
            }, 1000);
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível rejeitar o convite');
            show({ type: 'error', message: m });
        },
    });

    const defaultLogo = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO ||  'https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png';
    const [logoError, setLogoError] = React.useState(false);

    if (inviteQuery.isLoading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <h1 className="text-xl font-semibold mb-4">Carregando convite...</h1>
            </div>
        );
    }

    if (inviteQuery.isError) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <h1 className="text-xl font-semibold mb-4 text-red-600">Erro</h1>
                <p className="text-red-600">{getErrorMessage(inviteQuery.error, 'Convite inválido ou expirado')}</p>
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
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            <h1 className="text-xl font-semibold">Detalhes do Convite</h1>
            <div className="space-y-4 border rounded p-4">
                {invite.companyLogo && (
                    <div className="flex items-center gap-4">
                        <img
                            src={logoError || !invite.companyLogo ? defaultLogo : invite.companyLogo}
                            alt="Logo da empresa"
                            className="w-16 h-16 object-cover rounded"
                            onError={() => setLogoError(true)}
                        />
                        <div>
                            <h2 className="text-lg font-semibold">{invite.companyName || 'Empresa Desconhecida'}</h2>
                            <p className="text-sm text-gray-600">ID: {invite.companyId}</p>
                        </div>
                    </div>
                )}
                {invite.companyDescription && (
                    <div>
                        <p className="text-sm text-gray-700">{invite.companyDescription}</p>
                    </div>
                )}
                <div className="space-y-2 text-sm">
                    <p><strong>Email do Destinatário:</strong> {invite.email}</p>
                    {invite.inviterName && (
                        <p><strong>Convidado por:</strong> {invite.inviterName} ({invite.inviterEmail || 'N/A'})</p>
                    )}
                    <p><strong>Cargo:</strong> {invite.role}</p>
                    <p><strong>Status:</strong> {STATUS_LABELS[invite.status] || invite.status}</p>
                    <p><strong>Data de Envio:</strong> {formatDate(invite.createdAt)}</p>
                    <p><strong>Expira em:</strong> {formatDate(invite.expiresAt)}</p>
                </div>
                {invite.isInviter && (
                    <div className="pt-2 border-t">
                        <p className="text-sm text-gray-600">
                            Você criou este convite. Apenas o destinatário pode aceitar ou rejeitar.
                        </p>
                    </div>
                )}
                {invite.canAccept && invite.canReject && (
                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={() => acceptMutation.mutate()}
                            disabled={acceptMutation.isPending}
                            className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                        >
                            {acceptMutation.isPending ? 'Aceitando...' : 'Aceitar'}
                        </button>
                        <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={rejectMutation.isPending}
                            className="border border-gray-300 px-4 py-2 rounded text-sm disabled:opacity-50 hover:bg-gray-50"
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

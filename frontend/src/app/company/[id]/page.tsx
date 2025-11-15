"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { redirect } from 'next/navigation';
import { http } from '../../../lib/http';
import { useParams } from 'next/navigation';
import { InviteForm } from '../../../components/invites/InviteForm';
import { MemberList } from '../../../components/members/MemberList';
import { getErrorMessage } from '../../../lib/error';
import { getSuccessMessage, getErrorMessage as getErrorMessageByCode } from '../../../lib/messages';
import { useToast } from '../../../hooks/useToast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../../components/skeleton/Skeleton';
import { queryKeys } from '../../../lib/queryKeys';
import { Modal } from '../../../components/modals/Modal';
import { ConfirmModal } from '../../../components/modals/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../../lib/realtime';
import { formatDate, formatDateOnly } from '../../../lib/date-utils';
import { MdNotifications, MdSupervisorAccount } from 'react-icons/md';
import { FiStar, FiTrash2, FiEdit } from 'react-icons/fi';
import { BiUser } from 'react-icons/bi';
import { DEFAULT_COMPANY_LOGO } from '../../../types';

interface Member { id: string; userId: string; role: string; name?: string; email?: string; joinedAt?: string; }
interface Company { id: string; name: string; logoUrl?: string; description?: string; is_public: boolean; createdAt?: string; }

function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
}

export default function CompanyPage() {

    const params = useParams();
    const id = params?.id as string;
    const [members, setMembers] = useState<Member[]>([]);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [showInvite, setShowInvite] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [editName, setEditName] = useState('');
    const [editLogo, setEditLogo] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editIsPublic, setEditIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showNotificationModal, setShowNotificationModal] = useState(false);
    const [notificationTitle, setNotificationTitle] = useState('');
    const [notificationBody, setNotificationBody] = useState('');
    const [notificationEmails, setNotificationEmails] = useState('');
    const [logoError, setLogoError] = useState(false);
    const [showFullDescription, setShowFullDescription] = useState(false);
    const [showRequestToJoinModal, setShowRequestToJoinModal] = useState(false);
    const [requestContacts, setRequestContacts] = useState('');
    const [requestMessage, setRequestMessage] = useState('');
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferToUserId, setTransferToUserId] = useState('');
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [showActionConfirmModal, setShowActionConfirmModal] = useState(false);
    const [actionType, setActionType] = useState<'delete' | 'changeRole' | null>(null);
    const [actionMember, setActionMember] = useState<Member | null>(null);
    const [newRole, setNewRole] = useState<'OWNER' | 'ADMIN' | 'MEMBER' | ''>('');
    const { show } = useToast();
    const qc = useQueryClient();

    const profileQuery = useQuery({
        queryKey: [queryKeys.profile()],
        queryFn: async () => {
            const { data } = await http.get('/auth/profile');
            return data;
        },
        staleTime: 60_000,
    });

    const selectMutation =
        useMutation({
            mutationFn: async () => {
                if (!id || id === 'undefined') {
                    redirect('/dashboard');
                    return;
                }
                await http.post(`/company/${id}/select`);
            },
            onSuccess: async () => {
                setMessage('Empresas ativas definidas');
                show({ type: 'success', message: 'Empresas ativas atualizadas' });
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Não foi possível atualizar as empresas ativas.');
                setError(m);
                show({ type: 'error', message: m });
            }
        });

    const membersQuery =
        useQuery<{ members: Member[]; total: number; currentUserRole: string | null }>({
            queryKey: queryKeys.companyMembers(id),
            queryFn: async () => {
                const { data } = await http.get(`/companys/${id}/members`);
                return {
                    members: (data.members || data.data || []) as Member[],
                    total: data.total || (data.data || []).length,
                    currentUserRole: data.currentUserRole || null
                };
            },
            enabled: Boolean(id),
            staleTime: 30_000,
        });

    const [removeMemberConfirm, setRemoveMemberConfirm] = useState<Member | null>(null);

    const removeMemberMutation = useMutation({
        mutationFn: async (member: Member) => {
            await http.delete(`/companys/${id}/members/${member.userId}`);
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
            setRemoveMemberConfirm(null);
            show({ type: 'success', message: 'Membro removido com sucesso' });
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível remover membro');
            setError(m);
            show({ type: 'error', message: m });
            setRemoveMemberConfirm(null);
        },
    });

    const changeRoleMutation = useMutation({
        mutationFn: async ({ member, role }: { member: Member; role: 'OWNER' | 'ADMIN' | 'MEMBER' }) => {
            await http.patch(`/companys/${id}/members/${member.userId}/role`, { role });
        },
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível atualizar papel');
            setError(m);
            show({ type: 'error', message: m });
        },
    });

    const leaveMutation = useMutation({
        mutationFn: async () => {
            if (!profileQuery.data?.id) {
                throw new Error('Não foi possível determinar o usuário atual');
            }
            await http.post(`/companys/${id}/members/${profileQuery.data.id}/leave`);
        },
        onSuccess: async () => {
            show({ type: 'success', message: 'Você saiu da empresa' });
            window.location.href = '/dashboard';
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível sair da empresa');
            setError(m);
            show({ type: 'error', message: m });
        },
    });

    const sendNotificationMutation = useMutation({
        mutationFn: async ({ title, body, emails }: { title: string; body: string; emails: string }) => {
            const recipientsEmails = emails ? emails.split(',').map(e => e.trim()) : null;
            const result = await http.post('/notifications', { companyId: id, title, body, recipientsEmails });
            return result.data;
        },
        onSuccess: async (result) => {
            show({ type: 'success', message: 'Mensagem global enviada' });
            setShowNotificationModal(false);
            setNotificationTitle('');
            setNotificationBody('');
            setNotificationEmails('');

            if (result.validationResults && result.validationResults.length > 0) {
                result.validationResults.forEach((entry: any) => {
                    const tone = entry.status === 'sent' ? 'success' : 'error';
                    const label = entry.email === '*' ? 'Membros da empresa' : entry.email;
                    const message = entry.status === 'sent'
                        ? getSuccessMessage(entry.code, { count: entry.count })
                        : getErrorMessageByCode(entry.code);
                    show({ type: tone, message: `${label}: ${message}` });
                });
            }
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Não foi possível enviar notificações');
            setError(m);
            show({ type: 'error', message: m });
        },
    });

    const roleQuery = useQuery<{ role: 'OWNER' | 'ADMIN' | 'MEMBER' | null }>({
        queryKey: ['companys-role', id],
        queryFn: async () => {
            const { data } = await http.get(`/companys/${id}/members/role`);
            return data;
        },
        enabled: Boolean(id),
        staleTime: 30_000,
    });

    const companyQuery = useQuery<Company>({
        queryKey: ['company', id],
        queryFn: async () => {
            try {
                const { data } = await http.get(`/company/${id}`);
                return data;
            } catch (err: any) {
                if (err?.response?.status === 403 || err?.response?.status === 401) {
                    const { data } = await http.get(`/company/${id}/public-info`);
                    return {
                        id: data.id,
                        name: data.name,
                        logoUrl: data.logoUrl,
                        description: data.description,
                        is_public: data.is_public,
                        createdAt: data.createdAt,
                    };
                }
                throw err;
            }
        },
        enabled: Boolean(id),
        staleTime: 30_000,
    });

    const isMember = !!roleQuery.data?.role;

    const primaryOwnerQuery = useQuery<{
        primaryOwnerUserId: string | null;
        primaryOwnerName: string; primaryOwnerEmail: string
    }>({
        queryKey: ['primary-owner', id],
        queryFn: async () => {
            const { data } = await http.get(`/companys/${id}/members/primary-owner`);
            return data;
        },
        enabled: Boolean(id) && isMember,
        staleTime: 60_000,
    });

    const publicCompanyInfoQuery = useQuery<{
        memberCount: number;
        primaryOwnerName: string; primaryOwnerEmail: string
    }>({
        queryKey: ['public-companys-info', id],
        queryFn: async () => {
            try {
                const publicInfo = await http.get(`/company/${id}/public-info`);
                return {
                    memberCount: publicInfo.data?.memberCount || 0,
                    primaryOwnerName: publicInfo.data?.primaryOwnerName || 'N/A',
                    primaryOwnerEmail: publicInfo.data?.primaryOwnerEmail || 'N/A',
                };
            } catch {
                return { memberCount: 0, primaryOwnerName: 'N/A', primaryOwnerEmail: 'N/A' };
            }
        },
        enabled: Boolean(id) && companyQuery.data?.is_public && !isMember,
        staleTime: 60_000,
    });

    const canEdit = useMemo(() => roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN', [roleQuery.data]);
    const canManage = canEdit;
    const canDelete = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);
    const canLeave = useMemo(() => roleQuery.data?.role && roleQuery.data.role !== 'OWNER', [roleQuery.data]);
    const canSendNotification = canEdit;
    const canTransferOwnership = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);

    const transferOwnershipMutation = useMutation({
        mutationFn: async (newOwnerId: string) => {
            await http.post(`/companys/${id}/members/transfer-ownership`, { newOwnerId });
        },
        onSuccess: async () => {
            show({ type: 'success', message: 'Propriedade transferida com sucesso' });
            setShowTransferModal(false);
            setTransferToUserId('');
            await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
            await qc.invalidateQueries({ queryKey: ['primary-owner', id] });
            await qc.invalidateQueries({ queryKey: ['companys-role', id] });
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Falha ao transferir propriedade');
            setError(m);
            show({ type: 'error', message: m });
        },
    });

    useEffect(() => {
        if (membersQuery.isSuccess && members.length === 0) {
            setMembers(membersQuery.data.members || []);
        }
    }, [membersQuery.isSuccess, membersQuery.data, members.length]);

    const [hasSelectedCompany, setHasSelectedCompany] = useState(false);
    useEffect(() => {
        if (!membersQuery.isLoading && selectMutation.status === 'idle' && id && id !== 'undefined' && !hasSelectedCompany) {
            selectMutation.mutate();
            setHasSelectedCompany(true);
        }
    }, [membersQuery.isLoading, id]);

    const handleInvited = useCallback((inviteUrl: string) => {
        setInviteToken(inviteUrl);
        show({ type: 'success', message: 'Convite criado' });
    }, [show]);

    useEffect(() => {
        let active = true;
        const unsubscribers: Array<() => void> = [];

        whenReady().then(() => {
            if (!active) return;
            unsubscribers.push(
                subscribe(RT_EVENTS.COMPANY_UPDATED, (payload: any) => {
                    if (payload?.id === id) {
                        qc.invalidateQueries({ queryKey: ['company', id] });
                    }
                }),
            );
            const refetchMembers = () => {
                qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
                qc.invalidateQueries({ queryKey: ['company', id] });
            };
            unsubscribers.push(
                subscribe(RT_EVENTS.MEMBER_JOINED, (payload: any) => {
                    if (payload?.companyId === id) {
                        refetchMembers();
                    }
                }),
            );
            unsubscribers.push(
                subscribe(RT_EVENTS.MEMBER_LEFT, (payload: any) => {
                    if (payload?.companyId === id) {
                        refetchMembers();
                    }
                }),
            );
        });

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [id, qc]);

    const company = companyQuery.data;

    if (companyQuery.isLoading || roleQuery.isLoading) {
        return <Skeleton className="h-32" />;
    }

    if (!company) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    Empresa não encontrada.
                </div>
            </div>
        );
    }

    if (!company.is_public && !isMember) {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <h2 className="text-lg sm:text-xl font-semibold text-red-800 dark:text-red-400 mb-2">Acesso Negado</h2>
                    <p className="text-red-700 dark:text-red-400">Acesso negado, empresa privada.</p>
                </div>
            </div>
        );
    }

    if (company.is_public && !isMember) {
        const defaultLogo = DEFAULT_COMPANY_LOGO;

        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <img
                        src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
                        alt="Logo da empresa"
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                        onError={() => setLogoError(true)}
                    />
                    <div className="min-w-0 flex-1">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">{company.name}</h1>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">ID: {company.id}</p>
                    </div>
                </div>
                {company.description && (
                    <div className="mb-4">
                        <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300">{company.description}</p>
                    </div>
                )}
                {publicCompanyInfoQuery.data && (
                    <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 space-y-2">
                        <p><strong className="text-gray-900 dark:text-white">Quantidade de Membros:</strong> {publicCompanyInfoQuery.data.memberCount}</p>
                        <p><strong className="text-gray-900 dark:text-white">Proprietário Principal:</strong> {
                            publicCompanyInfoQuery.data.primaryOwnerName !== 'N/A'
                                ? `${publicCompanyInfoQuery.data.primaryOwnerName}${publicCompanyInfoQuery.data.primaryOwnerEmail !== 'N/A' ?
                                    ` (${publicCompanyInfoQuery.data.primaryOwnerEmail})` : ''}`
                                : 'Não disponível'
                        }</p>
                        {company.createdAt && (
                            <p><strong className="text-gray-900 dark:text-white">Data de Criação:</strong> {formatDate(company.createdAt)}</p>
                        )}
                    </div>
                )}
                <button
                    onClick={() => setShowRequestToJoinModal(true)}
                    className="px-6 py-3 bg-gray-900 dark:bg-white text-white
                    dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
                >
                    Pedir para participar
                </button>
                <Modal
                    open={showRequestToJoinModal}
                    title="Pedir para Participar"
                    onClose={() => {
                        setShowRequestToJoinModal(false);
                        setRequestContacts('');
                        setRequestMessage('');
                    }}
                >
                    <form
                        className="space-y-4"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            try {
                                const contacts = requestContacts.trim() ? requestContacts.split(',').map(e => e.trim()) : null;
                                await http.post('/notifications', {
                                    companyId: id,
                                    title: `Solicitação de Ingresso para ${company.name}`,
                                    body: requestMessage.trim() || `Gostaria de participar da empresa ${company.name}.`,
                                    recipientsEmails: contacts,
                                    onlyOwnersAndAdmins: true,
                                });
                                show({ type: 'success', message: 'Solicitação enviada com sucesso' });
                                setShowRequestToJoinModal(false);
                                setRequestContacts('');
                                setRequestMessage('');
                            } catch (err: any) {
                                const m = getErrorMessage(err, 'Falha ao enviar solicitação');
                                show({ type: 'error', message: m });
                            }
                        }}
                    >
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contatos (emails separados por vírgula)</label>
                            <input
                                type="text"
                                value={requestContacts}
                                onChange={(e) => setRequestContacts(e.target.value)}
                                placeholder="kauan@gmail.com, rodrigo@gmail.com (deixe vazio para enviar a todos owners e admins)"
                                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors text-sm"
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Deixe vazio
                                para enviar a todos os owners e admins da empresa</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mensagem</label>
                            <textarea
                                value={requestMessage}
                                onChange={(e) => setRequestMessage(e.target.value)}
                                placeholder="Mensagem opcional"
                                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                                rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none
                                focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none transition-colors"
                                rows={4}
                            />
                        </div>
                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowRequestToJoinModal(false);
                                    setRequestContacts('');
                                    setRequestMessage('');
                                }}
                                className="px-4 py-2 border border-gray-200 dark:border-gray-800
                                rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-gray-900 dark:bg-white text-white
                                dark:text-gray-900 rounded-lg hover:bg-gray-800
                                dark:hover:bg-gray-200 transition-colors font-medium text-sm"
                            >
                                Enviar Solicitação
                            </button>
                        </div>
                    </form>
                </Modal>
            </div>
        );
    }

    const defaultLogo = DEFAULT_COMPANY_LOGO;

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <img
                    src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
                    alt="Logo da empresa"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                    onError={() => setLogoError(true)}
                />
                <div className="min-w-0 flex-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{company.name}</h1>
                    {company.description && (
                        <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            {company.is_public && !isMember ? (
                                <span>{truncate(company.description, 400)}</span>
                            ) : (
                                <>
                                    <span>{showFullDescription ? company.description : truncate(company.description, 400)}</span>
                                    {company.description.length > 400 && (
                                        <button
                                            className="text-gray-900 dark:text-white underline ml-2 hover:no-underline"
                                            onClick={() => setShowFullDescription((prev) => !prev)}
                                        >
                                            {showFullDescription ? 'Mostrar menos' : 'Ler mais'}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    {isMember && (
                        <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2 space-y-1">
                            {company.createdAt && (roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN') && (
                                <div>Criado: {formatDate(company.createdAt)}</div>
                            )}
                            {membersQuery.data?.total !== undefined && (
                                <div>Membros: {membersQuery.data.total}</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">{message}</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border
            border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
            <div className="flex flex-wrap gap-3">
                {canLeave && (
                    <button className="px-4 py-2 border border-red-200 dark:border-red-800
                     bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600
                     transition-colors font-medium text-sm sm:text-base"
                        onClick={() => setShowLeaveModal(true)}>
                        Sair da empresa
                    </button>
                )}
                {canSendNotification && (
                    <button className="px-4 py-2 border border-gray-200 dark:border-gray-800
                    rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800
                     dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base flex items-center gap-2"
                        onClick={() => setShowNotificationModal(true)}>
                        <MdNotifications className="text-base" />
                        <span>Enviar mensagem global</span>
                    </button>
                )}
                {canTransferOwnership && (
                    <button className="px-4 py-2 border border-gray-200 dark:border-gray-800
                    rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800
                    dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base flex items-center gap-2"
                        onClick={() => setShowTransferModal(true)}>
                        <MdSupervisorAccount className="text-base" />
                        <span>Transferir Propriedade</span>
                    </button>
                )}
            </div>
            {canManage && (
                <>
                    <div className="flex flex-wrap gap-3 items-center">
                        <button onClick={() => setShowInvite(s => !s)} className="text-sm text-gray-900 dark:text-white hover:underline">
                            {showInvite ? 'Ocultar formulário de convite' : 'Mostrar formulário de convite'}
                        </button>
                        {canEdit && (
                            <button className="px-4 py-2 border border-gray-200 dark:border-gray-800
                            rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                            hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                                onClick={() => {
                                    setEditOpen(true); setEditName(company.name); setEditLogo(company.logoUrl || '');
                                    setEditDescription(company.description || ''); setEditIsPublic(company.is_public);
                                }}>Editar empresa
                            </button>
                        )}
                        {canDelete && (
                            <button className="px-4 py-2 border
                            border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950
                             text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-colors font-medium text-sm"
                                onClick={async () => {
                                    if (!confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) return;
                                    try {
                                        await http.delete(`/company/${id}`); show({ type: 'success', message: 'Empresa excluída' });
                                        window.location.href = '/dashboard';
                                    }
                                    catch (err) {
                                        const m = getErrorMessage(err, 'Falha ao excluir empresa');
                                        setError(m); show({ type: 'error', message: m });
                                    }
                                }}>Excluir empresa</button>
                        )}
                    </div>
                    {showInvite && <InviteForm companyId={id} onInvited={handleInvited} />}
                </>
            )}
            {inviteToken && (
                <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Link de convite:</span>
                        <code className="flex-1 text-xs sm:text-sm bg-white dark:bg-gray-950 border
                        border-gray-200 dark:border-gray-800 px-3 py-2 rounded break-all
                        text-gray-800 dark:text-gray-200 min-w-0">{inviteToken}</code>
                        <button
                            onClick={() => { navigator.clipboard.writeText(inviteToken); show({ type: 'info', message: 'Link copiado!' }); }}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-800
                            rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                            hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium
                            text-xs sm:text-sm whitespace-nowrap"
                        >Copiar link</button>
                    </div>
                </div>
            )}
            <Modal open={editOpen} title="Editar Empresa" onClose={() => setEditOpen(false)}>
                <form className="space-y-4"
                    onSubmit={async e => {
                        e.preventDefault(); setSaving(true);
                        setError(null); try {
                            await http.patch(`/company/${id}`, {
                                name: editName || undefined,
                                logoUrl: editLogo || undefined,
                                description: editDescription.trim().slice(0, 400) || undefined,
                                is_public: editIsPublic
                            });
                            show({ type: 'success', message: 'Empresa atualizada' });
                            setMessage('Empresa atualizada'); setEditOpen(false);
                            await qc.invalidateQueries({ queryKey: ['company', id] });
                        }
                        catch (err) {
                            const m =
                                getErrorMessage(err, 'Falha ao atualizar empresa');
                            setError(m); show({ type: 'error', message: m });
                        } finally {
                            setSaving(false);
                        }
                    }}>
                    <div>
                        <input value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Novo nome" className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                                rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                                 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                                  dark:focus:ring-white focus:border-transparent transition-colors" />
                    </div>
                    <div>
                        <input value={editLogo}
                            onChange={e => setEditLogo(e.target.value)}
                            placeholder="URL do logo" className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                               rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                               dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                               dark:focus:ring-white focus:border-transparent transition-colors" />
                    </div>
                    <div>
                        <textarea value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            placeholder="Descrição (máximo 400 caracteres)"
                            maxLength={400}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                                   rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                   placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none
                                   focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent
                                   resize-none transition-colors" rows={4} />
                    </div>
                    <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox"
                            checked={editIsPublic}
                            onChange={e => setEditIsPublic(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white
                                focus:ring-2 focus:ring-gray-900 dark:focus:ring-white" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Empresa pública (visível para todos os usuários)</span>
                    </label>
                    <div className="flex justify-end gap-3">
                        <button type="button"
                            onClick={() => setEditOpen(false)} className="px-4 py-2 border border-gray-200
                                dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm">Cancelar</button>
                        <button disabled={saving} type="submit" className="px-4 py-2 bg-gray-900 dark:bg-white
                         text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200
                         disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors">
                            {saving ? 'Salvando...' : 'Salvar'}</button>
                    </div>
                </form>
            </Modal>
            <Modal open={showNotificationModal} title="Enviar Mensagem Global"
                onClose={() => setShowNotificationModal(false)}>
                <form className="space-y-4" onSubmit={async e => {
                    e.preventDefault();
                    await sendNotificationMutation.mutateAsync({ title: notificationTitle, body: notificationBody, emails: notificationEmails });
                }}>
                    <div>
                        <input value={notificationTitle} onChange={e =>
                            setNotificationTitle(e.target.value)} placeholder="Assunto" className="w-full px-4
                            py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                            text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                            focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors" required />
                    </div>
                    <div>
                        <textarea value={notificationBody} onChange={e =>
                            setNotificationBody(e.target.value)} placeholder="Mensagem" className="w-full px-4 py-3
                            border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                             text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none
                             focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none
                             transition-colors" rows={4} required />
                    </div>
                    <div>
                        <input value={notificationEmails} onChange={e =>
                            setNotificationEmails(e.target.value)} placeholder="Emails (separados por vírgula, deixe vazio para todos)"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
                                dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                                 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors" />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={() => setShowNotificationModal(false)}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
                                 dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900
                                 transition-colors font-medium text-sm">Cancelar</button>
                        <button type="submit" disabled={sendNotificationMutation.isPending}
                            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
                                 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50
                                 disabled:cursor-not-allowed font-medium text-sm transition-colors">
                            {sendNotificationMutation.isPending ? 'Enviando...' : 'Enviar'}
                        </button>
                    </div>
                </form>
            </Modal>
            {membersQuery.isLoading || roleQuery.isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                </div>
            ) : (
                <MemberList
                    members={membersQuery.data?.members || members}
                    currentRole={(roleQuery.data?.role ?? null) as any}
                    currentUserId={profileQuery.data?.id}
                    primaryOwnerUserId={primaryOwnerQuery.data?.primaryOwnerUserId || null}
                    onMemberClick={(m) => {
                        setSelectedMember(m);
                        setShowMemberModal(true);
                    }}
                    loadingIds={[]}
                />
            )}
            <ConfirmModal
                open={showLeaveModal}
                title="Sair da empresa?"
                onCancel={() => setShowLeaveModal(false)}
                onConfirm={() => leaveMutation.mutate()}
            >
                Você realmente deseja sair da empresa? Todos os administradores serão notificados.
            </ConfirmModal>
            <ConfirmModal
                open={!!removeMemberConfirm}
                title="Remover membro?"
                onCancel={() => setRemoveMemberConfirm(null)}
                onConfirm={() => {
                    if (removeMemberConfirm) {
                        removeMemberMutation.mutate(removeMemberConfirm);
                    }
                }}
            >
                Tem certeza que deseja remover este membro da empresa? Esta ação não pode ser desfeita.
            </ConfirmModal>
            <Modal
                open={showTransferModal}
                title="Transferir Propriedade"
                onClose={() => {
                    setShowTransferModal(false);
                    setTransferToUserId('');
                }}
            >
                <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!transferToUserId.trim()) {
                            show({ type: 'error', message: 'Por favor, selecione um membro' });
                            return;
                        }
                        await transferOwnershipMutation.mutateAsync(transferToUserId);
                    }}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Selecionar novo proprietário</label>
                        <select
                            value={transferToUserId}
                            onChange={(e) => setTransferToUserId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                             bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none
                             focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"
                            required
                        >
                            <option value="">Selecione um membro...</option>
                            {(membersQuery.data?.members || members)
                                .filter((m: Member) => m.userId !== profileQuery.data?.id && m.role !== 'OWNER')
                                .map((m: Member) => {
                                    const roleTranslations: Record<string, string> = {
                                        'OWNER': 'PROPRIETÁRIO',
                                        'ADMIN': 'ADMINISTRADOR',
                                        'MEMBER': 'MEMBRO'
                                    };
                                    return (
                                        <option key={m.userId} value={m.userId}>
                                            {m.name || 'Desconhecido'} ({m.email || m.userId}) - {roleTranslations[m.role] || m.role}
                                        </option>
                                    );
                                })}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Você se tornará um ADMINISTRADOR após transferir a propriedade.</p>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowTransferModal(false);
                                setTransferToUserId('');
                            }}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
                             dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900
                             transition-colors font-medium text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={transferOwnershipMutation.isPending || !transferToUserId}
                            className="px-4 py-2 bg-gray-900 dark:bg-white text-white
                             dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200
                             disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
                        >
                            {transferOwnershipMutation.isPending ? 'Transferindo...' : 'Transferir Propriedade'}
                        </button>
                    </div>
                </form>
            </Modal>
            <Modal
                open={showMemberModal}
                title="Informações do Membro"
                onClose={() => {
                    setShowMemberModal(false);
                    setSelectedMember(null);
                    setNewRole('');
                }}
            >
                {selectedMember && (() => {
                    const memberCanDelete = () => {
                        if (selectedMember.userId === profileQuery.data?.id) return false;
                        if (roleQuery.data?.role === 'ADMIN') {
                            return selectedMember.role === 'MEMBER';
                        }
                        if (roleQuery.data?.role === 'OWNER') {
                            return !isPrimaryOwner;
                        }
                        return false;
                    };

                    const memberCanEdit = () => {
                        if (selectedMember.userId === profileQuery.data?.id) return false;
                        if (roleQuery.data?.role === 'OWNER') {
                            return true;
                        }
                        return false;
                    };

                    const isPrimaryOwner = primaryOwnerQuery.data?.primaryOwnerUserId === selectedMember.userId;
                    const canDeleteMember = memberCanDelete() && !isPrimaryOwner;
                    const canEditMember = memberCanEdit() && !isPrimaryOwner;

                    return (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-800">
                                {isPrimaryOwner && (
                                    <FiStar className="text-yellow-500 flex-shrink-0" title="Proprietário Principal" />
                                )}
                                <BiUser className="text-gray-400 dark:text-gray-600 flex-shrink-0 text-2xl" />
                                <div>
                                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {selectedMember.name || 'Desconhecido'}
                                    </h4>
                                    {selectedMember.email && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{selectedMember.email}</p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">ID do Usuário:</span>
                                    <p className="font-mono text-xs text-gray-600 dark:text-gray-400 mt-1 break-all">
                                        {selectedMember.userId}
                                    </p>
                                </div>
                                <div>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Papel:</span>
                                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                                        {selectedMember.role === 'OWNER' ? 'PROPRIETÁRIO' :
                                            selectedMember.role === 'ADMIN' ? 'ADMINISTRADOR' :
                                                'MEMBRO'}
                                    </p>
                                </div>
                                {selectedMember.joinedAt && (
                                    <div>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Entrou em:</span>
                                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                                            {formatDateOnly(selectedMember.joinedAt)}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {(canDeleteMember || canEditMember) && (
                                <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
                                    {canEditMember && (
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                                Alterar Papel:
                                            </label>
                                            <div className="flex gap-2">
                                                <select
                                                    value={newRole || selectedMember.role}
                                                    onChange={(e) => setNewRole(e.target.value as any)}
                                                    className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white text-sm"
                                                >
                                                    {['OWNER', 'ADMIN', 'MEMBER']
                                                        .filter(r => roleQuery.data?.role === 'OWNER' ? true : r !== 'OWNER')
                                                        .map(r => (
                                                            <option key={r} value={r}>
                                                                {r === 'OWNER' ? 'PROPRIETÁRIO' :
                                                                    r === 'ADMIN' ? 'ADMINISTRADOR' :
                                                                        'MEMBRO'}
                                                            </option>
                                                        ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        if ((newRole || selectedMember.role) !== selectedMember.role) {
                                                            setActionType('changeRole');
                                                            setActionMember(selectedMember);
                                                            setShowActionConfirmModal(true);
                                                        }
                                                    }}
                                                    disabled={!newRole || newRole === selectedMember.role}
                                                    className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm flex items-center gap-2"
                                                >
                                                    <FiEdit className="text-base" />
                                                    Alterar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {canDeleteMember && (
                                        <button
                                            onClick={() => {
                                                setActionType('delete');
                                                setActionMember(selectedMember);
                                                setShowActionConfirmModal(true);
                                            }}
                                            className="w-full px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <FiTrash2 className="text-base" />
                                            Remover Membro
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })()}
            </Modal>
            <ConfirmModal
                open={showActionConfirmModal}
                title={actionType === 'delete' ? 'Remover membro?' : 'Alterar papel do membro?'}
                onCancel={() => {
                    setShowActionConfirmModal(false);
                    setActionType(null);
                    setActionMember(null);
                }}
                onConfirm={async () => {
                    if (actionType === 'delete' && actionMember) {
                        await removeMemberMutation.mutateAsync(actionMember);
                        setShowMemberModal(false);
                        setSelectedMember(null);
                    } else if (actionType === 'changeRole' && actionMember && newRole) {
                        await changeRoleMutation.mutateAsync({ member: actionMember, role: newRole as any });
                        show({ type: 'success', message: 'Papel atualizado' });
                        setShowMemberModal(false);
                        setSelectedMember(null);
                        setNewRole('');
                    }
                    setShowActionConfirmModal(false);
                    setActionType(null);
                    setActionMember(null);
                }}
                confirmLabel={actionType === 'delete' ? 'Remover' : 'Confirmar'}
            >
                {actionType === 'delete' && actionMember ? (
                    `Tem certeza que deseja remover ${actionMember.name || 'este membro'} da empresa? Esta ação não pode ser desfeita.`
                ) : actionType === 'changeRole' && actionMember && newRole ? (
                    `Tem certeza que deseja alterar o papel de ${actionMember.name || 'este membro'} para ${newRole === 'OWNER' ? 'PROPRIETÁRIO' : newRole === 'ADMIN' ? 'ADMINISTRADOR' : 'MEMBRO'}?`
                ) : null}
            </ConfirmModal>
        </div>
    );
}
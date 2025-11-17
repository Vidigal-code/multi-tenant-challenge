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
import { useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../../components/skeleton/Skeleton';
import { queryKeys } from '../../../lib/queryKeys';
import { Modal } from '../../../components/modals/Modal';
import { ConfirmModal } from '../../../components/modals/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../../lib/realtime';
import { formatDate, formatDateOnly } from '../../../lib/date-utils';
import { DEFAULT_COMPANY_LOGO } from '../../../types';
import {
    useCompany,
    useCompanyPublicInfo,
    useCompanyRole,
    useCompanyMembers,
    useCompanyPrimaryOwner,
    useSelectCompany,
    useUpdateCompany,
    useDeleteCompany,
    useRemoveMember,
    useChangeMemberRole,
    useLeaveCompany,
    useTransferOwnership,
    type Member,
    type Company,
} from '../../../services/api/company.api';
import { useProfile } from '../../../services/api/auth.api';
import { useCreateNotification } from '../../../services/api/notification.api';
import { useFriendships, useSendFriendNotification } from '../../../services/api/friendship.api';
import { MdNotifications, MdSupervisorAccount } from 'react-icons/md';
import {FiEdit, FiStar, FiTrash2, FiSend} from "react-icons/fi";
import {BiUser} from "react-icons/bi";

function truncate(text: string, max: number) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '...' : text;
}

export default function CompanyPage() {

    const params = useParams();
    const id = params?.id as string;
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
    const [removeMemberConfirm, setRemoveMemberConfirm] = useState<Member | null>(null);
    const [showDeleteCompanyModal, setShowDeleteCompanyModal] = useState(false);
    const [membersPage, setMembersPage] = useState(1);
    const [showMemberMessageModal, setShowMemberMessageModal] = useState(false);
    const [memberMessageTitle, setMemberMessageTitle] = useState('');
    const [memberMessageBody, setMemberMessageBody] = useState('');
    const MEMBERS_PAGE_SIZE = 10;
    const { show } = useToast();
    const qc = useQueryClient();

    const profileQuery = useProfile();
    const companyQuery = useCompany(id);
    const roleQuery = useCompanyRole(id);
    const isMember = !!roleQuery.data?.role;
    const shouldFetchPublicInfo = !isMember && ((companyQuery.isError && ((companyQuery.error as any)?.response?.status === 403 || (companyQuery.error as any)?.response?.status === 401)) || companyQuery.data?.is_public);
    const publicCompanyInfoQuery = useCompanyPublicInfo(id, shouldFetchPublicInfo);
    const company = useMemo(() => {
        return companyQuery.data || (publicCompanyInfoQuery.data ? {
            ...publicCompanyInfoQuery.data,
            is_public: true,
        } : null);
    }, [companyQuery.data, publicCompanyInfoQuery.data]);
    const isPublicCompany = company?.is_public ?? false;
    const membersQuery = useCompanyMembers(id, isMember);
    const primaryOwnerQuery = useCompanyPrimaryOwner(id, isMember);

    const selectMutation = useSelectCompany();
    const updateCompanyMutation = useUpdateCompany(id);
    const deleteCompanyMutation = useDeleteCompany();
    const removeMemberMutation = useRemoveMember(id);
    const changeRoleMutation = useChangeMemberRole(id);
    const leaveMutation = useLeaveCompany(id);
    const transferOwnershipMutation = useTransferOwnership(id);
    const sendNotificationMutation = useCreateNotification();
    const sendFriendMessageMutation = useSendFriendNotification();
    const { data: friends = [] } = useFriendships('ACCEPTED');

    const canEdit = useMemo(() => roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN', [roleQuery.data]);
    const canManage = canEdit;
    const canDelete = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);
    const canLeave = useMemo(() => roleQuery.data?.role && roleQuery.data.role !== 'OWNER', [roleQuery.data]);
    const canSendNotification = canEdit;
    const canTransferOwnership = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);


    const [hasSelectedCompany, setHasSelectedCompany] = useState(false);
    useEffect(() => {
        if (!membersQuery.isLoading && selectMutation.status === 'idle' && id && id !== 'undefined' && !hasSelectedCompany) {
            selectMutation.mutate(id, {
                onSuccess: () => {
                    setMessage('Empresas ativas definidas');
                },
                onError: (err: any) => {
                    const m = getErrorMessage(err, 'Não foi possível atualizar as empresas ativas.');
                    setError(m);
                },
            });
            setHasSelectedCompany(true);
        }
    }, [membersQuery.isLoading, id, hasSelectedCompany, selectMutation]);

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
                        qc.invalidateQueries({ queryKey: queryKeys.company(id) });
                        qc.invalidateQueries({ queryKey: queryKeys.companyPublicInfo(id) });
                    }
                }),
            );
            const refetchMembers = () => {
                qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
                qc.invalidateQueries({ queryKey: queryKeys.company(id) });
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

    if (!id || id === 'undefined') {
        return (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full min-w-0">
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                    ID da empresa inválido.
                </div>
            </div>
        );
    }

    useEffect(() => {
        setMembersPage(1);
    }, [membersQuery.data?.members?.length]);

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
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 p-6 sm:p-8 shadow-sm">
                    <div className="flex flex-col items-center gap-6 text-center justify-center">
                        <img
                            src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
                            alt="Logo da empresa"
                            className="w-24 h-24 sm:w-32 sm:h-32 object-cover rounded-lg flex-shrink-0 border border-gray-200 dark:border-gray-800"
                            onError={() => setLogoError(true)}
                        />
                        <div className="min-w-0 w-full">
                            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 break-words">{company.name}</h1>
                            {company.description && (
                                <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2 mb-4">
                                    <p className="break-words">{company.description}</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="w-full border-t border-gray-200 dark:border-gray-800 pt-6">
                            <div className="flex flex-col items-center gap-4 text-center space-y-4">
                                <div className="w-full">
                                    <div className="font-semibold text-gray-900 dark:text-white mb-1">ID da Empresa</div>
                                    <div className="text-gray-600 dark:text-gray-400 break-all font-mono text-xs sm:text-sm">{company.id}</div>
                                </div>
                                
                                {company.createdAt ? (
                                    <div className="w-full">
                                        <div className="font-semibold text-gray-900 dark:text-white mb-1">Data de Criação</div>
                                        <div className="text-gray-600 dark:text-gray-400">{formatDate(company.createdAt)}</div>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        <div className="font-semibold text-gray-900 dark:text-white mb-1">Data de Criação</div>
                                        <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Não disponível</div>
                                    </div>
                                )}
                                
                                {(() => {
                                    const memberCount = isMember 
                                        ? (membersQuery.data?.total ?? publicCompanyInfoQuery.data?.memberCount)
                                        : publicCompanyInfoQuery.data?.memberCount;
                                    const isLoading = isMember 
                                        ? (publicCompanyInfoQuery.isLoading || membersQuery.isLoading)
                                        : publicCompanyInfoQuery.isLoading;
                                    
                                    if (isLoading) {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1">Quantidade de Membros</div>
                                                <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Carregando...</div>
                                            </div>
                                        );
                                    } else if (memberCount !== undefined && memberCount !== null) {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1">Quantidade de Membros</div>
                                                <div className="text-gray-600 dark:text-gray-400">{memberCount}</div>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1">Quantidade de Membros</div>
                                                <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Não disponível</div>
                                            </div>
                                        );
                                    }
                                })()}
                                
                                {(() => {
                                    const ownerName = isMember
                                        ? (primaryOwnerQuery.data?.primaryOwnerName ?? publicCompanyInfoQuery.data?.primaryOwnerName)
                                        : publicCompanyInfoQuery.data?.primaryOwnerName;
                                    const ownerEmail = isMember
                                        ? (primaryOwnerQuery.data?.primaryOwnerEmail ?? publicCompanyInfoQuery.data?.primaryOwnerEmail)
                                        : publicCompanyInfoQuery.data?.primaryOwnerEmail;
                                    const isLoading = isMember
                                        ? (publicCompanyInfoQuery.isLoading || primaryOwnerQuery.isLoading)
                                        : publicCompanyInfoQuery.isLoading;
                                    
                                    if (isLoading) {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center justify-center gap-2">
                                                    <FiStar className="text-yellow-500" />
                                                    <span>Proprietário Principal</span>
                                                </div>
                                                <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Carregando...</div>
                                            </div>
                                        );
                                    } else if (ownerName && ownerName !== 'N/A') {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center justify-center gap-2">
                                                    <FiStar className="text-yellow-500" />
                                                    <span>Proprietário Principal</span>
                                                </div>
                                                <div className="text-gray-600 dark:text-gray-400 break-words font-medium">{ownerName}</div>
                                                {ownerEmail && ownerEmail !== 'N/A' && (
                                                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 break-all mt-1">{ownerEmail}</div>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div className="w-full">
                                                <div className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center justify-center gap-2">
                                                    <FiStar className="text-yellow-500" />
                                                    <span>Proprietário Principal</span>
                                                </div>
                                                <div className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm">Não disponível</div>
                                            </div>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                        
                        <div className="w-full pt-4">
                            <button
                                onClick={() => setShowRequestToJoinModal(true)}
                                className="w-full sm:w-auto px-6 py-3 bg-gray-900 dark:bg-white text-white
                                dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
                            >
                                Pedir para participar
                            </button>
                        </div>
                    </div>
                </div>
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
            <div className="border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 p-6 shadow-sm">
                <div className="flex flex-col items-center gap-4 text-center justify-center">
                    <img
                        src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
                        alt="Logo da empresa"
                        className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-lg flex-shrink-0"
                        onError={() => setLogoError(true)}
                    />
                    <div className="min-w-0 w-full">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2 break-words">{company.name}</h1>
                        {company.description && (
                            <div className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
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
                
                {isMember && primaryOwnerQuery.data && (
                    <div className="w-full border-t border-gray-200 dark:border-gray-800 pt-4 mt-4">
                        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800">
                            <div className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-center gap-2 text-sm sm:text-base">
                                <FiStar className="text-yellow-500" />
                                <span>Proprietário Principal</span>
                            </div>
                            <div className="text-gray-700 dark:text-gray-300 space-y-1 text-center">
                                {primaryOwnerQuery.data.primaryOwnerName && primaryOwnerQuery.data.primaryOwnerName !== 'N/A' && (
                                    <div className="font-medium text-sm sm:text-base">{primaryOwnerQuery.data.primaryOwnerName}</div>
                                )}
                                {primaryOwnerQuery.data.primaryOwnerEmail && primaryOwnerQuery.data.primaryOwnerEmail !== 'N/A' && (
                                    <div className="text-xs sm:text-sm break-all">{primaryOwnerQuery.data.primaryOwnerEmail}</div>
                                )}
                                {(!primaryOwnerQuery.data.primaryOwnerName || primaryOwnerQuery.data.primaryOwnerName === 'N/A') && 
                                 (!primaryOwnerQuery.data.primaryOwnerEmail || primaryOwnerQuery.data.primaryOwnerEmail === 'N/A') && (
                                    <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Não disponível</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-center">{message}</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border
            border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 items-center justify-center">
                {canLeave && (
                    <button className="w-full sm:w-auto px-4 py-2 border border-red-200 dark:border-red-800
                     bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600
                     transition-colors font-medium text-sm sm:text-base"
                        onClick={() => setShowLeaveModal(true)}>
                        Sair da empresa
                    </button>
                )}
                {canSendNotification && (
                    <button className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-800
                    rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800
                     dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base flex items-center justify-center gap-2"
                        onClick={() => setShowNotificationModal(true)}>
                        <MdNotifications className="text-base" />
                        <span>Enviar mensagem global</span>
                    </button>
                )}
                {canTransferOwnership && (
                    <button className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-800
                    rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800
                    dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base flex items-center justify-center gap-2"
                        onClick={() => setShowTransferModal(true)}>
                        <MdSupervisorAccount className="text-base" />
                        <span>Transferir Propriedade</span>
                    </button>
                )}
            </div>
            {canManage && (
                <>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-center justify-center">
                        <button onClick={() => setShowInvite(s => !s)} className="w-full sm:w-auto text-center text-sm text-gray-900 dark:text-white hover:underline">
                            {showInvite ? 'Ocultar formulário de convite' : 'Mostrar formulário de convite'}
                        </button>
                        {canEdit && (
                            <button className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-800
                            rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                            hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                                onClick={() => {
                                    setEditOpen(true); setEditName(company.name); setEditLogo(company.logoUrl || '');
                                    setEditDescription(company.description || ''); setEditIsPublic(company.is_public);
                                }}>Editar empresa
                            </button>
                        )}
                        {canDelete && (
                            <button
                                className="w-full sm:w-auto px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950
                             text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20
                             transition-colors font-medium text-sm"
                                onClick={() => setShowDeleteCompanyModal(true)}
                            >
                                Excluir empresa
                            </button>
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
                        e.preventDefault();
                        setSaving(true);
                        setError(null);
                        updateCompanyMutation.mutate({
                            name: editName || undefined,
                            logoUrl: editLogo || undefined,
                            description: editDescription.trim().slice(0, 400) || undefined,
                            is_public: editIsPublic,
                        }, {
                            onSuccess: () => {
                                show({ type: 'success', message: 'Empresa atualizada' });
                                setMessage('Empresa atualizada');
                                setEditOpen(false);
                            },
                            onError: (err: any) => {
                                const m = getErrorMessage(err, 'Falha ao atualizar empresa');
                                setError(m);
                                show({ type: 'error', message: m });
                            },
                            onSettled: () => {
                                setSaving(false);
                            },
                        });
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
                    const recipientsEmails = notificationEmails ? notificationEmails.split(',').map(e => e.trim()) : null;
                    sendNotificationMutation.mutate({
                        companyId: id,
                        title: notificationTitle,
                        body: notificationBody,
                        recipientsEmails,
                    }, {
                        onSuccess: (result: any) => {
                            show({ type: 'success', message: 'Mensagem global enviada' });
                            setShowNotificationModal(false);
                            setNotificationTitle('');
                            setNotificationBody('');
                            setNotificationEmails('');

                            if (result?.validationResults && result.validationResults.length > 0) {
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
                (() => {
                    const allMembers = membersQuery.data?.members || [];
                    const totalMembers = membersQuery.data?.total ?? allMembers.length;
                    const totalPages = Math.max(1, Math.ceil(totalMembers / MEMBERS_PAGE_SIZE));
                    const currentPage = Math.min(membersPage, totalPages);
                    const startIndex = (currentPage - 1) * MEMBERS_PAGE_SIZE;
                    const endIndex = startIndex + MEMBERS_PAGE_SIZE;
                    const pageMembers = allMembers.slice(startIndex, endIndex);

                    return (
                        <div className="space-y-3">
                            <MemberList
                                members={pageMembers}
                                currentRole={(roleQuery.data?.role ?? null) as any}
                                currentUserId={profileQuery.data?.id}
                                primaryOwnerUserId={primaryOwnerQuery.data?.primaryOwnerUserId || null}
                                onMemberClick={(m) => {
                                    setSelectedMember({
                                        ...m,
                                        role: m.role as 'OWNER' | 'ADMIN' | 'MEMBER'
                                    });
                                    setShowMemberModal(true);
                                }}
                                loadingIds={[]}
                            />
                            {totalPages > 1 && (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        Membros {startIndex + 1}–{Math.min(endIndex, totalMembers)} de {totalMembers}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setMembersPage((p) => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            Anterior
                                        </button>
                                        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setMembersPage((p) => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1.5 text-xs sm:text-sm border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()
            )}
            <ConfirmModal
                open={showLeaveModal}
                title="Sair da empresa?"
                onCancel={() => setShowLeaveModal(false)}
                onConfirm={() => {
                    if (!profileQuery.data?.id) {
                        show({ type: 'error', message: 'Não foi possível determinar o usuário atual' });
                        return;
                    }
                    leaveMutation.mutate(profileQuery.data.id, {
                        onSuccess: () => {
                            show({ type: 'success', message: 'Você saiu da empresa' });
                            window.location.href = '/dashboard';
                        },
                        onError: (err: any) => {
                            const m = getErrorMessage(err, 'Não foi possível sair da empresa');
                            show({ type: 'error', message: m });
                        },
                    });
                }}
            >
                Você realmente deseja sair da empresa? Todos os administradores serão notificados.
            </ConfirmModal>
            <ConfirmModal
                open={!!removeMemberConfirm}
                title="Remover membro?"
                onCancel={() => setRemoveMemberConfirm(null)}
                onConfirm={() => {
                    if (removeMemberConfirm) {
                        removeMemberMutation.mutate(removeMemberConfirm.userId, {
                            onSuccess: () => {
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
                    }
                }}
            >
                Tem certeza que deseja remover este membro da empresa? Esta ação não pode ser desfeita.
            </ConfirmModal>
            <ConfirmModal
                open={showDeleteCompanyModal}
                title="Excluir empresa?"
                onCancel={() => setShowDeleteCompanyModal(false)}
                onConfirm={() => {
                    deleteCompanyMutation.mutate(id, {
                        onSuccess: () => {
                            setShowDeleteCompanyModal(false);
                            show({ type: 'success', message: 'Empresa excluída' });
                            window.location.href = '/dashboard';
                        },
                        onError: (err: any) => {
                            const m = getErrorMessage(err, 'Falha ao excluir empresa');
                            setError(m);
                            show({ type: 'error', message: m });
                        },
                    });
                }}
            >
                Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita e removerá todos os dados relacionados a ela.
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
                        transferOwnershipMutation.mutate(transferToUserId, {
                            onSuccess: () => {
                                show({ type: 'success', message: 'Propriedade transferida com sucesso' });
                                setShowTransferModal(false);
                                setTransferToUserId('');
                            },
                            onError: (err: any) => {
                                const m = getErrorMessage(err, 'Falha ao transferir propriedade');
                                setError(m);
                                show({ type: 'error', message: m });
                            },
                        });
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
                            {(() => {
                                const isPrimaryOwner = primaryOwnerQuery.data?.primaryOwnerUserId === profileQuery.data?.id;
                                const members = (membersQuery.data?.members || [])
                                    .filter((m: Member) => {
                                        if (m.userId === profileQuery.data?.id) return false;
                                        if (isPrimaryOwner) {
                                            return m.role === 'OWNER' || m.role === 'ADMIN';
                                        }
                                        return m.role !== 'OWNER';
                                    });
                                
                                const roleTranslations: Record<string, string> = {
                                    'OWNER': 'PROPRIETÁRIO',
                                    'ADMIN': 'ADMINISTRADOR',
                                    'MEMBER': 'MEMBRO'
                                };
                                
                                return members.map((m: Member) => (
                                    <option key={m.userId} value={m.userId}>
                                        {m.name || 'Desconhecido'} ({m.email || m.userId}) - {roleTranslations[m.role] || m.role}
                                    </option>
                                ));
                            })()}
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            {primaryOwnerQuery.data?.primaryOwnerUserId === profileQuery.data?.id
                                ? 'Você pode transferir a propriedade para outros PROPRIETÁRIOS ou ADMINISTRADORES. Você se tornará um ADMINISTRADOR após transferir a propriedade.'
                                : 'Você se tornará um ADMINISTRADOR após transferir a propriedade.'}
                        </p>
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
                    
                    const isCurrentUser = selectedMember.userId === profileQuery.data?.id;
                    const currentUserRole = roleQuery.data?.role;
                    const isAdmin = currentUserRole === 'ADMIN' || currentUserRole === 'OWNER';
                    const isFriend = friends.some(f => 
                        (f.requester?.id === selectedMember.userId || f.addressee?.id === selectedMember.userId)
                    );
                    const canSendMessage = !isCurrentUser && (isAdmin || (currentUserRole === 'MEMBER' && isFriend));

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
                                                    className="px-4 py-2 bg-gray-900 dark:bg-white
                                                    text-white dark:text-gray-900 rounded-lg
                                                    hover:bg-gray-800 dark:hover:bg-gray-200
                                                    disabled:opacity-50 disabled:cursor-not-allowed
                                                    transition-colors font-medium text-sm flex items-center gap-2"
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
                                            className="w-full px-4 py-2 border
                                            ]border-red-200 dark:border-red-800 rounded-lg
                                             bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                              dark:hover:bg-red-900/20 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                                        >
                                            <FiTrash2 className="text-base" />
                                            Remover Membro
                                        </button>
                                    )}
                                </div>
                            )}
                            {canSendMessage && (
                                <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
                                    <button
                                        onClick={() => {
                                            setMemberMessageTitle('');
                                            setMemberMessageBody('');
                                            setShowMemberMessageModal(true);
                                        }}
                                        className="w-full px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                                    >
                                        <FiSend className="text-base" />
                                        Enviar Mensagem
                                    </button>
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
                        removeMemberMutation.mutate(actionMember.userId, {
                            onSuccess: () => {
                                setShowMemberModal(false);
                                setSelectedMember(null);
                                show({ type: 'success', message: 'Membro removido com sucesso' });
                            },
                            onError: (err: any) => {
                                const m = getErrorMessage(err, 'Não foi possível remover membro');
                                show({ type: 'error', message: m });
                            },
                        });
                    } else if (actionType === 'changeRole' && actionMember && newRole) {
                        changeRoleMutation.mutate({ userId: actionMember.userId, role: newRole as any }, {
                            onSuccess: () => {
                                show({ type: 'success', message: 'Papel atualizado' });
                                setShowMemberModal(false);
                                setSelectedMember(null);
                                setNewRole('');
                            },
                            onError: (err: any) => {
                                const m = getErrorMessage(err, 'Não foi possível atualizar papel');
                                show({ type: 'error', message: m });
                            },
                        });
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
                    `Tem certeza que deseja alterar o papel de ${actionMember.name || 'este membro'} 
                    para ${newRole === 'OWNER' ? 'PROPRIETÁRIO' : newRole === 'ADMIN' ? 'ADMINISTRADOR' : 'MEMBRO'}?`
                    ) : null}
            </ConfirmModal>
            <Modal
                open={showMemberMessageModal}
                title={`Enviar Mensagem para ${selectedMember?.name || 'Membro'}`}
                onClose={() => {
                    setShowMemberMessageModal(false);
                    setMemberMessageTitle('');
                    setMemberMessageBody('');
                }}
            >
                <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                        e.preventDefault();
                        if (!selectedMember?.email) {
                            show({ type: 'error', message: 'Email do membro não disponível' });
                            return;
                        }
                        try {
                            await sendFriendMessageMutation.mutateAsync({
                                friendEmail: selectedMember.email,
                                title: memberMessageTitle.trim(),
                                body: memberMessageBody.trim(),
                            });
                            show({ type: 'success', message: 'Mensagem enviada com sucesso' });
                            setShowMemberMessageModal(false);
                            setMemberMessageTitle('');
                            setMemberMessageBody('');
                        } catch (err: any) {
                            const m = getErrorMessage(err, 'Falha ao enviar mensagem');
                            show({ type: 'error', message: m });
                        }
                    }}
                >
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Assunto
                        </label>
                        <input
                            type="text"
                            value={memberMessageTitle}
                            onChange={(e) => setMemberMessageTitle(e.target.value)}
                            placeholder="Assunto da mensagem"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Mensagem
                        </label>
                        <textarea
                            value={memberMessageBody}
                            onChange={(e) => setMemberMessageBody(e.target.value)}
                            placeholder="Digite sua mensagem"
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none transition-colors"
                            rows={4}
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setShowMemberMessageModal(false);
                                setMemberMessageTitle('');
                                setMemberMessageBody('');
                            }}
                            className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={sendFriendMessageMutation.isPending || !memberMessageTitle.trim() || !memberMessageBody.trim()}
                            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors flex items-center gap-2"
                        >
                            <FiSend className="text-base" />
                            {sendFriendMessageMutation.isPending ? 'Enviando...' : 'Enviar Mensagem'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
"use client";
import React, { useState, useEffect } from 'react';
import { getErrorMessage } from '../../lib/error';
import { useToast } from '../../hooks/useToast';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { Modal } from '../../components/modals/Modal';
import {
    useProfile,
    usePrimaryOwnerCompanies,
    useMemberCompanies,
    useUpdateProfile,
    useDeleteAccount,
    type PrimaryOwnerCompany,
    type MemberCompany,
} from '../../services/api/auth.api';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import {FaExclamationTriangle} from "react-icons/fa";
import {MdBusiness, MdPerson, MdMail, MdPersonAdd, MdPersonRemove, MdRefresh, MdNotifications, MdNotificationsActive, MdBadge} from "react-icons/md";
import { formatDate, formatDateOnly } from '../../lib/date-utils';
import { translateMemberCompaniesMessage, translateRole } from '../../lib/messages';
import Link from 'next/link';
import { DEFAULT_COMPANY_LOGO } from '../../types';

export default function ProfilePage() {

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPrimaryOwnerModal, setShowPrimaryOwnerModal] = useState(false);
    const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
    const [primaryOwnerPage, setPrimaryOwnerPage] = useState(1);
    const [memberCompaniesPage, setMemberCompaniesPage] = useState(1);
    const [activeCompanyTab, setActiveCompanyTab] = useState<'owner' | 'member'>('owner');
    const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');
    const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});
    const { show } = useToast();
    const { preferences: notificationPreferences, derived: notificationDerived } = useNotificationPreferences();
    const qc = useQueryClient();

    const profileQuery = useProfile();
    const pageSize = 10;
    const primaryOwnerCompaniesQuery = usePrimaryOwnerCompanies(primaryOwnerPage, pageSize, showPrimaryOwnerModal);
    const memberCompaniesQuery = useMemberCompanies(memberCompaniesPage, pageSize, showPrimaryOwnerModal);
    const updateProfileMutation = useUpdateProfile();
    const deleteAccountMutation = useDeleteAccount();

    async function handleDeleteAccountClick() {
                setPrimaryOwnerPage(1);
                setShowPrimaryOwnerModal(true);
    }

    function handleDeleteAccount() {
        deleteAccountMutation.mutate(undefined, {
            onSuccess: () => {
            setShowDeleteModal(false);
            setShowPrimaryOwnerModal(false);
                setShowFinalConfirmModal(false);
                show({ type: 'success', message: 'Conta excluída permanentemente. Todas as empresas e dados foram removidos.' });
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
            },
            onError: (err: any) => {
            const m = getErrorMessage(err, 'Falha ao excluir conta');
            setError(m);
            show({ type: 'error', message: m });
                setShowFinalConfirmModal(false);
                setShowPrimaryOwnerModal(true);
            },
        });
    }

    useEffect(() => {
        if (showPrimaryOwnerModal) {
            if (activeCompanyTab === 'owner') {
            primaryOwnerCompaniesQuery.refetch();
            } else {
                memberCompaniesQuery.refetch();
            }
        }
    }, [primaryOwnerPage, memberCompaniesPage, showPrimaryOwnerModal, activeCompanyTab]);

    const currentName = profileQuery.data?.name ?? '';
    const currentEmail = profileQuery.data?.email ?? '';

    const updateNotificationPreference = (key: string, value: boolean) => {
        const newPrefs = { ...notificationPreferences, [key]: value };
        updateProfileMutation.mutate({ notificationPreferences: newPrefs }, {
            onSuccess: () => {
                show({ type: 'success', message: 'Preferências de notificação atualizadas com sucesso' });
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Falha ao atualizar preferências de notificação');
                show({ type: 'error', message: m });
            },
        });
    };

    const updateMultipleNotificationPreferences = (updates: Record<string, boolean>) => {
        const newPrefs = { ...notificationPreferences, ...updates };
        updateProfileMutation.mutate({ notificationPreferences: newPrefs }, {
            onSuccess: () => {
                show({ type: 'success', message: 'Preferências de notificação atualizadas com sucesso' });
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Falha ao atualizar preferências de notificação');
                show({ type: 'error', message: m });
            },
        });
    };

    useEffect(() => {
        if (showPrimaryOwnerModal) {
            console.log('Primary Owner Companies Query State:', {
                isLoading: primaryOwnerCompaniesQuery.isLoading,
                isError: primaryOwnerCompaniesQuery.isError,
                error: primaryOwnerCompaniesQuery.error,
                data: primaryOwnerCompaniesQuery.data,
                enabled: showPrimaryOwnerModal,
            });
        }
    }, [showPrimaryOwnerModal, primaryOwnerCompaniesQuery.isLoading, primaryOwnerCompaniesQuery.isError, primaryOwnerCompaniesQuery.data]);

    const loading = updateProfileMutation.isPending || profileQuery.isLoading;

    return (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Meu Perfil</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas informações e preferências</p>
            </div>
            <div className="border-b border-gray-200 dark:border-gray-800">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'profile'
                                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab('privacy')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                            activeTab === 'privacy'
                                ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                    >
                        Privacidade
                    </button>
                </nav>
            </div>

            {activeTab === 'profile' && (
                <>
                    <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Nome atual</label>
                                <input value={profileQuery.isLoading ? '...' : currentName} readOnly className="w-full px-4
                                py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950
                                text-gray-600 dark:text-gray-400 cursor-not-allowed" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email atual</label>
                                <input value={profileQuery.isLoading ? '...' : currentEmail} readOnly className="w-full px-4 py-3
                                 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-950 text-gray-600
                                 dark:text-gray-400 cursor-not-allowed" />
                            </div>
                        </div>
                        {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800
                        rounded-lg text-green-700 dark:text-green-400 text-center">{message}</div>}
                        {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800
                        rounded-lg text-red-700 dark:text-red-400 text-center" data-testid="profile-error">{error}</div>}
                        <form className="space-y-4" onSubmit={async e => {
                            e.preventDefault();
                            setError(null);
                            setMessage(null);
                            const payload: any = {};
                            if (name) payload.name = name;
                            if (email) payload.email = email;
                            if (newPassword) {
                                payload.currentPassword = currentPassword;
                                payload.newPassword = newPassword;
                            }
                            updateProfileMutation.mutate(payload, {
                                onSuccess: () => {
                                    setMessage('Perfil atualizado com sucesso');
                                    show({ type: 'success', message: 'Perfil atualizado com sucesso' });
                                    setError(null);
                                },
                                onError: (err: any) => {
                                    const m = getErrorMessage(err, 'Falha ao atualizar perfil');
                                    setError(m);
                                    show({ type: 'error', message: m });
                                },
                            });
                        }}>
                            <div>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="Novo nome"
                                       className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-
                                       lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                                       dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                                        dark:focus:ring-white focus:border-transparent transition-colors"/>
                            </div>
                            <div>
                                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Novo email"
                                       className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                                       rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                       placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2
                                       focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"/>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                       placeholder="Senha atual"
                                       className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
                                       rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                                       dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                                       dark:focus:ring-white focus:border-transparent transition-colors"/>
                                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                       placeholder="Nova senha" className="w-full px-4 py-3 border border-gray-200
                                        dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900
                                        dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2
                                        focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"/>
                            </div>
                            <button disabled={loading}
                                    className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900
                                     rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50
                                     disabled:cursor-not-allowed font-medium transition-colors">
                                {loading ? 'Salvando...' : 'Salvar alterações'}</button>
                        </form>

                            <div className="mt-4 flex justify-center sm:justify-start">
                                <button className="w-full px-4 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700
                                dark:hover:bg-red-600 transition-colors font-medium" onClick={handleDeleteAccountClick}>
                                    Excluir permanentemente
                                </button>
                            </div>
                    </div>
                    <ConfirmModal
                        open={showDeleteModal}
                        title="Tem certeza que deseja excluir permanentemente sua conta?"
                        onCancel={() => {
                            setShowDeleteModal(false);
                                setShowPrimaryOwnerModal(true);
                        }}
                        onConfirm={handleDeleteAccount}
                    >
                            <div>
                                <p className="mb-2">Você está prestes a excluir:</p>
                                <ul className="list-disc list-inside mb-2">
                                <li>Todas as empresas onde você é o owner principal</li>
                                    <li>Sua conta e todos os dados associados</li>
                                <li>Todas as notificações, amizades e convites</li>
                                </ul>
                                <p className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</p>
                            </div>
                    </ConfirmModal>
                    <Modal
                        open={showPrimaryOwnerModal}
                        title="Excluir Conta Permanentemente"
                        onClose={() => {
                            setShowPrimaryOwnerModal(false);
                            setActiveCompanyTab('owner');
                            setPrimaryOwnerPage(1);
                            setMemberCompaniesPage(1);
                        }}
                    >
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 mb-4">
                                <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold mb-2 flex items-center gap-2">
                                    <span className="text-lg text-blue-600 dark:text-blue-400">
                                      <FaExclamationTriangle />
                                    </span>
                                    Empresas Associadas
                                </p>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    Ao excluir sua conta, todas as empresas onde você é owner principal serão excluídas permanentemente. 
                                    Você será removido de todas as empresas onde participa como ADMIN ou MEMBER.
                                </p>
                            </div>

                            <div className="border-b border-gray-200 dark:border-gray-800">
                                <nav className="-mb-px flex space-x-4">
                                    <button
                                        onClick={() => {
                                            setActiveCompanyTab('owner');
                                            setPrimaryOwnerPage(1);
                                        }}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                            activeCompanyTab === 'owner'
                                                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Proprietário
                                        {primaryOwnerCompaniesQuery.data && primaryOwnerCompaniesQuery.data.total > 0 && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                {primaryOwnerCompaniesQuery.data.total}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setActiveCompanyTab('member');
                                            setMemberCompaniesPage(1);
                                        }}
                                        className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                                            activeCompanyTab === 'member'
                                                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                        }`}
                                    >
                                        Participa
                                        {memberCompaniesQuery.data && memberCompaniesQuery.data.total > 0 && (
                                            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                                                {memberCompaniesQuery.data.total}
                                            </span>
                                        )}
                                    </button>
                                </nav>
                            </div>

                            {activeCompanyTab === 'owner' && (
                                <>
                            {primaryOwnerCompaniesQuery.isLoading ? (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Carregando empresas...</p>
                                    ) : primaryOwnerCompaniesQuery.error ? (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                                    <p className="text-sm text-red-800 dark:text-red-200">
                                        Erro ao carregar empresas: {primaryOwnerCompaniesQuery.error instanceof Error ? primaryOwnerCompaniesQuery.error.message :
                                        'Erro desconhecido'}
                                    </p>
                                </div>
                            ) : primaryOwnerCompaniesQuery.data && primaryOwnerCompaniesQuery.data.data?.length > 0 ? (
                                <>
                                    <div className="max-h-96 overflow-y-auto border rounded-lg divide-y divide-gray-200 dark:divide-gray-800">
                                        {primaryOwnerCompaniesQuery.data.data.map((company: PrimaryOwnerCompany) => (
                                            <div key={company.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                <div className="flex items-start gap-3">
                                                    <img 
                                                        src={logoErrors[company.id] || !company.logoUrl ? DEFAULT_COMPANY_LOGO : company.logoUrl} 
                                                        alt={`Logo ${company.name}`}
                                                        className="h-16 w-16 rounded object-cover flex-shrink-0"
                                                        onError={() => setLogoErrors(prev => ({ ...prev, [company.id]: true }))}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2 mb-2">
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1">
                                                                    {company.name}
                                                                </h3>
                                                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                                    <span className="font-mono">ID: {company.id}</span>
                                                                    <span className="flex items-center gap-1">
                                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                            company.isPublic 
                                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                                                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                                        }`}>
                                                                            {company.isPublic ? 'Pública' : 'Privada'}
                                                                        </span>
                                                                    </span>
                                                                    <span>{company.memberCount || 0} membro(s)</span>
                                                                    <span>Criada em: {formatDate(company.createdAt)}</span>
                                                                </div>
                                                            </div>
                                                            <Link
                                                                href={`/company/${company.id}`}
                                                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300
                                                                text-sm font-medium whitespace-nowrap"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                Acessar →
                                                            </Link>
                                                        </div>
                                                        
                                                    {company.description && (
                                                            <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                                                                <span className="font-medium text-xs text-gray-500 dark:text-gray-400">Descrição: </span>
                                                                {company.description}
                                                            </div>
                                                        )}
                                                        
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                            <div><strong>Informações:</strong></div>
                                                            <div>• Tipo: {company.isPublic ? 'Empresa Pública' : 'Empresa Privada'}</div>
                                                            <div>• Total de membros: {company.memberCount || 0}</div>
                                                            <div>• Data de criação: {formatDateOnly(company.createdAt)}</div>
                                                            <div>• Dono Principal: {company.primaryOwnerName} ({company.primaryOwnerEmail})</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {primaryOwnerCompaniesQuery.data && primaryOwnerCompaniesQuery.data.total > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                                Mostrando {primaryOwnerCompaniesQuery.data.data.length} de {primaryOwnerCompaniesQuery.data.total} empresa(s)
                                            </div>
                                            {primaryOwnerCompaniesQuery.data.total > pageSize && (
                                                <div className="flex items-center justify-center gap-2 text-sm">
                                            <button
                                                onClick={() => {
                                                    const newPage = Math.max(1, primaryOwnerPage - 1);
                                                    setPrimaryOwnerPage(newPage);
                                                }}
                                                        disabled={primaryOwnerPage === 1 || primaryOwnerCompaniesQuery.isLoading}
                                                        className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50
                                                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                        ← Anterior
                                            </button>
                                                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                                                        Página {primaryOwnerPage} de {Math.ceil(primaryOwnerCompaniesQuery.data.total / pageSize)}
                                                    </span>
                                            <button
                                                onClick={() => {
                                                    const newPage = primaryOwnerPage + 1;
                                                    setPrimaryOwnerPage(newPage);
                                                }}
                                                        disabled={!primaryOwnerCompaniesQuery.data ||
                                                            primaryOwnerPage >= Math.ceil(primaryOwnerCompaniesQuery.data.total / pageSize) ||
                                                            primaryOwnerCompaniesQuery.isLoading}
                                                        className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50
                                                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                        Próxima →
                                            </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                            Você não é owner principal de nenhuma empresa.
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500">
                                            Ao excluir sua conta, você será removido de todas as empresas onde participa.
                                        </p>
                                    </div>
                                </div>
                            )}
                                </>
                            )}

                            {activeCompanyTab === 'member' && (
                                <>
                                    {memberCompaniesQuery.isLoading ? (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Carregando empresas...</p>
                                    ) : memberCompaniesQuery.error ? (
                                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3">
                                            <p className="text-sm text-red-800 dark:text-red-200">
                                                Erro ao carregar empresas: {memberCompaniesQuery.error instanceof Error ?
                                                memberCompaniesQuery.error.message : 'Erro desconhecido'}
                                            </p>
                                        </div>
                                    ) : memberCompaniesQuery.data && memberCompaniesQuery.data.data?.length > 0 ? (
                                        <>
                                            <div className="max-h-96 overflow-y-auto border rounded-lg divide-y divide-gray-200 dark:divide-gray-800">
                                                {memberCompaniesQuery.data.data.map((company: MemberCompany) => (
                                                    <div key={company.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                                                        <div className="flex items-start gap-3">
                                                            <img 
                                                                src={logoErrors[company.id] || !company.logoUrl ? DEFAULT_COMPANY_LOGO : company.logoUrl} 
                                                                alt={`Logo ${company.name}`}
                                                                className="h-16 w-16 rounded object-cover flex-shrink-0"
                                                                onError={() => setLogoErrors(prev => ({ ...prev, [company.id]: true }))}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1">
                                                                            {company.name}
                                                                        </h3>
                                                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                                            <span className="font-mono">ID: {company.id}</span>
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                                company.userRole === 'ADMIN' 
                                                                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                                                            }`}>
                                                                                {company.userRole === 'ADMIN' ? 'ADMIN' : 'MEMBER'}
                                                                            </span>
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                                company.isPublic 
                                                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                                                                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                                                            }`}>
                                                                                {company.isPublic ? 'Pública' : 'Privada'}
                                                                            </span>
                                                                            <span>{company.memberCount || 0} membro(s)</span>
                                                                            <span>Criada em: {formatDate(company.createdAt)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <Link
                                                                        href={`/company/${company.id}`}
                                                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm
                                                                        font-medium whitespace-nowrap"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        Acessar →
                                                                    </Link>
                                                                </div>
                                                                
                                                                {company.description && (
                                                                    <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded">
                                                                        <span className="font-medium text-xs text-gray-500 dark:text-gray-400">Descrição: </span>
                                                                        {company.description}
                                                                    </div>
                                                                )}
                                                                
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                                    <div><strong>Informações:</strong></div>
                                                                    <div>• Seu papel: {company.userRole === 'ADMIN' ? 'Administrador' : 'Membro'}</div>
                                                                    <div>• Tipo: {company.isPublic ? 'Empresa Pública' : 'Empresa Privada'}</div>
                                                                    <div>• Total de membros: {company.memberCount || 0}</div>
                                                                    <div>• Data de criação: {formatDateOnly(company.createdAt)}</div>
                                                                    <div>• Dono Principal: {company.primaryOwnerName} ({company.primaryOwnerEmail})</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {memberCompaniesQuery.data && memberCompaniesQuery.data.total > 0 && (
                                                <div className="space-y-2">
                                                    <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                                                        Mostrando {memberCompaniesQuery.data.data.length} de {memberCompaniesQuery.data.total} empresa(s)
                                                    </div>
                                                    {memberCompaniesQuery.data.total > pageSize && (
                                                        <div className="flex items-center justify-center gap-2 text-sm">
                                                            <button
                                                                onClick={() => {
                                                                    const newPage = Math.max(1, memberCompaniesPage - 1);
                                                                    setMemberCompaniesPage(newPage);
                                                                }}
                                                                disabled={memberCompaniesPage === 1 || memberCompaniesQuery.isLoading}
                                                                className="px-3 py-1 border border-gray-300 dark:border-gray-700
                                                                 rounded hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50
                                                                 disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                ← Anterior
                                        </button>
                                                            <span className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                                                                Página {memberCompaniesPage} de {Math.ceil(memberCompaniesQuery.data.total / pageSize)}
                                                            </span>
                                        <button
                                                                onClick={() => {
                                                                    const newPage = memberCompaniesPage + 1;
                                                                    setMemberCompaniesPage(newPage);
                                                                }}
                                                                disabled={!memberCompaniesQuery.data || memberCompaniesPage >=
                                                                    Math.ceil(memberCompaniesQuery.data.total / pageSize) || memberCompaniesQuery.isLoading}
                                                                className="px-3 py-1 border border-gray-300 dark:border-gray-700
                                                                rounded hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50
                                                                disabled:cursor-not-allowed transition-colors"
                                                            >
                                                                Próxima →
                                        </button>
                                    </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                    {translateMemberCompaniesMessage()}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                                    Você não será removido de nenhuma empresa ao excluir sua conta.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeCompanyTab === 'owner' &&
                             !primaryOwnerCompaniesQuery.isLoading && 
                             !primaryOwnerCompaniesQuery.error &&
                             primaryOwnerCompaniesQuery.data && 
                             primaryOwnerCompaniesQuery.data.total === 0 &&
                             (!memberCompaniesQuery.data || memberCompaniesQuery.data.total === 0) && (
                                <div className="text-center py-8">
                                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                                        <p className="text-sm text-green-800 dark:text-green-200 font-semibold mb-2">
                                            ✓ Você não possui empresas associadas
                                        </p>
                                        <p className="text-xs text-green-700 dark:text-green-300">
                                            Ao excluir sua conta, apenas seus dados pessoais serão removidos. 
                                            Nenhuma empresa será afetada.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                                        <button
                                            onClick={() => {
                                                setShowPrimaryOwnerModal(false);
                                        setActiveCompanyTab('owner');
                                        setPrimaryOwnerPage(1);
                                        setMemberCompaniesPage(1);
                                            }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => {
                                        setShowFinalConfirmModal(true);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Sim, tenho certeza. Excluir permanentemente
                                        </button>
                                    </div>
                        </div>
                    </Modal>

                    <Modal
                        open={showFinalConfirmModal}
                        title="Confirmação Final - Exclusão Permanente"
                        onClose={() => {
                            setShowFinalConfirmModal(false);
                        }}
                    >
                        <div className="space-y-4">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
                                <p className="text-sm text-red-800 dark:text-red-200 font-semibold mb-2 flex items-center gap-2">
                                    <span className="text-lg text-red-600 dark:text-red-400">
                                        <FaExclamationTriangle />
                                    </span>
                                    ATENÇÃO: Esta ação é PERMANENTE e IRREVERSÍVEL
                                </p>
                                <p className="text-sm text-red-700 dark:text-red-300">
                                    Ao confirmar, você está ciente de que:
                                </p>
                            </div>

                            <div className="space-y-3">
                                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded p-3">
                                    <h4 className="font-semibold text-sm mb-2 text-gray-900 dark:text-white">O que será excluído:</h4>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                                        {primaryOwnerCompaniesQuery.data && primaryOwnerCompaniesQuery.data.total > 0 && (
                                            <li>
                                                <strong>{primaryOwnerCompaniesQuery.data.total} empresa(s)</strong>
                                                onde você é owner principal serão excluídas permanentemente
                                            </li>
                                        )}
                                        <li>
                                            <strong>Sua conta</strong>
                                            e todos os dados pessoais serão excluídos permanentemente
                                        </li>
                                        <li>
                                            Você será <strong>removido automaticamente</strong>
                                            de todas as empresas onde é <strong>{translateRole('ADMIN')}</strong> ou <strong>{translateRole('MEMBER')}</strong>
                                        </li>
                                        <li>
                                            Todos os <strong>convites</strong> enviados e recebidos serão cancelados
                                        </li>
                                        <li>
                                            Todas as <strong>notificações</strong> e histórico serão perdidos
                                        </li>
                                        <li>
                                            Todas as <strong>amizades</strong> serão removidas
                                        </li>
                                    </ul>
                                </div>

                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-1">
                                        Regras importantes:
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 text-xs text-yellow-700 dark:text-yellow-300">
                                        <li>Esta ação <strong>NÃO PODE</strong> ser desfeita</li>
                                        <li>Não há como recuperar seus dados após a exclusão</li>
                                        <li>As empresas excluídas não poderão ser restauradas</li>
                                        <li>Outros membros das empresas serão notificados sobre a exclusão</li>
                                    </ul>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded p-3">
                                    <p className="text-sm text-gray-700 dark:text-gray-300">
                                        <strong>Tem certeza absoluta</strong> que deseja prosseguir com a exclusão permanente da sua conta?
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => {
                                        setShowFinalConfirmModal(false);
                                    }}
                                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50
                                    dark:hover:bg-gray-900 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={async () => {
                                        setShowFinalConfirmModal(false);
                                        await handleDeleteAccount();
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700
                                    transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={deleteAccountMutation.isPending}
                                >
                                    {deleteAccountMutation.isPending ? 'Excluindo...' : 'Sim, tenho certeza. Excluir permanentemente'}
                                </button>
                            </div>
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'privacy' && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold dark:text-white">Preferências de Notificações</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Controle quais notificações você recebe do sistema.
                    </p>

                    <div className="space-y-4 border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
                        <div className="border-b border-gray-200 dark:border-gray-800 pb-4 mb-4">
                            <h3 className="text-md font-semibold dark:text-white mb-2 flex items-center gap-2">
                                <MdNotificationsActive className="text-xl text-blue-600 dark:text-blue-400" />
                                Configuração de Notificações em Tempo Real
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Habilite a opção para receber notificações imediatas via WebSocket.
                                Ao ativar, todas as categorias selecionadas passam a enviar alertas em tempo real.
                            </p>
                            
                            <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                <div className="flex-shrink-0 mt-1">
                                    <MdNotificationsActive className="text-xl text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                                Ativar Notificações em Tempo Real
                                            </label>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                Receber notificações imediatas via WebSocket para todas as categorias selecionadas
                                            </p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={notificationDerived.realtimeEnabled}
                                            onChange={(e) => updateNotificationPreference('realtimeEnabled', e.target.checked)}
                                            className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {notificationDerived.realtimeEnabled && (
                                <div className="mt-4 space-y-3">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Escolha como deseja visualizar as notificações em tempo real:
                                    </p>
                                    
                                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50
                                    dark:hover:bg-gray-800/50 transition-colors border border-gray-200 dark:border-gray-700">
                                        <div className="flex-shrink-0 mt-1">
                                            <MdNotifications className="text-xl text-purple-600 dark:text-purple-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                                        Popup Instantâneo
                                                    </label>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Um pequeno popup aparece no canto inferior direito sempre que chega uma notificação. Some automaticamente após alguns segundos.
                                                    </p>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="realtimeDisplay"
                                                    checked={notificationDerived.realtimePopups && !notificationDerived.realtimeIconBadge}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            updateMultipleNotificationPreferences({ realtimePopups: true, realtimeIconBadge: false });
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-purple-600 border-gray-300 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50
                                    dark:hover:bg-gray-800/50 transition-colors border border-gray-200 dark:border-gray-700">
                                        <div className="flex-shrink-0 mt-1">
                                            <MdBadge className="text-xl text-green-600 dark:text-green-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                                        Ícone Fixo com Contador
                                                    </label>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        Um ícone de notificação permanece visível no canto superior direito da página com um contador de novas notificações.
                                                    </p>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="realtimeDisplay"
                                                    checked={notificationDerived.realtimeIconBadge}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            updateMultipleNotificationPreferences({ realtimePopups: false, realtimeIconBadge: true });
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-green-600 border-gray-300 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50
                                    dark:hover:bg-gray-800/50 transition-colors border border-gray-200 dark:border-gray-700">
                                        <div className="flex-shrink-0 mt-1">
                                            <MdNotifications className="text-xl text-gray-600 dark:text-gray-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1">
                                                    <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                                        Nenhuma Exibição Especial
                                                    </label>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                        As notificações continuam sendo recebidas em tempo real
                                                        via WebSocket, mas não aparece popup nem ícone. Acesse a página Notificações para visualizar.
                                                    </p>
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="realtimeDisplay"
                                                    checked={!notificationDerived.realtimePopups && !notificationDerived.realtimeIconBadge}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            updateMultipleNotificationPreferences({ realtimePopups: false, realtimeIconBadge: false });
                                                        }
                                                    }}
                                                    className="w-5 h-5 text-gray-600 border-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:border-gray-600"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                            <h3 className="text-md font-semibold dark:text-white mb-4">Categorias de Notificações</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                Quando a opção de Notificações em Tempo Real estiver ativa, as seguintes categorias passam a ser monitoradas:
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3 border border-gray-200 dark:border-gray-800 rounded-lg p-4 bg-white dark:bg-gray-900">
                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <MdBusiness className="text-xl text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                            Convites de Empresa
                                        </label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Receber notificações quando você for convidado a entrar em uma empresa
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notificationDerived.companyInvitations}
                                        onChange={(e) => updateNotificationPreference('companyInvitations', e.target.checked)}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <MdPerson className="text-xl text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                            Solicitações de Amizade
                                        </label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Receber notificações quando alguém enviar uma solicitação de amizade
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notificationDerived.friendRequests}
                                        onChange={(e) => updateNotificationPreference('friendRequests', e.target.checked)}
                                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <MdMail className="text-xl text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                            Mensagens da Empresa
                                        </label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Receber notificações para mensagens enviadas dentro de suas empresas
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notificationDerived.companyMessages}
                                        onChange={(e) => updateNotificationPreference('companyMessages', e.target.checked)}
                                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <MdPersonAdd className="text-xl text-orange-600 dark:text-orange-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                            Mudanças de Membros
                                        </label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Receber notificações quando membros forem adicionados ou removidos das empresas
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notificationDerived.membershipChanges}
                                        onChange={(e) => updateNotificationPreference('membershipChanges', e.target.checked)}
                                        className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <div className="flex-shrink-0 mt-1">
                                <MdRefresh className="text-xl text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1">
                                        <label className="font-medium text-gray-900 dark:text-white block mb-1">
                                            Mudanças de Cargo
                                        </label>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Receber notificações quando seu cargo em uma empresa mudar
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={notificationDerived.roleChanges}
                                        onChange={(e) => updateNotificationPreference('roleChanges', e.target.checked)}
                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* {updateProfileMutation.isPending && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Salvando preferências...</p>
                    )} */}
                </div>
            )}
        </div>
    );
}

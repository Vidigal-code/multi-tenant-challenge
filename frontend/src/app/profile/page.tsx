"use client";
import React, { useMemo, useState, useEffect } from 'react';
import { http } from '../../lib/http';
import { getErrorMessage } from '../../lib/error';
import { useToast } from '../../hooks/useToast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal } from '../../components/Modal';

export default function ProfilePage() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPrimaryOwnerModal, setShowPrimaryOwnerModal] = useState(false);
    const [selectedCompaniesToDelete, setSelectedCompaniesToDelete] = useState<string[]>([]);
    const [primaryOwnerPage, setPrimaryOwnerPage] = useState(1);
    const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');
    const [notificationPreferences, setNotificationPreferences] = useState<Record<string, boolean>>({});
    const { show } = useToast();
    const qc = useQueryClient();

    async function handleDeleteAccountClick() {
        try {
            const { data } = await http.get('/auth/account/primary-owner-companies', {
                params: { page: 1, pageSize: 10 },
            });
            
            if (data.total > 0) {
                setPrimaryOwnerPage(1);
                setSelectedCompaniesToDelete([]);
                setShowPrimaryOwnerModal(true);
            } else {
                setShowDeleteModal(true);
            }
        } catch (err: any) {
            setShowDeleteModal(true);
        }
    }

    async function handleDeleteAccount() {
        try {
            const deleteCompanyIds = selectedCompaniesToDelete.length > 0 
                ? selectedCompaniesToDelete 
                : undefined;
            
            const config: any = {};
            if (deleteCompanyIds && deleteCompanyIds.length > 0) {
                config.data = { deleteCompanyIds };
            }
            
            await http.delete('/auth/account', config);
            
            setShowDeleteModal(false);
            setShowPrimaryOwnerModal(false);
            show({ type: 'success', message: 'Conta excluída permanentemente' });
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } catch (err: any) {
            const m = getErrorMessage(err, 'Falha ao excluir conta');
            setError(m);
            show({ type: 'error', message: m });
            if (selectedCompaniesToDelete.length > 0) {
                setShowPrimaryOwnerModal(true);
            }
        }
    }

    const profileQuery = useQuery({
        queryKey: [queryKeys.profile()],
        queryFn: async () => {
            const { data } = await http.get('/auth/profile');
            return data;
        },
        staleTime: 30_000,
    });

    const primaryOwnerCompaniesQuery = useQuery({
        queryKey: ['primary-owner-companies', primaryOwnerPage],
        queryFn: async () => {
            const { data } = await http.get('/auth/account/primary-owner-companies', {
                params: { page: primaryOwnerPage, pageSize: 10 },
            });
            return data;
        },
        enabled: showPrimaryOwnerModal,
    });

    useEffect(() => {
        if (showPrimaryOwnerModal && primaryOwnerPage && !primaryOwnerCompaniesQuery.isFetching) {
            primaryOwnerCompaniesQuery.refetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [primaryOwnerPage, showPrimaryOwnerModal]);

    const currentName = profileQuery.data?.name ?? '';
    const currentEmail = profileQuery.data?.email ?? '';

    useEffect(() => {
        if (profileQuery.data?.notificationPreferences) {
            setNotificationPreferences(profileQuery.data.notificationPreferences);
        }
    }, [profileQuery.data]);

    // Email completo sem máscara

    const updateMutation = useMutation({
        mutationFn: async () => {
            const payload: any = {};
            if (name) payload.name = name;
            if (email) payload.email = email;
            if (newPassword) {
                payload.currentPassword = currentPassword;
                payload.newPassword = newPassword;
            }
            const { data } = await http.post('/auth/profile', payload);
            return data;
        },
        onSuccess: async () => {
            setMessage('Profile updated successfully');
            show({ type: 'success', message: 'Profile updated successfully' });
            setError(null);
            await qc.invalidateQueries({ queryKey: [queryKeys.profile()] });
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Failed to update profile');
            setError(m);
            show({ type: 'error', message: m });
        }
    });

    const updatePreferencesMutation = useMutation({
        mutationFn: async (prefs: Record<string, boolean>) => {
            const { data } = await http.post('/auth/profile', {
                notificationPreferences: prefs,
            });
            return data;
        },
        onSuccess: async () => {
            show({ type: 'success', message: 'Notification preferences updated successfully' });
            await qc.invalidateQueries({ queryKey: [queryKeys.profile()] });
        },
        onError: (err: any) => {
            const m = getErrorMessage(err, 'Failed to update notification preferences');
            show({ type: 'error', message: m });
        }
    });

    const loading = updateMutation.isPending || profileQuery.isLoading;

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold">Meu Perfil</h1>
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'profile'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Perfil
                    </button>
                    <button
                        onClick={() => setActiveTab('privacy')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === 'privacy'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        Configurações de Privacidade
                    </button>
                </nav>
            </div>

            {activeTab === 'profile' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-gray-600">Nome atual</label>
                            <input value={profileQuery.isLoading ? '...' : currentName} readOnly className="border px-2 py-1 w-full bg-gray-100" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-600">Email atual</label>
                            <input value={profileQuery.isLoading ? '...' : currentEmail} readOnly className="border px-2 py-1 w-full bg-gray-100" />
                        </div>
                    </div>
                    {message && <p className="text-green-700">{message}</p>}
                    {error && <p className="text-red-600" data-testid="profile-error">{error}</p>}
                    <form className="space-y-3" onSubmit={async e => {
                        e.preventDefault();
                        setError(null); setMessage(null);
                        updateMutation.mutate();
                    }}>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Novo nome"
                               className="border px-2 py-1 w-full"/>
                        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Novo email"
                               className="border px-2 py-1 w-full"/>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                                   placeholder="Senha atual (obrigatória para alterar senha/email)"
                                   className="border px-2 py-1 w-full"/>
                            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                                   placeholder="Nova senha" className="border px-2 py-1 w-full"/>
                        </div>
                        <button disabled={loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
                            {loading ? 'Salvando...' : 'Salvar alterações'}</button>
                    </form>

                    <div className="pt-6 border-t">
                        <h2 className="font-semibold mb-2">Excluir conta</h2>
                        <button className="bg-red-600 text-white px-4 py-2 rounded" onClick={handleDeleteAccountClick}>
                            Excluir permanentemente
                        </button>
                    </div>
                    <ConfirmModal
                        open={showDeleteModal}
                        title={selectedCompaniesToDelete.length > 0 
                            ? `Excluir ${selectedCompaniesToDelete.length} empresa(s) e conta?`
                            : "Tem certeza que deseja excluir permanentemente sua conta?"}
                        onCancel={() => {
                            setShowDeleteModal(false);
                            if (selectedCompaniesToDelete.length > 0) {
                                setShowPrimaryOwnerModal(true);
                            }
                        }}
                        onConfirm={handleDeleteAccount}
                    >
                        {selectedCompaniesToDelete.length > 0 ? (
                            <div>
                                <p className="mb-2">Você está prestes a excluir:</p>
                                <ul className="list-disc list-inside mb-2">
                                    <li>{selectedCompaniesToDelete.length} empresa(s) onde você é o owner principal</li>
                                    <li>Sua conta e todos os dados associados</li>
                                </ul>
                                <p className="text-red-600 font-semibold">Esta ação não pode ser desfeita.</p>
                            </div>
                        ) : (
                            <p>Todos os seus dados, empresas e convites serão removidos. Esta ação não pode ser desfeita.</p>
                        )}
                    </ConfirmModal>
                    <Modal
                        open={showPrimaryOwnerModal}
                        title="Não é possível excluir conta - Empresas como Owner Principal"
                        onClose={() => {
                            setShowPrimaryOwnerModal(false);
                            setSelectedCompaniesToDelete([]);
                        }}
                    >
                        <div className="space-y-4">
                            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p className="text-sm text-yellow-800 font-semibold mb-2 flex items-center gap-2">
                                    <span className="text-lg">⚠️</span>
                                    Você é o owner principal (criador) de uma ou mais empresas.
                                </p>
                                <p className="text-sm text-yellow-700">
                                    Para excluir sua conta, você deve primeiro excluir todas as empresas onde você é o owner principal. 
                                    Isso é necessário porque, como criador, você é responsável pela existência da empresa. 
                                    Excluir essas empresas também removerá todos os dados associados, membros e convites.
                                </p>
                            </div>
                            
                            {primaryOwnerCompaniesQuery.isLoading ? (
                                <p>Carregando empresas...</p>
                            ) : primaryOwnerCompaniesQuery.data?.data?.length > 0 ? (
                                <>
                                    <div className="max-h-64 overflow-y-auto border rounded p-2">
                                        {primaryOwnerCompaniesQuery.data.data.map((company: any) => (
                                            <label key={company.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCompaniesToDelete.includes(company.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedCompaniesToDelete([...selectedCompaniesToDelete, company.id]);
                                                        } else {
                                                            setSelectedCompaniesToDelete(selectedCompaniesToDelete.filter(id => id !== company.id));
                                                        }
                                                    }}
                                                    className="rounded"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium">{company.name}</div>
                                                    <div className="text-xs text-gray-600">ID: {company.id}</div>
                                                    {company.description && (
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            {company.description.length > 100 
                                                                ? `${company.description.slice(0, 100)}...` 
                                                                : company.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    
                                    {primaryOwnerCompaniesQuery.data.total > 10 && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <button
                                                onClick={() => {
                                                    const newPage = Math.max(1, primaryOwnerPage - 1);
                                                    setPrimaryOwnerPage(newPage);
                                                }}
                                                disabled={primaryOwnerPage === 1}
                                                className="px-2 py-1 border rounded disabled:opacity-50"
                                            >
                                                Anterior
                                            </button>
                                            <span>Página {primaryOwnerPage} de {Math.ceil(primaryOwnerCompaniesQuery.data.total / 10)}</span>
                                            <button
                                                onClick={() => {
                                                    const newPage = primaryOwnerPage + 1;
                                                    setPrimaryOwnerPage(newPage);
                                                }}
                                                disabled={primaryOwnerPage >= Math.ceil(primaryOwnerCompaniesQuery.data.total / 10)}
                                                className="px-2 py-1 border rounded disabled:opacity-50"
                                            >
                                                Próxima
                                            </button>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={async () => {
                                                const allCompanies: any[] = [];
                                                let currentPage = 1;
                                                let hasMore = true;
                                                
                                                while (hasMore) {
                                                    const { data } = await http.get('/auth/account/primary-owner-companies', {
                                                        params: { page: currentPage, pageSize: 100 },
                                                    });
                                                    allCompanies.push(...data.data);
                                                    hasMore = data.data.length === 100 && allCompanies.length < data.total;
                                                    currentPage++;
                                                }
                                                
                                                setSelectedCompaniesToDelete(allCompanies.map((c: any) => c.id));
                                            }}
                                            className="text-sm text-blue-600 underline"
                                        >
                                            Selecionar todas ({primaryOwnerCompaniesQuery.data.total})
                                        </button>
                                        <button
                                            onClick={() => setSelectedCompaniesToDelete([])}
                                            className="text-sm text-gray-600 underline"
                                        >
                                            Limpar seleção
                                        </button>
                                    </div>
                                    
                                    <div className="bg-red-50 border border-red-200 rounded p-3">
                                        <p className="text-sm text-red-800">
                                            <strong>Selecionadas {selectedCompaniesToDelete.length} de {primaryOwnerCompaniesQuery.data.total} empresas para excluir.</strong>
                                        </p>
                                        <p className="text-xs text-red-700 mt-1">
                                            Você deve selecionar todas as empresas para prosseguir com a exclusão da conta.
                                        </p>
                                    </div>
                                    
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setShowPrimaryOwnerModal(false);
                                                setSelectedCompaniesToDelete([]);
                                            }}
                                            className="px-4 py-2 border rounded"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (selectedCompaniesToDelete.length === primaryOwnerCompaniesQuery.data.total) {
                                                    setShowDeleteModal(true);
                                                } else {
                                                    show({ 
                                                        type: 'error', 
                                                        message: `Você deve selecionar todas as ${primaryOwnerCompaniesQuery.data.total} empresas para excluir sua conta.` 
                                                    });
                                                }
                                            }}
                                            disabled={selectedCompaniesToDelete.length !== primaryOwnerCompaniesQuery.data.total}
                                            className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Excluir {selectedCompaniesToDelete.length > 0 ? `${selectedCompaniesToDelete.length} empresa(s) e ` : ''}Conta
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-gray-600">Nenhuma empresa como owner principal encontrada.</p>
                            )}
                        </div>
                    </Modal>
                </>
            )}

            {activeTab === 'privacy' && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold">Preferências de Notificações</h2>
                    <p className="text-sm text-gray-600">
                        Controle quais notificações você recebe do sistema.
                    </p>
                    
                    <div className="space-y-4 border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Convites de Empresa</label>
                                <p className="text-sm text-gray-500">Receber notificações quando você for convidado a entrar em uma empresa</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.companyInvitations !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, companyInvitations: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Solicitações de Amizade</label>
                                <p className="text-sm text-gray-500">Receber notificações quando alguém enviar uma solicitação de amizade</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.friendRequests !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, friendRequests: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Mensagens da Empresa</label>
                                <p className="text-sm text-gray-500">Receber notificações para mensagens enviadas dentro de suas empresas</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.companyMessages !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, companyMessages: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Mudanças de Membros</label>
                                <p className="text-sm text-gray-500">Receber notificações quando membros forem adicionados ou removidos das empresas</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.membershipChanges !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, membershipChanges: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <label className="font-medium">Mudanças de Cargo</label>
                                <p className="text-sm text-gray-500">Receber notificações quando seu cargo em uma empresa mudar</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.roleChanges !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, roleChanges: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>

                        <div className="flex items-center justify-between border-t pt-4 mt-4">
                            <div>
                                <label className="font-medium">Popups em Tempo Real</label>
                                <p className="text-sm text-gray-500">Exibir popups quando novas notificações chegarem em tempo real</p>
                            </div>
                            <input
                                type="checkbox"
                                checked={notificationPreferences.realtimePopups !== false}
                                onChange={(e) => {
                                    const newPrefs = { ...notificationPreferences, realtimePopups: e.target.checked };
                                    setNotificationPreferences(newPrefs);
                                    updatePreferencesMutation.mutate(newPrefs);
                                }}
                                className="w-5 h-5"
                            />
                        </div>
                    </div>

                    {updatePreferencesMutation.isPending && (
                        <p className="text-sm text-gray-500">Salvando preferências...</p>
                    )}
                </div>
            )}
        </div>
    );
}

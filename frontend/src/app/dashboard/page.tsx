"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {CompanyList, Company} from '../../components/companys/CompanyList';
import Skeleton from '../../components/skeleton/Skeleton';
import {useRouter} from 'next/navigation';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import { useSelectCompany, useDeleteCompany, useLeaveCompany, useUpdateCompany, useCompany } from '../../services/api/company.api';
import { usePrimaryOwnerCompanies, useMemberCompanies, useProfile } from '../../services/api/auth.api';
import { translateMemberCompaniesMessage } from '../../lib/messages';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
import { ConfirmModal } from '../../components/modals/ConfirmModal';
import { Modal } from '../../components/modals/Modal';

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<'owner' | 'member'>('owner');
    const [ownerPage, setOwnerPage] = useState(1);
    const [memberPage, setMemberPage] = useState(1);
    const [tabIndex, setTabIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [leaveCompanyId, setLeaveCompanyId] = useState<string | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editLogo, setEditLogo] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editIsPublic, setEditIsPublic] = useState(false);
    const [saving, setSaving] = useState(false);
    const pageSize = 10;
    const router = useRouter();
    const {show} = useToast();

    const profileQuery = useProfile();
    const primaryOwnerQuery = usePrimaryOwnerCompanies(ownerPage, pageSize, activeTab === 'owner');
    const memberCompaniesQuery = useMemberCompanies(memberPage, pageSize, activeTab === 'member');
    const selectMutation = useSelectCompany();
    const deleteCompanyMutation = useDeleteCompany();
    const leaveCompanyMutation = useLeaveCompany(leaveCompanyId || undefined);
    const updateCompanyMutation = useUpdateCompany(editCompanyId || undefined);
    const editCompanyQuery = useCompany(editCompanyId || undefined);

    useEffect(() => {
        if (primaryOwnerQuery.isError) {
            const m = getErrorMessage((primaryOwnerQuery.error as any), 'Falha ao carregar empresas');
            show({ type: 'error', message: m });
        }
        if (memberCompaniesQuery.isError) {
            const m = getErrorMessage((memberCompaniesQuery.error as any), 'Falha ao carregar empresas');
            show({ type: 'error', message: m });
        }
    }, [primaryOwnerQuery.isError, primaryOwnerQuery.error, memberCompaniesQuery.isError, memberCompaniesQuery.error, show]);

    const allTabs = useMemo(() => [
        { id: 'owner', label: `Owner Principal (${primaryOwnerQuery.data?.total ?? 0})` },
        { id: 'member', label: `Participa (${memberCompaniesQuery.data?.total ?? 0})` },
    ], [primaryOwnerQuery.data?.total, memberCompaniesQuery.data?.total]);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 640);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const maxVisibleTabs = useMemo(() => isMobile ? 1 : 2, [isMobile]);

    useEffect(() => {
        const currentActiveIndex = allTabs.findIndex(tab => tab.id === activeTab);
        if (currentActiveIndex !== -1 && allTabs.length > 0) {
            const maxStart = Math.max(0, allTabs.length - maxVisibleTabs);
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
    }, [activeTab, allTabs, maxVisibleTabs]);

    const startTabIndex = useMemo(() => {
        return Math.max(0, Math.min(tabIndex, Math.max(0, allTabs.length - maxVisibleTabs)));
    }, [tabIndex, allTabs.length, maxVisibleTabs]);

    const visibleTabsSlice = useMemo(() => {
        return allTabs.slice(startTabIndex, startTabIndex + maxVisibleTabs);
    }, [allTabs, startTabIndex, maxVisibleTabs]);

    const handlePreviousTab = () => {
        setTabIndex(prev => {
            const newIndex = Math.max(0, prev - 1);
            return newIndex;
        });
    };

    const handleNextTab = () => {
        setTabIndex(prev => {
            const newIndex = Math.min(Math.max(0, allTabs.length - maxVisibleTabs), prev + 1);
            return newIndex;
        });
    };

    const handleSelect = (id: string) => {
        selectMutation.mutate(id, {
            onSuccess: (companyId) => {
                show({ type: 'success', message: 'Empresa selecionada' });
                router.push(`/company/${companyId}`);
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Não foi possível selecionar a empresa');
                show({ type: 'error', message: m });
            },
        });
    };

    const handleEdit = (id: string) => {
        setEditCompanyId(id);
        setShowEditModal(true);
    };

    const handleDelete = (id: string) => {
        setDeleteCompanyId(id);
        setShowDeleteModal(true);
    };

    const handleLeave = (id: string) => {
        setLeaveCompanyId(id);
        setShowLeaveModal(true);
    };

    const confirmDelete = () => {
        if (!deleteCompanyId) return;
        deleteCompanyMutation.mutate(deleteCompanyId, {
            onSuccess: () => {
                setShowDeleteModal(false);
                setDeleteCompanyId(null);
                show({ type: 'success', message: 'Empresa excluída' });
                primaryOwnerQuery.refetch();
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Falha ao excluir empresa');
                show({ type: 'error', message: m });
            },
        });
    };

    const confirmLeave = () => {
        if (!leaveCompanyId || !profileQuery.data?.id) return;
        leaveCompanyMutation.mutate(profileQuery.data.id, {
            onSuccess: () => {
                setShowLeaveModal(false);
                setLeaveCompanyId(null);
                show({ type: 'success', message: 'Você saiu da empresa' });
                memberCompaniesQuery.refetch();
            },
            onError: (err: any) => {
                const m = getErrorMessage(err, 'Não foi possível sair da empresa');
                show({ type: 'error', message: m });
            },
        });
    };

    const isLoading = activeTab === 'owner' ? primaryOwnerQuery.isLoading : memberCompaniesQuery.isLoading;
    const currentData = activeTab === 'owner' ? primaryOwnerQuery.data : memberCompaniesQuery.data;
    const currentPage = activeTab === 'owner' ? ownerPage : memberPage;
    const total = currentData?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const companies: Company[] = useMemo(() => {
        if (!currentData?.data) return [];
        return currentData.data.map(c => ({
            id: c.id,
            name: c.name,
            logoUrl: c.logoUrl,
            userRole: (c as any).userRole as 'OWNER' | 'ADMIN' | 'MEMBER' | undefined,
        }));
    }, [currentData]);

    const canEditCompanies = useMemo(() => {
        if (activeTab === 'owner') {
            return true;
        }
        return false;
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'owner') {
            setOwnerPage(1);
        } else {
            setMemberPage(1);
        }
    }, [activeTab]);

    useEffect(() => {
        if (editCompanyQuery.data && showEditModal) {
            setEditName(editCompanyQuery.data.name || '');
            setEditLogo(editCompanyQuery.data.logoUrl || '');
            setEditDescription(editCompanyQuery.data.description || '');
            setEditIsPublic(editCompanyQuery.data.is_public || false);
        }
    }, [editCompanyQuery.data, showEditModal]);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Minhas Empresas</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas empresas e organizações</p>
            </div>

            <div className="border-b border-gray-200 dark:border-gray-800 w-full">
                <div className="flex items-center gap-2 w-full justify-center">
                    {startTabIndex > 0 && (
                        <button
                            onClick={handlePreviousTab}
                            className="flex-shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                            aria-label="Aba anterior"
                        >
                            <MdChevronLeft className="text-xl text-gray-600 dark:text-gray-400" />
                        </button>
                    )}
                    
                    <nav className="flex-1 flex justify-center items-center space-x-1 overflow-x-auto scrollbar-hide" aria-label="Tabs">
                        {visibleTabsSlice.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'owner' | 'member')}
                                className={`
                                    flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 w-full sm:w-auto
                                    ${activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                    }
                                `}
                            >
                                <span className="text-xs sm:text-sm text-center">{tab.label}</span>
                            </button>
                        ))}
                    </nav>

                    {(startTabIndex + maxVisibleTabs < allTabs.length) && allTabs.length > maxVisibleTabs && (
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

            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : companies.length === 0 ? (
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 sm:p-12 text-center bg-gray-50 dark:bg-gray-900">
                    <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                        {activeTab === 'owner' 
                            ? 'Você não é owner principal de nenhuma empresa.'
                            : translateMemberCompaniesMessage()}
                    </p>
                </div>
            ) : (
                <>
                    <CompanyList 
                        companies={companies} 
                        onSelect={handleSelect}
                        onDelete={activeTab === 'owner' ? handleDelete : undefined}
                        onLeave={activeTab === 'member' ? handleLeave : undefined}
                        onEdit={handleEdit}
                        isOwner={activeTab === 'owner'}
                        isMember={activeTab === 'member'}
                        canEdit={canEditCompanies}
                    />
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <div className="flex items-center gap-2 flex-wrap justify-center">
                            <button 
                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                                onClick={() => {
                                    if (activeTab === 'owner') {
                                        setOwnerPage(p => Math.max(1, p - 1));
                                    } else {
                                        setMemberPage(p => Math.max(1, p - 1));
                                    }
                                }} 
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">Página {currentPage} de {totalPages}</span>
                            <button 
                                className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium" 
                                onClick={() => {
                                    if (activeTab === 'owner') {
                                        setOwnerPage(p => p + 1);
                                    } else {
                                        setMemberPage(p => p + 1);
                                    }
                                }} 
                                disabled={currentPage >= totalPages}
                            >
                                Próxima
                            </button>
                        </div>
                        <a href="/company/new" className="text-sm text-gray-900 dark:text-white hover:underline font-medium">Criar nova empresa</a>
                    </div>
                </>
            )}
            <ConfirmModal
                open={showDeleteModal}
                title="Excluir empresa?"
                onCancel={() => {
                    setShowDeleteModal(false);
                    setDeleteCompanyId(null);
                }}
                onConfirm={confirmDelete}
            >
                Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita e removerá todos os dados relacionados a ela.
            </ConfirmModal>
            <ConfirmModal
                open={showLeaveModal}
                title="Sair da empresa?"
                onCancel={() => {
                    setShowLeaveModal(false);
                    setLeaveCompanyId(null);
                }}
                onConfirm={confirmLeave}
            >
                Você realmente deseja sair da empresa? Todos os administradores serão notificados.
            </ConfirmModal>
            <Modal open={showEditModal} title="Editar Empresa" onClose={() => {
                setShowEditModal(false);
                setEditCompanyId(null);
                setEditName('');
                setEditLogo('');
                setEditDescription('');
                setEditIsPublic(false);
            }}>
                {editCompanyQuery.isLoading ? (
                    <div className="p-4 text-center text-gray-600 dark:text-gray-400">Carregando...</div>
                ) : (
                    <form className="space-y-4"
                        onSubmit={async e => {
                            e.preventDefault();
                            if (!editCompanyId) return;
                            setSaving(true);
                            updateCompanyMutation.mutate({
                                name: editName || undefined,
                                logoUrl: editLogo || undefined,
                                description: editDescription.trim().slice(0, 400) || undefined,
                                is_public: editIsPublic,
                            }, {
                                onSuccess: () => {
                                    show({ type: 'success', message: 'Empresa atualizada' });
                                    setShowEditModal(false);
                                    setEditCompanyId(null);
                                    primaryOwnerQuery.refetch();
                                    memberCompaniesQuery.refetch();
                                },
                                onError: (err: any) => {
                                    const m = getErrorMessage(err, 'Falha ao atualizar empresa');
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
                                placeholder="Nome da empresa" className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800
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
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditCompanyId(null);
                                    setEditName('');
                                    setEditLogo('');
                                    setEditDescription('');
                                    setEditIsPublic(false);
                                }} className="px-4 py-2 border border-gray-200
                                    dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                    hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm">Cancelar</button>
                            <button disabled={saving} type="submit" className="px-4 py-2 bg-gray-900 dark:bg-white
                             text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200
                             disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors">
                                {saving ? 'Salvando...' : 'Salvar'}</button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
}

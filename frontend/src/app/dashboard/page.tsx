"use client";
import React, { useState, useEffect, useMemo } from 'react';
import {CompanyList, Company} from '../../components/companys/CompanyList';
import Skeleton from '../../components/skeleton/Skeleton';
import {useRouter} from 'next/navigation';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import { useSelectCompany } from '../../services/api/company.api';
import { usePrimaryOwnerCompanies, useMemberCompanies } from '../../services/api/auth.api';
import { translateMemberCompaniesMessage } from '../../lib/messages';
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState<'owner' | 'member'>('owner');
    const [ownerPage, setOwnerPage] = useState(1);
    const [memberPage, setMemberPage] = useState(1);
    const [tabIndex, setTabIndex] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const pageSize = 10;
    const router = useRouter();
    const {show} = useToast();

    const primaryOwnerQuery = usePrimaryOwnerCompanies(ownerPage, pageSize, activeTab === 'owner');
    const memberCompaniesQuery = useMemberCompanies(memberPage, pageSize, activeTab === 'member');
    const selectMutation = useSelectCompany();

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
        }));
    }, [currentData]);

    useEffect(() => {
        if (activeTab === 'owner') {
            setOwnerPage(1);
        } else {
            setMemberPage(1);
        }
    }, [activeTab]);

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
                    <CompanyList companies={companies} onSelect={handleSelect} />
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
        </div>
    );
}

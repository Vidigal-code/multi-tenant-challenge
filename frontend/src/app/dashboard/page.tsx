"use client";
import React, { useState, useEffect } from 'react';
import {CompanyList, Company} from '../../components/companys/CompanyList';
import Skeleton from '../../components/skeleton/Skeleton';
import {useRouter} from 'next/navigation';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';
import { useCompanies, useSelectCompany } from '../../services/api/company.api';

export default function DashboardPage() {
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const router = useRouter();
    const {show} = useToast();

    const companiesQuery = useCompanies(page, pageSize);
    const selectMutation = useSelectCompany();

    useEffect(() => {
        if (companiesQuery.isError) {
            const m = getErrorMessage((companiesQuery.error as any), 'Falha ao carregar empresas');
            show({ type: 'error', message: m });
        }
    }, [companiesQuery.isError, companiesQuery.error, show]);

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

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Minhas Empresas</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas empresas e organizações</p>
            </div>
            {companiesQuery.isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : (
                <CompanyList companies={companiesQuery.data?.list ?? []} onSelect={handleSelect} />
            )}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 flex-wrap justify-center">
                    <button className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Página {page} de {Math.max(1, Math.ceil((companiesQuery.data?.total ?? 0) / pageSize))}</span>
                    <button className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                            onClick={() => setPage(p => (p < Math.ceil((companiesQuery.data?.total ?? 0) / pageSize) ? p + 1 : p))}
                            disabled={page >= Math.ceil((companiesQuery.data?.total ?? 0) / pageSize)}>Próxima</button>
                </div>
                <a href="/company/new" className="text-sm text-gray-900 dark:text-white hover:underline font-medium">Criar nova empresa</a>
            </div>
        </div>
    );
}

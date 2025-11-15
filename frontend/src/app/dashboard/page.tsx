"use client";
import React, { useState } from 'react';
import {CompanyList, Company} from '../../components/companys/CompanyList';
import Skeleton from '../../components/skeleton/Skeleton';
import {useRouter} from 'next/navigation';
import {http} from '../../lib/http';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';

export default function DashboardPage() {

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const router = useRouter();
    const {show} = useToast();


    const companiesQuery = useQuery<{ list: Company[]; total: number }>({
        queryKey: queryKeys.companies(page, pageSize),
        queryFn: async () => {
            const { data } = await http.get('/companies', { params: { page, pageSize } });
            return {
                list: (data.data || []).map((c: any) => ({
                    id: c.props?.id || c.id,
                    name: c.props?.name || c.name,
                    logoUrl: c.props?.logoUrl || c.logoUrl
                } as Company)),
                total: data.total as number
            };
        },
        staleTime: 30_000,
    });

    if (companiesQuery.isError) {
        const m = getErrorMessage((companiesQuery.error as any), 'Failed to load companies');
        if (!error) { setError(m); show({ type: 'error', message: m }); }
    }

    const selectMutation = useMutation({
        mutationFn: async (id: string) => { await http.post(`/company/${id}/select`); return id; },
        onSuccess: (id) => {             setMessage('Empresa selecionada');
            show({ type: 'success', message: 'Empresa selecionada' }); router.push(`/company/${id}`); },
        onError: (err: any) => { const m = getErrorMessage(err, 'Unable to select companys');
            setError(m); show({ type: 'error', message: m }); },
    });

    const handleSelect = (id: string) => selectMutation.mutate(id);

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Minhas Empresas</h1>
                <p className="text-gray-600 dark:text-gray-400">Gerencie suas empresas e organizações</p>
            </div>
            {message && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-sm">{message}</div>}
            {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
            {companiesQuery.isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                    <Skeleton className="h-10" />
                </div>
            ) : (
                <CompanyList companies={companiesQuery.data?.list ?? []} onSelect={handleSelect}/>
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

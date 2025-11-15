"use client";
import React, { useState } from 'react';
import {CompanyList, Company} from '../../components/CompanyList';
import Skeleton from '../../components/Skeleton';
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
        onError: (err: any) => { const m = getErrorMessage(err, 'Unable to select company');
            setError(m); show({ type: 'error', message: m }); },
    });

    const handleSelect = (id: string) => selectMutation.mutate(id);

    return (
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Minhas Empresas</h1>
            {message && <p className="text-green-700">{message}</p>}
            {error && <p className="text-red-600">{error}</p>}
                        {companiesQuery.isLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                                <Skeleton className="h-10" />
                            </div>
                        ) : (
                            <CompanyList companies={companiesQuery.data?.list ?? []} onSelect={handleSelect}/>
                        )}
            <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
                <span className="text-sm">Página {page} de {Math.max(1, Math.ceil((companiesQuery.data?.total ?? 0) / pageSize))}</span>
                <button className="px-2 py-1 border rounded disabled:opacity-50"
                        onClick={() => setPage(p => (p < Math.ceil((companiesQuery.data?.total ?? 0) / pageSize) ? p + 1 : p))}
                        disabled={page >= Math.ceil((companiesQuery.data?.total ?? 0) / pageSize)}>Próxima</button>
            </div>
            <a href="/company/new" className="text-sm text-blue-600 underline">Criar nova empresa</a>
        </div>
    );
}

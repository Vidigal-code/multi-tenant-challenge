'use client';

import React, {useState, useEffect, useMemo} from 'react';
import {formatDateOnly} from '../../lib/date-utils';
import {FiStar} from 'react-icons/fi';
import {BiUser} from 'react-icons/bi';
import {MdChevronLeft, MdChevronRight} from 'react-icons/md';

interface Member {
    id: string;
    userId: string;
    role: string;
    name?: string;
    email?: string;
    joinedAt?: string;
}

type Props = {
    members: Member[];
    currentRole: 'OWNER' | 'ADMIN' | 'MEMBER' | null;
    currentUserId?: string | null;
    primaryOwnerUserId?: string | null;
    onMemberClick: (member: Member) => void;
    loadingIds?: string[];
    pageSize?: number;
};

export const MemberList = React.memo(function MemberList({
                                                             members,
                                                             currentRole, currentUserId,
                                                             primaryOwnerUserId, onMemberClick, loadingIds = [],
                                                             pageSize = 10
                                                         }: Props) {
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [members.length]);

    function translateRole(role: string): string {
        switch (role) {
            case 'OWNER':
                return 'PROPRIETÁRIO';
            case 'ADMIN':
                return 'ADMINISTRADOR';
            case 'MEMBER':
                return 'MEMBRO';
            default:
                return role;
        }
    }

    const showDetails = currentRole === 'OWNER' || currentRole === 'ADMIN';
    const isPrimaryOwner = (userId: string) => primaryOwnerUserId === userId;
    const canClickMember = true;

    const totalMembers = members.length;
    const totalPages = Math.max(1, Math.ceil(totalMembers / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageMembers = useMemo(() => members.slice(startIndex, endIndex), [members, startIndex, endIndex]);

    if (!members.length) {
        return <p className="text-sm text-gray-600 dark:text-gray-400">Ainda não há membros.</p>;
    }

    const handlePreviousPage = () => {
        setCurrentPage(prev => Math.max(1, prev - 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(totalPages, prev + 1));
    };

    return (
        <>
            <div className="space-y-3 md:hidden">
                {pageMembers.map((m) => {
                    const isLoading = loadingIds?.includes(m.userId);
                    return (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => canClickMember && !isLoading && onMemberClick(m)}
                            disabled={isLoading}
                            className={`w-full text-left border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 p-3 shadow-sm transition-colors ${
                                canClickMember && !isLoading
                                    ? 'hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer hover:border-gray-300 dark:hover:border-gray-700'
                                    : 'cursor-default'
                            } disabled:opacity-60`}
                            title={canClickMember && !isLoading ? 'Clique para ver informações do membro' : undefined}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0">
                                    {isPrimaryOwner(m.userId) && (
                                        <FiStar
                                            className="text-yellow-500 flex-shrink-0"
                                            title="Proprietário Principal"
                                        />
                                    )}
                                    <BiUser className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {m.name || 'Desconhecido'}
                                    </span>
                                </div>
                                <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
                                    {translateRole(m.role)}
                                </span>
                            </div>
                            {showDetails && (
                                <div className="mt-1 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                    <div>
                                        <span className="font-medium">Email:</span>{' '}
                                        <span className="break-all">{m.email || '-'}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium">ID do Usuário:</span>{' '}
                                        <span className="break-all font-mono">{m.userId}</span>
                                    </div>
                                    <div>
                                        <span className="font-medium">Entrou em:</span>{' '}
                                        {m.joinedAt ? formatDateOnly(m.joinedAt) : '-'}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 md:hidden">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                        Membros {startIndex + 1}–{Math.min(endIndex, totalMembers)} de {totalMembers}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePreviousPage}
                            disabled={safePage === 1}
                            className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            type="button"
                        >
                            <MdChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-gray-700 dark:text-gray-300 min-w-[80px] text-center">
                            Página {safePage} de {totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={safePage === totalPages}
                            className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            type="button"
                        >
                            <MdChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                    <thead>
                    <tr className="bg-gray-50 dark:bg-gray-950">
                        <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold">Nome</th>
                        {showDetails && (
                            <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden sm:table-cell">
                                Email
                            </th>
                        )}
                        {showDetails && (
                            <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden lg:table-cell">
                                ID do Usuário
                            </th>
                        )}
                        <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold">Papel</th>
                        {showDetails && (
                            <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden md:table-cell">
                                Entrou em
                            </th>
                        )}
                    </tr>
                    </thead>
                    <tbody>
                    {pageMembers.map((m) => (
                        <tr
                            key={m.id}
                            onClick={() => canClickMember && onMemberClick(m)}
                            className={`border-t border-gray-200 dark:border-gray-800 transition-colors ${
                                canClickMember ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-950 hover:border-gray-300 dark:hover:border-gray-700' : ''
                            }`}
                            title={canClickMember ? 'Clique para ver informações do membro' : undefined}
                        >
                            <td className="p-3 sm:p-4">
                                <div className="flex items-center gap-2">
                                    {isPrimaryOwner(m.userId) && (
                                        <FiStar
                                            className="text-yellow-500 flex-shrink-0"
                                            title="Proprietário Principal"
                                        />
                                    )}
                                    <BiUser className="text-gray-400 dark:text-gray-600 flex-shrink-0" />
                                    <span className="text-gray-900 dark:text-white truncate">
                                        {m.name || 'Desconhecido'}
                                    </span>
                                </div>
                            </td>
                            {showDetails && (
                                <td className="p-3 sm:p-4 text-gray-600 dark:text-gray-400 hidden sm:table-cell truncate max-w-xs">
                                    {m.email || '-'}
                                </td>
                            )}
                            {showDetails && (
                                <td className="p-3 sm:p-4 font-mono text-xs text-gray-600 dark:text-gray-400 hidden lg:table-cell truncate max-w-xs">
                                    {m.userId}
                                </td>
                            )}
                            <td className="p-3 sm:p-4 font-medium text-gray-900 dark:text-white">
                                {translateRole(m.role)}
                            </td>
                            {showDetails && (
                                <td className="p-3 sm:p-4 text-xs text-gray-500 dark:text-gray-400 hidden md:table-cell">
                                    {m.joinedAt ? formatDateOnly(m.joinedAt) : '-'}
                                </td>
                            )}
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className="hidden md:flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Membros {startIndex + 1}–{Math.min(endIndex, totalMembers)} de {totalMembers}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePreviousPage}
                            disabled={safePage === 1}
                            className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            type="button"
                        >
                            <MdChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 min-w-[80px] text-center">
                            Página {safePage} de {totalPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={safePage === totalPages}
                            className="p-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            type="button"
                        >
                            <MdChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
});

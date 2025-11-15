'use client';

import React from 'react';
import {formatDateOnly} from '../../lib/date-utils';
import {FiStar} from 'react-icons/fi';
import {BiUser} from 'react-icons/bi';

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
};

export const MemberList = React.memo(function MemberList({
                                                             members,
                                                             currentRole, currentUserId,
                                                             primaryOwnerUserId, onMemberClick, loadingIds = []
                                                         }: Props) {

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

    if (!members.length) return <p className="text-sm text-gray-600 dark:text-gray-400">Ainda não há membros.</p>;

    const showDetails = currentRole === 'OWNER' || currentRole === 'ADMIN';
    const isPrimaryOwner = (userId: string) => primaryOwnerUserId === userId;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
                <thead>
                <tr className="bg-gray-50 dark:bg-gray-950">
                    <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold">Nome</th>
                    {showDetails && <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden sm:table-cell">Email</th>}
                    {showDetails && <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden lg:table-cell">ID do Usuário</th>}
                    <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold">Papel</th>
                    {showDetails && <th className="text-left p-3 sm:p-4 text-gray-900 dark:text-white font-semibold hidden md:table-cell">Entrou em</th>}
                </tr>
                </thead>
                <tbody>
                {members.map((m) => (
                    <tr 
                        key={m.id} 
                        onClick={() => showDetails && onMemberClick(m)}
                        className={`border-t border-gray-200 dark:border-gray-800 transition-colors ${
                            showDetails ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-950' : ''
                        }`}
                    >
                        <td className="p-3 sm:p-4">
                            <div className="flex items-center gap-2">
                                {isPrimaryOwner(m.userId) && <FiStar className="text-yellow-500 flex-shrink-0" title="Proprietário Principal"/>}
                                <BiUser className="text-gray-400 dark:text-gray-600 flex-shrink-0"/>
                                <span className="text-gray-900 dark:text-white truncate">{m.name || 'Desconhecido'}</span>
                            </div>
                        </td>
                        {showDetails && (
                            <td className="p-3 sm:p-4 text-gray-600 dark:text-gray-400 hidden sm:table-cell truncate max-w-xs">{m.email || '-'}</td>
                        )}
                        {showDetails && (
                            <td className="p-3 sm:p-4 font-mono text-xs text-gray-600 dark:text-gray-400 hidden lg:table-cell truncate max-w-xs">{m.userId}</td>
                        )}
                        <td className="p-3 sm:p-4 font-medium text-gray-900 dark:text-white">{translateRole(m.role)}</td>
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
    );
});

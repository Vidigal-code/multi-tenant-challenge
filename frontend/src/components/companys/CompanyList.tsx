'use client';
import React, { useState } from 'react';
import { DEFAULT_COMPANY_LOGO } from '../../types';

export interface Company {
    id: string;
    name: string;
    logoUrl?: string | null;
    userRole?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export const CompanyList = React.memo(function CompanyList({
    companies, 
    onSelect,
    onDelete,
    onLeave,
    onEdit,
    isOwner = false,
    isMember = false,
    canEdit = false
}: {
    companies: Company[];
    onSelect: (id: string) => void;
    onDelete?: (id: string) => void;
    onLeave?: (id: string) => void;
    onEdit?: (id: string) => void;
    isOwner?: boolean;
    isMember?: boolean;
    canEdit?: boolean;
}) {
    const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

    const defaultLogo = DEFAULT_COMPANY_LOGO;
    
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map(c => (
                <div key={c.id} className="flex flex-col h-full border border-gray-200
                dark:border-gray-800 rounded-xl bg-white dark:bg-gray-950 p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex flex-col items-center text-center gap-2 min-w-0 flex-1">
                        <img
                            src={logoErrors[c.id] || !c.logoUrl ? defaultLogo : c.logoUrl}
                            alt="Logo"
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-full border border-gray-200 dark:border-gray-800"
                            onError={() => setLogoErrors(prev => ({ ...prev, [c.id]: true }))}
                        />
                        <span className="text-base sm:text-lg font-medium text-gray-900 dark:text-white break-words">{c.name}</span>
                    </div>
                    <div className="flex flex-col gap-2 mt-4">
                        <button 
                            onClick={() => onSelect(c.id)}
                            className="w-full px-4 py-2 bg-gray-900 dark:bg-white text-white
                            dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base"
                        >
                            Ver empresa
                        </button>
                        {((canEdit && isOwner) || (c.userRole === 'OWNER' || c.userRole === 'ADMIN')) && onEdit && (
                            <button 
                                onClick={() => onEdit(c.id)}
                                className="w-full px-4 py-2 border border-gray-200
                                dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
                                hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors font-medium text-sm sm:text-base"
                            >
                                Editar empresa
                            </button>
                        )}
                        {isOwner && onDelete && (
                            <button 
                                onClick={() => onDelete(c.id)}
                                className="w-full px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg
                                bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 transition-colors font-medium text-sm sm:text-base"
                            >
                                Excluir empresa
                            </button>
                        )}
                        {isMember && !isOwner && onLeave && (
                            <button 
                                onClick={() => onLeave(c.id)}
                                className="w-full px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg
                                bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 transition-colors font-medium text-sm sm:text-base"
                            >
                                Sair da empresa
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
});

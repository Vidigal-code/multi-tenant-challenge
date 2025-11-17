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
        <ul className="space-y-3">
            {companies.map(c => (
                <li key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center
                 justify-between gap-3 sm:gap-4 border border-gray-200 dark:border-gray-800 p-4 rounded-lg
                 hover:border-gray-900 dark:hover:border-white transition-colors bg-white dark:bg-gray-950">
                    <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                        <img
                            src={logoErrors[c.id] || !c.logoUrl ? defaultLogo : c.logoUrl}
                            alt="Logo"
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg flex-shrink-0"
                            onError={() => setLogoErrors(prev => ({ ...prev, [c.id]: true }))}
                        />
                        <span className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">{c.name}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <button 
                            onClick={() => onSelect(c.id)}
                            className="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-white text-white
                            dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200
                            transition-colors font-medium text-sm sm:text-base flex-shrink-0"
                        >
                            Ver empresa
                        </button>
                        {((canEdit && isOwner) || (c.userRole === 'OWNER' || c.userRole === 'ADMIN')) && onEdit && (
                            <button 
                                onClick={() => onEdit(c.id)}
                                className="w-full sm:w-auto px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg
                                bg-white dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50
                                dark:hover:bg-gray-900 transition-colors font-medium text-sm sm:text-base flex-shrink-0"
                            >
                                Editar empresa
                            </button>
                        )}
                        {isOwner && onDelete && (
                            <button 
                                onClick={() => onDelete(c.id)}
                                className="w-full sm:w-auto px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg
                                bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 transition-colors font-medium text-sm sm:text-base flex-shrink-0"
                            >
                                Excluir empresa
                            </button>
                        )}
                        {isMember && !isOwner && onLeave && (
                            <button 
                                onClick={() => onLeave(c.id)}
                                className="w-full sm:w-auto px-4 py-2 border border-red-200 dark:border-red-800 rounded-lg
                                bg-white dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50
                                dark:hover:bg-red-900/20 transition-colors font-medium text-sm sm:text-base flex-shrink-0"
                            >
                                Sair da empresa
                            </button>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
});

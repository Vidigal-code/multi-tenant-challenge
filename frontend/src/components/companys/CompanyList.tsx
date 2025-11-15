'use client';
import React, { useState } from 'react';
import { DEFAULT_COMPANY_LOGO } from '../../types';

export interface Company {
    id: string;
    name: string;
    logoUrl?: string;
}

export const CompanyList = React.memo(function CompanyList({companies, onSelect}: {
    companies: Company[];
    onSelect: (id: string) => void
}) {
    const [logoErrors, setLogoErrors] = useState<Record<string, boolean>>({});

    const defaultLogo = DEFAULT_COMPANY_LOGO;
    
    return (
        <ul className="space-y-3">
            {companies.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-4 border border-gray-200 dark:border-gray-800 p-4 rounded-lg hover:border-gray-900 dark:hover:border-white transition-colors bg-white dark:bg-gray-950">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                            src={logoErrors[c.id] || !c.logoUrl ? defaultLogo : c.logoUrl}
                            alt="Logo"
                            className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg flex-shrink-0"
                            onError={() => setLogoErrors(prev => ({ ...prev, [c.id]: true }))}
                        />
                        <span className="text-base sm:text-lg font-medium text-gray-900 dark:text-white truncate">{c.name}</span>
                    </div>
                    <button onClick={() => onSelect(c.id)}
                            className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base flex-shrink-0">Selecionar
                    </button>
                </li>
            ))}
        </ul>
    );
});

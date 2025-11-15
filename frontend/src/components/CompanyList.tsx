'use client';
import React, { useState } from 'react';

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
    const defaultLogo = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO ||  'https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png';
    
    return (
        <ul className="space-y-2">
            {companies.map(c => (
                <li key={c.id} className="flex items-center justify-between border p-2 rounded">
                    <div className="flex items-center gap-2">
                        <img
                            src={logoErrors[c.id] || !c.logoUrl ? defaultLogo : c.logoUrl}
                            alt="Logo"
                            className="w-8 h-8 object-cover rounded"
                            onError={() => setLogoErrors(prev => ({ ...prev, [c.id]: true }))}
                        />
                        <span>{c.name}</span>
                    </div>
                    <button onClick={() => onSelect(c.id)}
                            className="text-sm bg-indigo-600 text-white px-2 py-1 rounded">Select
                    </button>
                </li>
            ))}
        </ul>
    );
});

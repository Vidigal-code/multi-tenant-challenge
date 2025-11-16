'use client';

import React, {useState} from 'react';
import {http} from '../../lib/http';
import {getErrorMessage} from '../../lib/error';

export function InviteForm({companyId, onInvited}: { companyId: string; onInvited: (tokenOrUrl: string) => void }) {

    const [input, setInput] = useState('');
    const [role, setRole] = useState('MEMBER');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    return (
        <form className="space-y-3" onSubmit={async e => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            try {
                const trimmedInput = input.trim();
                if (!trimmedInput) {
                    setError('Por favor, informe um email ou ID de usuário');
                    setLoading(false);
                    return;
                }

                let email = trimmedInput;
                
                if (!isValidEmail(trimmedInput)) {
                    try {
                        const searchResponse = await http.get(`/users/search?q=${encodeURIComponent(trimmedInput)}`);
                        const users = searchResponse.data || [];
                        const foundUser = Array.isArray(users) 
                            ? users.find((u: any) => u.id === trimmedInput || u.email?.toLowerCase() === trimmedInput.toLowerCase())
                            : null;
                        
                        if (foundUser?.email) {
                            email = foundUser.email;
                        } else {
                            setError('Usuário não encontrado. Por favor, use um email válido ou um ID de usuário existente.');
                            setLoading(false);
                            return;
                        }
                    } catch (userErr: any) {
                        if (userErr?.response?.status === 404 || userErr?.response?.status === 400) {
                            setError('Usuário não encontrado. Por favor, use um email válido ou um ID de usuário existente.');
                        } else {
                            setError('Erro ao buscar usuário. Por favor, use um email válido.');
                        }
                        setLoading(false);
                        return;
                    }
                }

                const {data} = await http.post(`/companys/${companyId}/invites`, {email, role});
                onInvited(data.inviteUrl || data.token);
                setInput('');
            } catch (err) {
                setError(getErrorMessage(err));
            } finally {
                setLoading(false);
            }
        }}>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
                <input
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    placeholder="Email ou ID do usuário"
                    className="w-full sm:flex-1 px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors text-sm" 
                    required
                />
                <div className="relative w-full sm:w-40">
                    <select 
                        value={role} 
                        onChange={e => setRole(e.target.value)} 
                        className="w-full appearance-none px-3 py-2 pr-8 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors text-sm"
                    >
                        <option value="MEMBER">MEMBRO</option>
                        <option value="ADMIN">ADMINISTRADOR</option>
                        <option value="OWNER">PROPRIETÁRIO</option>
                    </select>
                    <svg
                        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
            <button disabled={loading} className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm">
                {loading ? 'Enviando...' : 'Enviar Convite'}
            </button>
        </form>
    );
}

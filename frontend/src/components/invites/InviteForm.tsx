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
            <div className="flex gap-3">
                <input 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    placeholder="Email ou ID do usuário"
                    className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors" 
                    required
                />
                <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)} 
                    className="px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"
                >
                    <option value="MEMBER">MEMBRO</option>
                    <option value="ADMIN">ADMINISTRADOR</option>
                    <option value="OWNER">PROPRIETÁRIO</option>
                </select>
            </div>
            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">{error}</div>}
            <button disabled={loading} className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors text-sm">
                {loading ? 'Enviando...' : 'Enviar Convite'}
            </button>
        </form>
    );
}

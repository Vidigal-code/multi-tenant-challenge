'use client';
import React, {useState} from 'react';
import {useRouter} from 'next/navigation';
import {http} from '../../../lib/http';
import {getErrorMessage} from '../../../lib/error';

export default function NewCompanyPage() {
    const [name, setName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    return (
        <div className="max-w-2xl mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Criar Empresa</h1>
                <p className="text-gray-600 dark:text-gray-400">Crie uma nova empresa para gerenciar</p>
            </div>
            {success && <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20
             border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-center">{success}</div>}
            {error && <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200
            dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
            <form className="space-y-4" onSubmit={async e => {
                e.preventDefault();
                setError(null);
                setSuccess(null);
                setLoading(true);
                try {
                    const payload = {
                        name: name.trim(),
                        logoUrl: logoUrl.trim() || undefined,
                        description: description.trim().slice(0, 400) || undefined,
                        is_public: isPublic
                    };
                    if (!payload.name || payload.name.length < 2) throw new Error('Nome deve ter pelo menos 2 caracteres');
                    const response = await http.post(`/company`, payload);
                 

                    const company = response.data;
                    
                    if (!company || !company.id) {
                        throw new Error('Empresa criada mas ID não foi retornado');
                    }
                    
                    setSuccess('Empresa criada com sucesso!');
                    router.push('/dashboard');
                } catch (err) {
                    setError(getErrorMessage(err, 'Falha ao criar empresa'));
                } finally {
                    setLoading(false);
                }
            }}>
                <div>
                    <input value={name}
                           onChange={e => setName(e.target.value)} placeholder="Nome"
                           className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                           bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                           dark:placeholder-gray-400 focus:outline-none focus:ring-2
                           focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors" required/>
                </div>
                <div>
                    <input value={logoUrl}
                           onChange={e => setLogoUrl(e.target.value)} placeholder="URL do Logo (opcional)"
                           className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                           bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                            dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                            dark:focus:ring-white focus:border-transparent transition-colors"/>
                </div>
                <div>
                    <textarea value={description}
                              onChange={e => setDescription(e.target.value)}
                              placeholder="Descrição (máximo 400 caracteres)"
                              maxLength={400}
                              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                              bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                              dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                              dark:focus:ring-white focus:border-transparent resize-none transition-colors" rows={4}/>
                </div>
                <label className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox"
                           checked={isPublic}
                           onChange={e => setIsPublic(e.target.checked)}
                           className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:ring-2
                            focus:ring-gray-900 dark:focus:ring-white"/>
                    <span className="text-sm text-gray-700 dark:text-gray-300">Empresa pública (visível para todos os usuários)</span>
                </label>
                <button disabled={loading}
                        className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
                        hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed
                        font-medium transition-colors">{loading ? 'Criando...' : 'Criar'}</button>
            </form>
        </div>
    );
}

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
        <div className="space-y-4">
            <h1 className="text-xl font-semibold">Criar Empresa</h1>
            {success && <p className="text-green-700 text-sm">{success}</p>}
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <form className="space-y-3" onSubmit={async e => {
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
                <input value={name}
                       onChange={e => setName(e.target.value)} placeholder="Nome"
                       className="border px-2 py-1 w-full"/>
                <input value={logoUrl}
                       onChange={e => setLogoUrl(e.target.value)} placeholder="URL do Logo (opcional)"
                       className="border px-2 py-1 w-full"/>
                <textarea value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder="Descrição (máximo 400 caracteres)"
                          maxLength={400}
                          className="border px-2 py-1 w-full resize-none"/>
                <label className="flex items-center space-x-2">
                    <input type="checkbox"
                           checked={isPublic}
                           onChange={e => setIsPublic(e.target.checked)}
                           className="rounded"/>
                    <span>Empresa pública (visível para todos os usuários)</span>
                </label>
                <button disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Criando...' : 'Criar'}</button>
            </form>
    </div>
    );
}

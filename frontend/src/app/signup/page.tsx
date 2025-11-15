"use client";
import React, {useState} from 'react';
import { useAuth } from '../../hooks/useAuth';
import {useRouter} from 'next/navigation';
import {getErrorMessage} from '../../lib/error';
import {useToast} from '../../hooks/useToast';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const {show} = useToast();
    const { setAuthenticated, signup: signupAction } = useAuth();
    const router = useRouter();

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Criar Conta</h1>
            {success && <p className="text-green-700">{success}</p>}
            {error && <p className="text-red-600">{error}</p>}
            <form className="space-y-3" onSubmit={async e => {
                e.preventDefault();
                setError(null);
                setSuccess(null);
                setLoading(true);
                try {
                    await signupAction(email.trim(), password, name.trim());
                    setAuthenticated(true);
                    setSuccess('Conta criada com sucesso');
                    show({type: 'success', message: 'Cadastro realizado com sucesso'});
                    router.push('/dashboard');
                } catch (err) {
                    const m = getErrorMessage(err, 'Falha no cadastro');
                    setError(m);
                    show({type: 'error', message: m});
                } finally {
                    setLoading(false);
                }
            }}>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome"
                       className="border px-2 py-1 w-full" required minLength={2} autoComplete="name"/>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                       className="border px-2 py-1 w-full" required type="email" autoComplete="email"/>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha"
                       className="border px-2 py-1 w-full" required minLength={8} autoComplete="new-password"/>
                <button disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">{loading ? 'Registrando...' : 'Registrar'}</button>
            </form>
            <p className="text-sm">Já tem conta? <a href="/login" className="text-blue-600 underline">Entrar</a></p>
        </div>
    );
}

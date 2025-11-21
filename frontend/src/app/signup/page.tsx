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
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Criar Conta</h1>
                    <p className="text-gray-600 dark:text-gray-400">Comece sua jornada conosco</p>
                </div>
                {success && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200
                 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-center">{success}</div>}
                {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border
                border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
                <form className="space-y-4" onSubmit={async e => {
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
                    <div>
                        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome"
                               className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                               bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                               dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900
                               dark:focus:ring-white focus:border-transparent disabled:opacity-50 transition-colors"
                               required minLength={2} autoComplete="name"/>
                    </div>
                    <div>
                        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email"
                               className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg
                               bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500
                               dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white
                               focus:border-transparent disabled:opacity-50 transition-colors" required type="email" autoComplete="email"/>
                    </div>
                    <div>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha"
                               className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900
                               dark:text-white placeholder-gray-500
                               dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white
                               focus:border-transparent disabled:opacity-50 transition-colors" required minLength={8} autoComplete="new-password"/>
                    </div>
                    <button disabled={loading}
                            className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800
                            dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
                        {loading ? 'Registrando...' : 'Registrar'}</button>
                </form>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Já tem conta? <a href="/login" className="text-gray-900 dark:text-white font-medium hover:underline">Entrar</a>
                </p>
            </div>
        </div>
    );
}

"use client";
import React, {useState, useRef} from 'react';
import { useAuth } from '../../hooks/useAuth';
import {useToast} from '../../hooks/useToast';
import {useRouter} from 'next/navigation';
import {getErrorMessage} from '../../lib/error';

export default function LoginPage() {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const router = useRouter();
    const {show} = useToast();
    const isSubmittingRef = useRef(false);

    const { setAuthenticated, login: loginAction } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isSubmittingRef.current || loading) {
            return;
        }
        
        setError(null);
        setSuccess(null);
        setLoading(true);
        isSubmittingRef.current = true;
        
        try {
            await loginAction(email.trim(), password);
            setAuthenticated(true);
            setSuccess('Login realizado');
            show({type: 'success', message: 'Login realizado com sucesso'});
            setTimeout(() => {
                router.push('/dashboard');
            }, 100);
        } catch (err) {
            const m = getErrorMessage(err, 'Falha no login');
            setError(m);
            show({type: 'error', message: m});
            isSubmittingRef.current = false;
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-16">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Login</h1>
                    <p className="text-gray-600 dark:text-gray-400">Entre na sua conta para continuar</p>
                </div>
                {success && <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 text-center">{success}</div>}
                {error && <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-center">{error}</div>}
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <input 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            placeholder="Email"
                            type="email"
                            required
                            disabled={loading}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        />
                    </div>
                    <div>
                        <input 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            placeholder="Senha"
                            required
                            disabled={loading}
                            className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        />
                    </div>
                    <button 
                        disabled={loading || isSubmittingRef.current}
                        type="submit"
                        className="w-full px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>
                </form>
                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Não tem conta? <a href="/signup" className="text-gray-900 dark:text-white font-medium hover:underline">Criar conta</a>
                </p>
            </div>
        </div>
    );
}

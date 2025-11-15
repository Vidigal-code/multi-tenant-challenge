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
    const isSubmittingRef = useRef(false); // Ref para prevenir múltiplos submits

    const { setAuthenticated, login: loginAction } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Prevenir múltiplos submits simultâneos
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
            
            // Usar setTimeout para garantir que o estado seja atualizado antes do redirect
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
        <div className="space-y-4">
            <h1 className="text-2xl font-semibold">Login</h1>
            {success && <p className="text-green-700">{success}</p>}
            {error && <p className="text-red-600">{error}</p>}
            <form className="space-y-3" onSubmit={handleSubmit}>
                <input 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Email"
                    type="email"
                    required
                    disabled={loading}
                    className="border px-2 py-1 w-full disabled:opacity-50"
                />
                <input 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="Senha"
                    required
                    disabled={loading}
                    className="border px-2 py-1 w-full disabled:opacity-50"
                />
                <button 
                    disabled={loading || isSubmittingRef.current}
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Entrando...' : 'Entrar'}
                </button>
            </form>
            <p className="text-sm">Não tem conta? <a href="/signup" className="text-blue-600 underline">Criar conta</a>
            </p>
        </div>
    );
}

"use client";
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold">404 - Página não encontrada</h1>
            <p>A página que você tentou acessar não existe ou foi movida.</p>
            <div className="flex gap-3">
                <button onClick={() => history.back()} className="px-3 py-1 border rounded">Voltar</button>
                <Link href="/" className="px-3 py-1 border rounded bg-blue-600 text-white">Início</Link>
            </div>
        </div>
    );
}

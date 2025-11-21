"use client";
import React from 'react';

/**
 *      
 * EN: Global Error Component (Root fallback)
 *
 * PT: Componente de Erro Global (Fallback raiz)
 *
 * @params error - Error object
 * @params reset - Reset function
 * @returns JSX.Element
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body>
        <div className="max-w-2xl mx-auto py-10 space-y-4 px-4 text-center">
          <h2 className="text-xl font-semibold">Critical Error</h2>
          <p className="text-sm text-gray-700">{error.message || 'Something went wrong in the root layout'}</p>
          <button onClick={reset} className="px-3 py-1 border rounded bg-blue-600 text-white">Try again</button>
        </div>
      </body>
    </html>
  );
}


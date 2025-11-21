"use client";
import React from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-2xl mx-auto py-10 space-y-4 px-4">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Something went wrong</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">{error.message || 'An unexpected errors occurred'}</p>
      <button onClick={reset} className="px-3 py-1 border rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors">Try again</button>
        </div>
  );
}

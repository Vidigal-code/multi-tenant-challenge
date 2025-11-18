"use client";
import React from 'react';

export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: ()=>void; children: React.ReactNode }){
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-950 w-full max-w-lg rounded-lg border border-gray-200 dark:border-gray-800 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-950 z-10">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900" aria-label="Close modal">
            <svg className="w-5 h-5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

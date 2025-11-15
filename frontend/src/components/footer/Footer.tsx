"use client";
import React from 'react';

export function Footer() {
    return (
        <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600 dark:text-gray-400">
                    <a
                        href="https://github.com/Vidigal-code/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Criado por Kauan Vidigal
                    </a>
                    <span className="hidden sm:inline text-gray-400 dark:text-gray-600">•</span>
                    <a
                        href="https://github.com/Vidigal-code/multi-tenant-challenge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-gray-900 dark:hover:text-white transition-colors"
                    >
                        Documentação
                    </a>
                </div>
            </div>
        </footer>
    );
}


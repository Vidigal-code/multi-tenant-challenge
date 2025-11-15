"use client";
import React from 'react';

export function Footer() {
    return (
        <footer className="border-t bg-gray-50 dark:bg-gray-900 dark:border-gray-800 mt-auto">
            <div className="container mx-auto px-4 py-6">
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <p className="text-center">
                        Criado por{' '}
                        <a
                            href="https://github.com/Vidigal-code/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Kauan Vidigal
                        </a>
                    </p>
                    <span className="hidden md:inline">•</span>
                    <a
                        href="https://github.com/Vidigal-code/multi-tenant-challenge"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Documentação do Projeto
                    </a>
                </div>
            </div>
        </footer>
    );
}


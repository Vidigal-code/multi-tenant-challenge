"use client";
import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Toggle theme"
            type="button"
        >
            {theme === 'light' ? (
                <span className="text-xl">🌙</span>
            ) : (
                <span className="text-xl">☀️</span>
            )}
        </button>
    );
}


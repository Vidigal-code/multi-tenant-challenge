"use client";
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../store';
import { toggleTheme } from '../store/slices/themeSlice';

export function ThemeToggle() {
    const theme = useSelector((state: RootState) => state.theme.theme);
    const dispatch = useDispatch();

    return (
        <button
            onClick={() => dispatch(toggleTheme())}
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


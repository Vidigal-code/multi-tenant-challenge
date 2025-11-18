"use client";
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { toggleTheme } from '../../store/slices/themeSlice';
import { FiSun, FiMoon } from 'react-icons/fi';

export function ThemeToggle() {
    const theme = useSelector((state: RootState) => state.theme.theme);
    const dispatch = useDispatch();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                aria-label="Toggle theme"
                type="button"
                disabled
            >
                <div className="w-5 h-5" />
            </button>
        );
    }

    return (
        <button
            onClick={() => dispatch(toggleTheme())}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors text-gray-600 dark:text-gray-400"
            aria-label="Toggle theme"
            type="button"
        >
            {theme === 'light' ? (
                <FiMoon className="w-5 h-5" />
            ) : (
                <FiSun className="w-5 h-5" />
            )}
        </button>
    );
}

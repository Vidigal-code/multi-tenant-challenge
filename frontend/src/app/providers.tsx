"use client";

import React, { useEffect, useMemo } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthenticated } from '../store/slices/authSlice';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function Providers({ children, initialAuth = false }: { children: React.ReactNode; initialAuth?: boolean }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  useEffect(() => { store.dispatch(setAuthenticated(Boolean(initialAuth))); }, [initialAuth]);
  return (
    <ThemeProvider>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ReduxProvider>
    </ThemeProvider>
  );
}

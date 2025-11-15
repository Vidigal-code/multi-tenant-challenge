"use client";

import React, { useEffect, useMemo } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthenticated } from '../store/slices/authSlice';
import { initializeTheme } from '../store/slices/themeSlice';

export default function Providers({ children, initialAuth = false }: { children: React.ReactNode; initialAuth?: boolean }) {
  const queryClient = useMemo(() => new QueryClient(), []);
  
  useEffect(() => {
    store.dispatch(setAuthenticated(Boolean(initialAuth)));
  }, [initialAuth]);

  useEffect(() => {
    // Initialize theme on client side - syncs Redux state with DOM and localStorage
    // This runs after the blocking script in layout.tsx has set the initial class
    if (typeof window !== 'undefined') {
      store.dispatch(initializeTheme());
    }
  }, []);
  
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ReduxProvider>
  );
}

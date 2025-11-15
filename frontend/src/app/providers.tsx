"use client";

import React, { useEffect, useMemo } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../store';
import { QueryClient, QueryClientProvider, DefaultOptions } from '@tanstack/react-query';
import { setAuthenticated } from '../store/slices/authSlice';
import { initializeTheme } from '../store/slices/themeSlice';

const defaultQueryOptions: DefaultOptions<unknown> = {
  queries: {
    staleTime: 30_000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    retry: (failureCount, error: any) => {
      // Don't retry on 4xx errors (client errors)
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  },
  mutations: {
    retry: false,
  },
};

export default function Providers({ children, initialAuth = false }: { children: React.ReactNode; initialAuth?: boolean }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: defaultQueryOptions,
      }),
    []
  );
  
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

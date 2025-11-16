"use client";

import React, { useEffect, useMemo } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '../store';
import { QueryClient, QueryClientProvider, DefaultOptions } from '@tanstack/react-query';
import { setAuthenticated } from '../store/slices/authSlice';
import { initializeTheme } from '../store/slices/themeSlice';

const STALE_TIME = Number(process.env.NEXT_PUBLIC_QUERY_STALE_TIME ?? '30000');
const GC_TIME = Number(process.env.NEXT_PUBLIC_QUERY_GC_TIME ?? String(5 * 60 * 1000));

const defaultQueryOptions: DefaultOptions = {
  queries: {
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: (failureCount, error: any) => {
      if (error?.response?.status >= 400 && error?.response?.status < 500) {
        return false;
      }
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

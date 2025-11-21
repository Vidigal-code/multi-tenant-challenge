import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { useState, useEffect, useRef, useCallback } from 'react';

export type NotificationListingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface NotificationListItem {
  id: string;
  companyId?: string | null;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  senderId?: string;
  senderName?: string;
  senderUserId?: string;
  recipientUserId?: string | null;
  meta?: any;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface NotificationListingQueryData {
  items: NotificationListItem[];
  total: number;
  status: NotificationListingStatus;
  done: boolean;
  jobId: string;
  error: string | undefined;
  nextCursor: string | null;
}

export function useNotificationListing(
  page: number,
  pageSize: number,
  type?: string
) {

  const [jobId, setJobId] = useState<string | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [creationError, setCreationError] = useState<Error | null>(null);
  const isCreatingRef = useRef(false);

  const paramsRef = useRef({ page, pageSize, type });

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const createJob = async () => {
      isCreatingRef.current = true;
      setIsCreatingJob(true);
      setCreationError(null);
      
      try {
        // Simple retry logic for 429 errors
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            const response = await http.post<{ jobId: string }>(
              '/notifications/listing',
              { page, pageSize, type },
              { signal: controller.signal }
            );
            
            if (!controller.signal.aborted) {
              setJobId(response.data.jobId);
            }
            break; // Success, exit loop
          } catch (error: any) {
            if (error.response?.status === 429 && attempts < maxAttempts - 1) {
              attempts++;
              // Exponential backoff: 1s, 2s, 4s...
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
              if (controller.signal.aborted) break;
              continue;
            }
            throw error; // Re-throw other errors or if max attempts reached
          }
        }
      } catch (error: any) {
        if (error.code !== 'ERR_CANCELED' && error.name !== 'CanceledError') {
             console.error('Failed to create notification listing job:', error);
             if (!controller.signal.aborted) {
               setCreationError(error);
             }
        }
      } finally {
        if (!controller.signal.aborted) {
          isCreatingRef.current = false;
          setIsCreatingJob(false);
        }
      }
    };

    const prevParams = paramsRef.current;
    const paramsChanged = 
      prevParams.page !== page ||
      prevParams.pageSize !== pageSize ||
      prevParams.type !== type;

    if (paramsChanged) {
      paramsRef.current = { page, pageSize, type };
      setJobId(null);
      setCreationError(null);
      
      // Clear any existing timeout to avoid double execution
      // @ts-ignore - timeoutId might be undefined in first run but that's safe for clearTimeout
      if (typeof timeoutId !== 'undefined') clearTimeout(timeoutId);
      
      // Create new job with debounce
      timeoutId = setTimeout(createJob, 500);
    } else if (!jobId && !isCreatingRef.current && !creationError) {
      // Initial load or retry needed, and not currently creating, and no previous fatal error
      timeoutId = setTimeout(createJob, 500);
    }

    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
      // We don't reset isCreatingRef here because unmount might be temporary in StrictMode
      // but the abort controller will handle the cancellation of the fetch
    };
  }, [page, pageSize, type, jobId]);

  const fallbackData: NotificationListingQueryData = {
    items: [],
    total: 0,
    status: 'pending',
    done: false,
    jobId: jobId || '',
    error: undefined,
    nextCursor: null,
  };

  const query = useQuery<NotificationListingQueryData>({
    queryKey: queryKeys.notificationListing(type || 'all', page, pageSize),
    queryFn: async () => {
      if (!jobId) throw new Error('No job ID available');

      const response = await http.get<NotificationListingQueryData>(
        `/notifications/listing/${jobId}`
      );

      return {
        ...response.data,
        jobId
      };
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data as NotificationListingQueryData | undefined;
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false;
      }
      return 2000;
    },
    staleTime: Infinity,
  });

  const restartJob = useCallback(() => {
    setJobId(null);
    setCreationError(null);
  }, []);

  const isLoading = isCreatingJob || query.isLoading || (!!jobId && !query.data?.done);

  return {
    ...query,
    isLoading,
    data: query.data ?? fallbackData,
    error: creationError || (query.error as Error) || (query.data?.error ? new Error(query.data.error) : undefined),
    restartJob
  };
}


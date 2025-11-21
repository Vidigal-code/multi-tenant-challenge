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

  const restartJob = useCallback(() => {
    setJobId(null);
    setCreationError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;

    const createJob = async () => {
      if (isCreatingRef.current) return;
      
      isCreatingRef.current = true;
      setIsCreatingJob(true);
      setCreationError(null);
      
      try {
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
            break; 
          } catch (error: any) {
            if (error.response?.status === 429 && attempts < maxAttempts - 1) {
              attempts++;
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
              if (controller.signal.aborted) break;
              continue;
            }
            if (error.code !== 'ERR_CANCELED' && error.name !== 'CanceledError') {
                throw error;
            }
            break; 
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

    if (paramsChanged || (!jobId && !isCreatingRef.current && !creationError)) {
      if (paramsChanged) {
          paramsRef.current = { page, pageSize, type };
          setJobId(null);
      }
      
      // Create new job with debounce
      timeoutId = setTimeout(createJob, 300);
    }

    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
      isCreatingRef.current = false; 
    };
  }, [page, pageSize, type, jobId, creationError]); 

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
    queryKey: queryKeys.notificationListing(type || 'all', page, pageSize, jobId),
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
    staleTime: 5000,
  });

  const isLoading = isCreatingJob || query.isLoading || (!!jobId && !query.data?.done);

  return {
    ...query,
    isLoading,
    data: query.data ?? fallbackData,
    error: creationError || (query.error as Error) || 
    (query.data?.error ? new Error(query.data.error) : undefined),
    restartJob
  };
}


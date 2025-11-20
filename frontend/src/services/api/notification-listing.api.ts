import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { useState, useEffect, useRef } from 'react';

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

  const paramsRef = useRef({ page, pageSize, type });

  useEffect(() => {
    let isMounted = true;

    const createJob = async () => {
      if (!isMounted) return;
      setIsCreatingJob(true);
      try {
        const response = await http.post<{ jobId: string }>(
          '/notifications/listing',
          {
            page,
            pageSize,
            type
          }
        );
        if (isMounted) {
          setJobId(response.data.jobId);
        }
      } catch (error) {
        console.error('Failed to create notification listing job:', error);
      } finally {
        if (isMounted) {
          setIsCreatingJob(false);
        }
      }
    };

    const prevParams = paramsRef.current;
    if (
      prevParams.page !== page ||
      prevParams.pageSize !== pageSize ||
      prevParams.type !== type ||
      !jobId
    ) {
      paramsRef.current = { page, pageSize, type };
      createJob();
    }

    return () => {
      isMounted = false;
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

  const restartJob = () => {
    setJobId(null);
  };

  const isLoading = isCreatingJob || query.isLoading;

  return {
    ...query,
    isLoading,
    data: query.data ?? fallbackData,
    restartJob
  };
}


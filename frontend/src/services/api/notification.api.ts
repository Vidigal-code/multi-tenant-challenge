import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractNotificationsData } from '../../lib/api-response';
import { useState, useEffect } from 'react';

export interface NotificationUser {
  id: string;
  name: string;
  email: string;
}

export interface NotificationCompany {
  name?: string;
  description?: string;
  memberCount?: number;
}

export interface NotificationMeta {
  kind?: string;
  channel?: string;
  sender?: NotificationUser;
  companyName?: string;
  companyId?: string;
  inviteId?: string;
  inviteUrl?: string;
  inviteEmail?: string;
  role?: string;
  previousRole?: string;
  removedBy?: NotificationUser;
  rejectedByName?: string;
  rejectedByEmail?: string;
  friendshipId?: string;
  originalNotificationId?: string;
  replyTo?: string;
  originalTitle?: string;
  originalBody?: string;
  originalMeta?: NotificationMeta;
  company?: NotificationCompany;
  [key: string]: any;
}

export interface Notification {
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
  meta?: NotificationMeta;
  sender?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface NotificationsResponse {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
}

export * from './notification-listing.api';

export function useNotifications(page: number = 1, pageSize: number = 10) {
  return useQuery<NotificationsResponse>({
    queryKey: queryKeys.notifications(page, pageSize),
    queryFn: async () => {
      const response = await http.get('/notifications', { params: { page, pageSize } });
      const notificationsData = extractNotificationsData(response.data);
      return {
        items: notificationsData.items as Notification[],
        total: notificationsData.total || 0,
        page: notificationsData.page || page,
        pageSize: notificationsData.pageSize || pageSize,
      };
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      companyId?: string;
      title: string;
      body: string;
      recipientsEmails?: string[] | null;
      onlyOwnersAndAdmins?: boolean;
    }) => {
      const response = await http.post('/notifications', data);
      return response.data;
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
          console.error('[useCreateNotification] Error invalidating queries:', error);
        }
      });
      return result;
    },
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await http.patch(`/notifications/${id}/read`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
          //console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
        }
      });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/notifications/${id}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
         // console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
        }
      });
    },
  });
}

export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      await http.delete('/notifications', { data: { notificationIds } });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
          //console.error('[useDeleteNotifications] Error invalidating queries:', error);
        }
      });
    },
  });
}

export function useReplyToNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      await http.post(`/notifications/${id}/reply`, { replyBody: body });
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
          //console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
        }
      });
    },
  });
}

export interface NotificationDeletionJobResponse {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    deletedCount: number;
    done: boolean;
    error?: string;
}

export function useNotificationDeletionJob() {
    const queryClient = useQueryClient();
    const [jobId, setJobId] = useState<string | null>(null);

    const createJobMutation = useMutation({
        mutationFn: async (data: { ids?: string[]; deleteAll?: boolean }) => {
            const response = await http.post<{jobId: string}>('/notifications/deletion-jobs', data);
            return response.data;
        },
        onSuccess: (data) => {
            setJobId(data.jobId);
        }
    });

    const jobQuery = useQuery({
        queryKey: ['notification-deletion-job', jobId],
        queryFn: async () => {
            if (!jobId) throw new Error('No job ID');
            const response = await http.get<NotificationDeletionJobResponse>(`/notifications/deletion-jobs/${jobId}`);
            return response.data;
        },
        enabled: !!jobId,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data?.done) return false;
            return 1000;
        },
    });

    useEffect(() => {
        if (jobQuery.data?.done && jobQuery.data.status === 'completed') {
            queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
            queryClient.invalidateQueries({ queryKey: ['notification-listing'] }); 
        }
    }, [jobQuery.data?.done, jobQuery.data?.status, queryClient]);

    return {
        createJob: createJobMutation.mutate,
        createJobAsync: createJobMutation.mutateAsync,
        jobStatus: jobQuery.data,
        isLoading: createJobMutation.isPending, 
        error: createJobMutation.error || jobQuery.error,
        reset: () => setJobId(null)
    };
}

export interface NotificationBroadcastJobResponse {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed: number;
    totalTargets?: number;
    done: boolean;
    error?: string;
}

export function useNotificationBroadcastJob() {
    const [jobId, setJobId] = useState<string | null>(null);

    const createJobMutation = useMutation({
        mutationFn: async (data: {
            companyId: string;
            title: string;
            body: string;
            recipientsEmails?: string[] | null;
            onlyOwnersAndAdmins?: boolean;
        }) => {
            const response = await http.post<{ jobId: string }>('/notifications/broadcast-jobs', data);
            return response.data;
        },
        onSuccess: (data) => {
            setJobId(data.jobId);
        },
    });

    const jobQuery = useQuery({
        queryKey: ['notification-broadcast-job', jobId],
        queryFn: async () => {
            if (!jobId) throw new Error('No job ID');
            const response = await http.get<NotificationBroadcastJobResponse>(`/notifications/broadcast-jobs/${jobId}`);
            return response.data;
        },
        enabled: !!jobId,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data?.done) return false;
            return 1500;
        },
    });

    return {
        createJob: createJobMutation.mutate,
        createJobAsync: createJobMutation.mutateAsync,
        jobStatus: jobQuery.data,
        isLoading: createJobMutation.isPending,
        error: createJobMutation.error || jobQuery.error,
        reset: () => setJobId(null),
    };
}

export interface FriendBroadcastJobResponse {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed: number;
    totalTargets?: number;
    done: boolean;
    error?: string;
}

export function useFriendBroadcastJob() {
    const [jobId, setJobId] = useState<string | null>(null);

    const createJobMutation = useMutation({
        mutationFn: async (data: { title: string; body: string; recipientsEmails?: string[] | null }) => {
            const response = await http.post<{ jobId: string }>('/notifications/friend-broadcast-jobs', data);
            return response.data;
        },
        onSuccess: (data) => {
            setJobId(data.jobId);
        },
    });

    const jobQuery = useQuery({
        queryKey: ['notification-friend-broadcast-job', jobId],
        queryFn: async () => {
            if (!jobId) throw new Error('No job ID');
            const response = await http.get<FriendBroadcastJobResponse>(`/notifications/friend-broadcast-jobs/${jobId}`);
            return response.data;
        },
        enabled: !!jobId,
        refetchInterval: (query) => {
            const data = query.state.data;
            if (data?.done) return false;
            return 1500;
        },
    });

    return {
        createJob: createJobMutation.mutate,
        createJobAsync: createJobMutation.mutateAsync,
        jobStatus: jobQuery.data,
        isLoading: createJobMutation.isPending,
        error: createJobMutation.error || jobQuery.error,
        reset: () => setJobId(null),
    };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractNotificationsData } from '../../lib/api-response';


export interface UserInfo {
    id: string;
    name: string;
    email: string;
}


export interface CompanyInfo {
    name?: string;
    description?: string;
    memberCount?: number;
}


export interface OriginalMeta {
    kind?: string;
    channel?: string;
    sender?: UserInfo;
    company?: CompanyInfo;
    companyName?: string;
    companyId?: string;
    inviteId?: string;
    inviteUrl?: string;
    inviteEmail?: string;
    role?: string;
    previousRole?: string;
    removedBy?: UserInfo;
    rejectedByName?: string;
    rejectedByEmail?: string;
    [key: string]: any;
}


export interface NotificationMeta {
    kind?: string;
    channel?: string;
    sender?: UserInfo;
    companyName?: string;
    companyId?: string;
    inviteId?: string;
    inviteUrl?: string;
    inviteEmail?: string;
    role?: string;
    previousRole?: string;
    removedBy?: UserInfo;
    originalNotificationId?: string;
    replyTo?: string;
    originalTitle?: string;
    originalBody?: string;
    originalMeta?: OriginalMeta;
    rejectedByName?: string;
    rejectedByEmail?: string;
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
}

export interface NotificationsResponse {
    items: Notification[];
    total: number;
    page: number;
    pageSize: number;
}


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
         // console.error('[useCreateNotification] Error invalidating queries:', error);
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
         // console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
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
          //console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
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
         // console.error('[useDeleteNotifications] Error invalidating queries:', error);
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
         // console.error('[useMarkNotificationRead/useDeleteNotification/useReplyToNotification] Error invalidating queries:', error);
        }
      });
    },
  });
}




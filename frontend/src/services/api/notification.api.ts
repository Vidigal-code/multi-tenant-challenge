import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractNotificationsData } from '../../lib/api-response';

export interface Notification {
  id: string;
  companyId?: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  senderId?: string;
  senderName?: string;
  recipientUserId?: string;
}

export function useNotifications(page?: number, pageSize?: number) {
  return useQuery<Notification[]>({
    queryKey: queryKeys.notifications(page, pageSize),
    queryFn: async () => {
      const params = page && pageSize ? { page, pageSize } : {};
      const response = await http.get('/notifications', { params });
      const notificationsData = extractNotificationsData(response.data);
      return notificationsData.items as Notification[];
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}

export function useReplyToNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      await http.post(`/notifications/${id}/reply`, { body });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
    },
  });
}




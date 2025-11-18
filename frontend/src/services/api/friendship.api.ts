import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Friendship {
  id: string;
  requester: User;
  addressee: User;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  createdAt: string;
}

export function useFriendships(status?: 'ACCEPTED' | 'PENDING') {
  return useQuery<Friendship[]>({
    queryKey: queryKeys.friendships(status),
    queryFn: async () => {
      const url = status ? `/friendships?status=${status}` : '/friendships';
      const response = await http.get(url);
      return (response.data.data || response.data) as Friendship[];
    },
  });
}

export function useFriendRequests() {
  return useQuery<Friendship[]>({
    queryKey: queryKeys.friendRequests(),
    queryFn: async () => {
      const response = await http.get('/friendships?status=PENDING');
      const allRequests = (response.data.data || response.data) as Friendship[];
      return allRequests;
    },
  });
}

export function useSearchUsers() {
  return useMutation({
    mutationFn: async (query: string) => {
      const response = await http.get(`/users/search?q=${encodeURIComponent(query)}`);
      return (response.data.data || response.data) as User[];
    },
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (email: string) => {
      await http.post('/friendships/request', { email });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests() });
    },
  });
}

export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      await http.post(`/friendships/${friendshipId}/accept`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.friendships() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests() });
    },
  });
}

export function useRemoveFriend() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      await http.delete(`/friendships/${friendshipId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.friendships() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.friendRequests() });
    },
  });
}

export function useSendFriendNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { friendEmail: string; title: string; body: string }) => {
      await http.post('/notifications/friend', data);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.notifications(),
      }).catch((error: any) => {
        if (error?.name !== 'CancelledError') {
          console.error('[useSendFriendNotification] Error invalidating queries:', error);
        }
      });
    },
  });
}


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractData, extractPaginatedData } from '../../lib/api-response';

export interface Invite {
  id: string;
  companyId: string;
  email: string;
  role: string;
  status: string;
  token: string;
  inviterId?: string | null;
  inviterName?: string | null;
  inviterEmail?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  inviteUrl?: string;
  createdAt: string;
  expiresAt: string | null;
  name?: string;
  description?: string;
  logoUrl?: string | null;
}

export function useInvitesCreated(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useQuery<{ data: Invite[]; total: number }>({
    queryKey: queryKeys.invitesCreated(page, pageSize),
    queryFn: async () => {
      const response = await http.get('/invites/created', { params: { page, pageSize } });
      const paginated = extractPaginatedData<Invite>(response.data);
      return { data: paginated.data, total: paginated.total };
    },
    enabled,
  });
}

export function useInvitesReceived(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useQuery<{ data: Invite[]; total: number }>({
    queryKey: queryKeys.invitesReceived(page, pageSize),
    queryFn: async () => {
      const response = await http.get('/invites', { params: { page, pageSize } });
      const paginated = extractPaginatedData<Invite>(response.data);
      const pendingInvites = paginated.data.filter(inv => inv.status === 'PENDING');
      return { data: pendingInvites, total: pendingInvites.length };
    },
    enabled,
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (token: string) => {
      await http.post('/auth/accept-invites', { token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites-created'] });
      await queryClient.invalidateQueries({ queryKey: ['invites-received'] });
      await queryClient.invalidateQueries({ queryKey: ['invite'] });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

export function useRejectInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (token: string) => {
      await http.post(`/invites/${token}/reject`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites-created'] });
      await queryClient.invalidateQueries({ queryKey: ['invites-received'] });
    },
  });
}

export function useDeleteInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (inviteId: string) => {
      await http.delete(`/invites/${inviteId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites-created'] });
      await queryClient.invalidateQueries({ queryKey: ['invites-received'] });
    },
  });
}

export function useDeleteInvites() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (inviteIds: string[]) => {
      await http.delete('/invites', { data: { inviteIds } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invites-created'] });
      await queryClient.invalidateQueries({ queryKey: ['invites-received'] });
    },
  });
}


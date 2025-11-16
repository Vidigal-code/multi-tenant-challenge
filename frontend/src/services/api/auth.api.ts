import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractData } from '../../lib/api-response';

export interface Profile {
  id: string;
  name?: string | null;
  email: string;
  activeCompanyId?: string | null;
  notificationPreferences?: Record<string, boolean>;
}

const PROFILE_STALE_TIME = Number(process.env.NEXT_PUBLIC_PROFILE_STALE_TIME) || 60_000; // Default: 1 minute

export function useProfile(enabled: boolean = true) {
  return useQuery<Profile>({
    queryKey: queryKeys.profile(),
    queryFn: async () => {
      const response = await http.get('/auth/profile');
      return extractData<Profile>(response.data);
    },
    enabled,
    staleTime: PROFILE_STALE_TIME,
  });
}

export interface PrimaryOwnerCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  memberCount: number;
  primaryOwnerName: string;
  primaryOwnerEmail: string;
}

export function usePrimaryOwnerCompanies(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useQuery<{ data: PrimaryOwnerCompany[]; total: number; page: number; pageSize: number }>({
    queryKey: [...queryKeys.primaryOwnerCompanies(), page, pageSize],
    queryFn: async () => {
      const response = await http.get('/auth/account/primary-owner-companies', {
        params: { page, pageSize },
      });
      return response.data as { data: PrimaryOwnerCompany[]; total: number; page: number; pageSize: number };
    },
    enabled,
    staleTime: 0, 
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name?: string; email?: string; notificationPreferences?: Record<string, boolean> }) => {
      const response = await http.post('/auth/profile', data);
      return extractData<Profile>(response.data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

export interface MemberCompany {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  isPublic: boolean;
  createdAt: string;
  memberCount: number;
  userRole: 'OWNER' | 'ADMIN' | 'MEMBER';
  primaryOwnerName: string;
  primaryOwnerEmail: string;
}

export function useMemberCompanies(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useQuery<{ data: MemberCompany[]; total: number; page: number; pageSize: number }>({
    queryKey: [...queryKeys.memberCompanies(), page, pageSize],
    queryFn: async () => {
      const response = await http.get('/auth/account/member-companies', {
        params: { page, pageSize },
      });
      return response.data as { data: MemberCompany[]; total: number; page: number; pageSize: number };
    },
    enabled,
    staleTime: 0, 
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      await http.delete('/auth/account');
    },
    onSuccess: async () => {
      await queryClient.clear();
    },
  });
}


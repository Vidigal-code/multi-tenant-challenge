import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { http } from '../../lib/http';
import { queryKeys } from '../../lib/queryKeys';
import { extractData, extractPaginatedData, extractMembersData } from '../../lib/api-response';

export interface Company {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  is_public: boolean;
  createdAt?: string;
}

export interface Member {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  name?: string;
  email?: string;
  joinedAt?: string;
}

export interface CompanyMembersResponse {
  members: Member[];
  total: number;
  currentUserRole: string | null;
}

export interface PrimaryOwnerResponse {
  primaryOwnerId: string | null;
  primaryOwnerUserId: string | null;
  primaryOwnerName: string;
  primaryOwnerEmail: string;
  createdAt?: string;
}

export function useCompanies(page: number = 1, pageSize: number = 10) {
  return useQuery<{ list: Company[]; total: number }>({
    queryKey: queryKeys.companies(page, pageSize),
    queryFn: async () => {
      const response = await http.get('/companies', { params: { page, pageSize } });
      const paginated = extractPaginatedData<Company>(response.data);
      return {
        list: paginated.data.map((c: any) => ({
          id: c.id || c.props?.id,
          name: c.name || c.props?.name,
          logoUrl: c.logoUrl || c.props?.logoUrl,
        } as Company)),
        total: paginated.total,
      };
    },
  });
}

export function useCompany(id: string | undefined) {
  return useQuery<Company>({
    queryKey: queryKeys.company(id!),
    queryFn: async () => {
      const response = await http.get(`/company/${id}`);
      return extractData<Company>(response.data);
    },
    enabled: Boolean(id),
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 403 || error?.response?.status === 401) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

export function useCompanyPublicInfo(id: string | undefined, enabled: boolean = false) {
  return useQuery<Company>({
    queryKey: queryKeys.companyPublicInfo(id!),
    queryFn: async () => {
      const response = await http.get(`/company/${id}/public-info`);
      return extractData<Company>(response.data);
    },
    enabled: Boolean(id) && enabled,
  });
}

export function useCompanyRole(id: string | undefined) {
  return useQuery<{ role: 'OWNER' | 'ADMIN' | 'MEMBER' | null }>({
    queryKey: queryKeys.companyRole(id!),
    queryFn: async () => {
      const response = await http.get(`/companys/${id}/members/role`);
      return extractData<{ role: 'OWNER' | 'ADMIN' | 'MEMBER' | null }>(response.data);
    },
    enabled: Boolean(id),
  });
}

export function useCompanyMembers(id: string | undefined) {
  return useQuery<CompanyMembersResponse>({
    queryKey: queryKeys.companyMembers(id!),
    queryFn: async () => {
      const response = await http.get(`/companys/${id}/members`);
      return extractMembersData(response.data);
    },
    enabled: Boolean(id),
  });
}

export function useCompanyPrimaryOwner(id: string | undefined, enabled: boolean = true) {
  return useQuery<PrimaryOwnerResponse>({
    queryKey: queryKeys.companyPrimaryOwner(id!),
    queryFn: async () => {
      const response = await http.get(`/companys/${id}/members/primary-owner`);
      return extractData<PrimaryOwnerResponse>(response.data);
    },
    enabled: Boolean(id) && enabled,
  });
}

export function useSelectCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await http.post(`/company/${id}/select`);
      return id;
    },
    onSuccess: async (id) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.company(id) });
    },
  });
}

export function useUpdateCompany(id: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name?: string; logoUrl?: string; description?: string; is_public?: boolean }) => {
      const response = await http.patch(`/company/${id}`, data);
      return extractData<Company>(response.data);
    },
    onSuccess: async () => {
      if (!id) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.company(id) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyPublicInfo(id) });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/company/${id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

export function useRemoveMember(companyId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      await http.delete(`/companys/${companyId}/members/${userId}`);
    },
    onSuccess: async () => {
      if (!companyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyPrimaryOwner(companyId) });
    },
  });
}

export function useChangeMemberRole(companyId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }) => {
      await http.patch(`/companys/${companyId}/members/${userId}/role`, { role });
    },
    onSuccess: async () => {
      if (!companyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyRole(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyPrimaryOwner(companyId) });
    },
  });
}

export function useLeaveCompany(companyId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (userId: string) => {
      await http.post(`/company/${companyId}/members/${userId}/leave`);
    },
    onSuccess: async () => {
      if (!companyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile() });
    },
  });
}

export function useTransferOwnership(companyId: string | undefined) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newOwnerId: string) => {
      await http.post(`/companys/${companyId}/members/transfer-ownership`, { newOwnerId });
    },
    onSuccess: async () => {
      if (!companyId) return;
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyMembers(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyPrimaryOwner(companyId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companyRole(companyId) });
    },
  });
}


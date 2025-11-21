import {useCallback, useEffect, useRef, useState} from 'react';
import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
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

const PROFILE_STALE_TIME = Number(process.env.NEXT_PUBLIC_PROFILE_STALE_TIME) || 60_000; 

const COMPANY_LISTING_PATH: Record<'primary-owner' | 'member', string> = {
  'primary-owner': '/auth/account/primary-owner-companies',
  'member': '/auth/account/member-companies',
};

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

interface CompanyListingQueryData<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  done: boolean;
  jobId: string | null;
  error?: string | null;
}

interface CompanyListingJobResponse<T> {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed: number;
  total?: number;
  items: T[];
  done: boolean;
  nextCursor?: number | null;
  error?: string;
}

async function startCompanyListingJob(type: 'primary-owner' | 'member', chunkSize?: number) {
  const response = await http.post(`${COMPANY_LISTING_PATH[type]}/listing`, chunkSize ? { chunkSize } : {});
  return response.data as CompanyListingJobResponse<any>;
}

async function fetchCompanyListingPage<T>(type: 'primary-owner' | 'member', jobId: string, cursor: number, pageSize: number) {
  const response = await http.get(`${COMPANY_LISTING_PATH[type]}/listing/${jobId}`, {
    params: { cursor, pageSize },
  });
  return response.data as CompanyListingJobResponse<T>;
}

async function deleteCompanyListingJob(type: 'primary-owner' | 'member', jobId: string) {
  await http.delete(`${COMPANY_LISTING_PATH[type]}/listing/${jobId}`);
}

type CompanyListingHookResult<T> = UseQueryResult<CompanyListingQueryData<T>> & {
  restartJob: () => void;
  jobBootstrapping: boolean;
};

function useCompanyListing<T extends PrimaryOwnerCompany | MemberCompany>(
  type: 'primary-owner' | 'member',
  page: number = 1,
  pageSize: number = 10,
  enabled: boolean = true,
): CompanyListingHookResult<T> {
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);

  const cleanupJob = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await deleteCompanyListingJob(type, id);
    } catch {
    }
  }, [type]);

  useEffect(() => {
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout;
    let cancelled = false;

    if (!enabled) {
      cleanupJob(jobIdRef.current);
      jobIdRef.current = null;
      setJobId(null);
      setJobError(null);
      return;
    }

    setJobId(null);
    setJobError(null);

    const createJob = async () => {
      try {
        // Retry mechanism for 429
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
             const response = await http.post(`${COMPANY_LISTING_PATH[type]}/listing`, 
               {}, 
               { signal: controller.signal }
             );
             
             if (cancelled || controller.signal.aborted) {
                await cleanupJob(response.data.jobId);
          return;
        }
             
             jobIdRef.current = response.data.jobId;
             setJobId(response.data.jobId);
             break;
          } catch (error: any) {
             if (error.response?.status === 429 && attempts < maxAttempts - 1) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempts - 1)));
                if (cancelled || controller.signal.aborted) break;
                continue;
             }
             throw error;
          }
        }
      } catch (error: any) {
        if (error.code !== 'ERR_CANCELED' && error.name !== 'CanceledError' && !cancelled) {
        const message = error?.response?.data?.message || 'Falha ao iniciar job de empresas';
        setJobError(message);
        }
      }
    };

    timeoutId = setTimeout(createJob, 300); // Debounce job creation

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [type, enabled, restartKey, cleanupJob]);

  const restartJob = useCallback(() => {
    cleanupJob(jobIdRef.current);
    jobIdRef.current = null;
    setJobId(null);
    setJobError(null);
    setRestartKey((value) => value + 1);
  }, [cleanupJob]);

  useEffect(() => {
    return () => {
      cleanupJob(jobIdRef.current);
      jobIdRef.current = null;
    };
  }, [cleanupJob]);

  const cursor = Math.max(0, (page - 1) * pageSize);
  const queryKeyBase = type === 'primary-owner' ? queryKeys.primaryOwnerCompanies() : queryKeys.memberCompanies();
  const query = useQuery<CompanyListingQueryData<T>>({
    queryKey: [...queryKeyBase, type, page, pageSize, jobId, restartKey],
    enabled: enabled && Boolean(jobId),
    queryFn: async () => {
      if (!jobId) {
        return {
          data: [],
          total: 0,
          page,
          pageSize,
          status: 'pending',
          done: false,
          jobId: null,
          error: jobError,
        };
      }
      const payload = await fetchCompanyListingPage<T>(type, jobId, cursor, pageSize);
      return {
        data: payload.items as T[],
        total: payload.total ?? payload.items.length,
        page,
        pageSize,
        status: payload.status,
        done: payload.done,
        jobId,
        error: payload.error,
      };
    },
    refetchInterval: (query) => {
      const currentData = query.state.data as CompanyListingQueryData<T> | undefined;
      if (!currentData) return false;
      return currentData.status !== 'completed' ? 2000 : false;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const defaultData: CompanyListingQueryData<T> = {
    data: [],
    total: 0,
    page,
    pageSize,
    status: jobError ? 'failed' : 'pending',
    done: false,
    jobId,
    error: jobError,
  };

  const jobBootstrapping = enabled && !jobId && !jobError;
  return {
    ...query,
    data: query.data ?? defaultData,
    restartJob,
    jobBootstrapping,
  } as CompanyListingHookResult<T>;
}

export function usePrimaryOwnerCompanies(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useCompanyListing<PrimaryOwnerCompany>('primary-owner', page, pageSize, enabled);
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  notificationPreferences?: Record<string, boolean>;
  currentPassword?: string;
  newPassword?: string;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: UpdateProfilePayload) => {
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
  return useCompanyListing<MemberCompany>('member', page, pageSize, enabled);
}

export interface UserDeletionJobResponse {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    currentStep: string;
    done: boolean;
    error?: string;
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  
  const createJobMutation = useMutation({
    mutationFn: async () => {
      const response = await http.delete<{jobId: string}>('/users/me');
      return response.data;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
    },
  });

  const jobQuery = useQuery({
    queryKey: ['user-deletion-job', jobId],
    queryFn: async () => {
        if (!jobId) throw new Error('No job ID');
        const response = await http.get<UserDeletionJobResponse>(`/users/deletion-jobs/${jobId}`);
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
          queryClient.clear();
      }
  }, [jobQuery.data?.done, jobQuery.data?.status, queryClient]);

  return {
      mutate: createJobMutation.mutate,
      isPending: createJobMutation.isPending || (!!jobId && !jobQuery.data?.done),
      jobStatus: jobQuery.data,
      error: createJobMutation.error || jobQuery.error,
      reset: () => setJobId(null)
  };
}


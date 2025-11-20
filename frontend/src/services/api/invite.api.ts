import {useCallback, useEffect, useRef, useState} from 'react';
import {useQuery, useMutation, useQueryClient, UseQueryResult} from '@tanstack/react-query';
import {http} from '../../lib/http';
import {queryKeys} from '../../lib/queryKeys';

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

type InviteListingStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface InviteListingQueryData {
  data: Invite[];
  total: number;
  status: InviteListingStatus;
  done: boolean;
  jobId: string;
  error?: string | null;
  nextCursor: number | null;
}

type InviteListingHookResult = UseQueryResult<InviteListingQueryData> & {
  restartJob: () => void;
  jobId: string | null;
};

const INVITE_LISTING_POLL_INTERVAL = 2000;

/**
 *
 * EN:
 * Starts a background invite listing job on the backend.
 *
 * PT:
 * Inicia um job de listagem de convites no backend.
 *
 * @params type - EN/PT: listing type (`created` or `received`)
 * @returns Promise<InviteListingQueryData>
 */
async function startInviteListingJobRequest(type: 'created' | 'received') {
  const response = await http.post('/invites/listing', { type });
  return response.data as { jobId: string };
}

/**
 *
 * EN:
 * Fetches a page from an invite listing job stored in Redis.
 *
 * PT:
 * Busca uma página de um job de listagem de convites armazenado no Redis.
 *
 * @params jobId - EN/PT: job identifier
 * @params cursor - EN/PT: start index inside the cached list
 * @params pageSize - EN/PT: desired amount of records
 * @returns Promise<any>
 */
async function fetchInviteListingJobPage(jobId: string, cursor: number, pageSize: number) {
  const response = await http.get(`/invites/listing/${jobId}`, {
    params: { cursor, pageSize },
  });
  return response.data as {
    items: Invite[];
    total: number;
    status: InviteListingStatus;
    done: boolean;
    nextCursor?: number | null;
    error?: string;
  };
}

/**
 *
 * EN:
 * Deletes an invite listing job to free Redis memory.
 *
 * PT:
 * Remove um job de listagem de convites para liberar memória no Redis.
 *
 * @params jobId - EN/PT: job identifier
 * @returns Promise<void>
 */
async function deleteInviteListingJobRequest(jobId: string) {
  await http.delete(`/invites/listing/${jobId}`);
}

/**
 *
 * EN:
 * React hook that orchestrates invite listing jobs (RabbitMQ + Redis) and exposes paginated data.
 *
 * PT:
 * Hook React que orquestra os jobs de listagem de convites (RabbitMQ + Redis) e expõe dados paginados.
 *
 * @params type - EN/PT: tipo de listagem (`created` ou `received`)
 * @params page - EN/PT: página atual (base 1)
 * @params pageSize - EN/PT: quantidade de registros por página
 * @params enabled - EN/PT: habilita/desabilita o job
 * @returns Hook com os dados, status e ação para reiniciar o job
 */
function useInviteListing(
  type: 'created' | 'received',
  page: number = 1,
  pageSize: number = 10,
  enabled: boolean = true,
): InviteListingHookResult {
  const [jobId, setJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);

  const cleanupJob = useCallback(async (id: string | null) => {
    if (!id) return;
    try {
      await deleteInviteListingJobRequest(id);
    } catch {
      // Ignore cleanup failures
    }
  }, []);

  useEffect(() => {
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
        const response = await startInviteListingJobRequest(type);
        if (cancelled) {
          await cleanupJob(response.jobId);
          return;
        }
        jobIdRef.current = response.jobId;
        setJobId(response.jobId);
      } catch (error: any) {
        const message = error?.response?.data?.message || 'Falha ao iniciar job de convites';
        setJobError(message);
      }
    };
    createJob();
    return () => {
      cancelled = true;
      cleanupJob(jobIdRef.current);
      jobIdRef.current = null;
    };
  }, [type, enabled, restartKey, cleanupJob]);

  const restartJob = useCallback(() => {
    cleanupJob(jobIdRef.current);
    jobIdRef.current = null;
    setJobId(null);
    setJobError(null);
    setRestartKey((value) => value + 1);
  }, [cleanupJob]);

  const cursor = Math.max(0, (page - 1) * pageSize);
  const query = useQuery<InviteListingQueryData>({
    queryKey: [...queryKeys.invitesListing(type), page, pageSize, jobId, restartKey],
    enabled: enabled && Boolean(jobId),
    queryFn: async (): Promise<InviteListingQueryData> => {
      if (!jobId) {
        return {
          data: [],
          total: 0,
          status: 'pending',
          done: false,
          jobId: '',
          error: jobError,
          nextCursor: null,
        } as InviteListingQueryData;
      }
      const payload = await fetchInviteListingJobPage(jobId, cursor, pageSize);
      return {
        data: payload.items,
        total: payload.total,
        status: payload.status,
        done: payload.done,
        jobId,
        error: payload.error,
        nextCursor: payload.done ? null : (payload.nextCursor ?? null),
      } as InviteListingQueryData;
    },
    refetchInterval: (query) => {
      const jobData = query.state.data as InviteListingQueryData | undefined;
      if (!jobData) return false;
      return jobData.status !== 'completed' ? INVITE_LISTING_POLL_INTERVAL : false;
    },
  });

  useEffect(() => {
    if (!query.error) return;
    const message = (query.error as any)?.response?.data?.message;
    if (typeof message === 'string' && message.includes('INVITE_LIST_JOB_NOT_FOUND')) {
      restartJob();
    }
  }, [query.error, restartJob]);

  const fallbackData: InviteListingQueryData = {
    data: [],
    total: 0,
    status: jobError ? 'failed' : 'pending',
    done: false,
    jobId: jobId || '',
    error: jobError,
    nextCursor: null,
  };
  const enhancedQuery: InviteListingHookResult = {
    ...query,
    data: query.data ?? fallbackData,
    isLoading: query.isLoading || (enabled && !jobId && !jobError),
    isFetching: query.isFetching || (enabled && !jobId && !jobError),
    restartJob,
    jobId,
  } as InviteListingHookResult;

  return enhancedQuery;
}

export function useInvitesCreated(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useInviteListing('created', page, pageSize, enabled);
}

export function useInvitesReceived(page: number = 1, pageSize: number = 10, enabled: boolean = true) {
  return useInviteListing('received', page, pageSize, enabled);
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (token: string) => {
      await http.post('/auth/accept-invites', { token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('created') });
      await queryClient.invalidateQueries({ queryKey: queryKeys.invitesListing('received') });
    },
  });
}

export interface InviteBulkJobPayload {
  action: 'delete' | 'reject';
  scope: 'selected' | 'all';
  inviteIds?: string[];
  chunkSize?: number;
}

export interface InviteBulkJobResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed: number;
  succeeded: number;
  failed: number;
  error?: string;
}

/**
 *
 * EN:
 * Starts an invite bulk job (delete or reject).
 *
 * PT:
 * Inicia um job de operação em lote de convites (delete ou reject).
 *
 * @params payload - job configuration
 * @returns Promise<InviteBulkJobResult>
 */
export async function createInviteBulkJob(payload: InviteBulkJobPayload): Promise<InviteBulkJobResult> {
  const response = await http.post('/invites/bulk', payload);
  return response.data as InviteBulkJobResult;
}

export async function fetchInviteBulkJob(jobId: string): Promise<InviteBulkJobResult> {
  const response = await http.get(`/invites/bulk/${jobId}`);
  return response.data as InviteBulkJobResult;
}

export async function deleteInviteBulkJob(jobId: string): Promise<void> {
  await http.delete(`/invites/bulk/${jobId}`);
}


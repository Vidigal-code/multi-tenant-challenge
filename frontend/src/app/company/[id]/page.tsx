"use client";

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { redirect } from 'next/navigation';
import { http } from '../../../lib/http';
import { useParams } from 'next/navigation';
import { InviteForm } from '../../../components/InviteForm';
import { MemberList } from '../../../components/MemberList';
import { getErrorMessage } from '../../../lib/error';
import { getSuccessMessage, getErrorMessage as getErrorMessageByCode } from '../../../lib/messages';
import { useToast } from '../../../hooks/useToast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../../components/Skeleton';
import { queryKeys } from '../../../lib/queryKeys';
import { Modal } from '../../../components/Modal';
import { ConfirmModal } from '../../../components/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../../lib/realtime';
import { formatDate } from '../../../lib/date-utils';

interface Member { id: string; userId: string; role: string; name?: string; email?: string; joinedAt?: string; }
interface Company { id: string; name: string; logoUrl?: string; description?: string; is_public: boolean; createdAt?: string; }

function truncate(text: string, max: number) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export default function CompanyPage() {

  const params = useParams();
  const id = params?.id as string;
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLogo, setEditLogo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [notificationEmails, setNotificationEmails] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showRequestToJoinModal, setShowRequestToJoinModal] = useState(false);
  const [requestContacts, setRequestContacts] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferToUserId, setTransferToUserId] = useState('');
  const { show } = useToast();
  const qc = useQueryClient();

  const profileQuery = useQuery({
    queryKey: [queryKeys.profile()],
    queryFn: async () => {
      const { data } = await http.get('/auth/profile');
      return data;
    },
    staleTime: 60_000,
  });

  const selectMutation = useMutation({
    mutationFn: async () => { if(!id || id === 'undefined') {
        redirect('/dashboard'); return; } await http.post(`/company/${id}/select`);
        },
    onSuccess: async () => {
      setMessage('Active company set');
      show({ type:'success', message:'Active company updated' });
    },
    onError: (err:any) => { const m = getErrorMessage(err,'Unable to update active company');
        setError(m); show({ type:'error', message:m }); }
  });

  const membersQuery = useQuery<{ members: Member[]; total: number; currentUserRole: string | null }>({
    queryKey: queryKeys.companyMembers(id),
    queryFn: async () => { 
      const { data } = await http.get(`/company/${id}/members`); 
      return { 
        members: (data.members || data.data || []) as Member[], 
        total: data.total || (data.data || []).length,
        currentUserRole: data.currentUserRole || null
      }; 
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<Member | null>(null);

  const removeMemberMutation = useMutation({
    mutationFn: async (member: Member) => {
      await http.delete(`/company/${id}/members/${member.userId}`);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
      setRemoveMemberConfirm(null);
      show({ type: 'success', message: 'Member removed successfully' });
    },
    onError: (err: any) => {
      const m = getErrorMessage(err, 'Unable to remove member');
      setError(m);
      show({ type: 'error', message: m });
      setRemoveMemberConfirm(null);
    },
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ member, role }: { member: Member; role: 'OWNER'|'ADMIN'|'MEMBER' }) => {
      await http.patch(`/company/${id}/members/${member.userId}/role`, { role });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
    },
    onError: (err: any) => {
      const m = getErrorMessage(err, 'Unable to update role');
      setError(m);
      show({ type: 'error', message: m });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      if (!profileQuery.data?.id) {
        throw new Error('Unable to determine current user');
      }
      await http.post(`/company/${id}/members/${profileQuery.data.id}/leave`);
    },
    onSuccess: async () => {
      show({ type: 'success', message: 'You left the company' });
      window.location.href = '/dashboard';
    },
    onError: (err: any) => {
      const m = getErrorMessage(err, 'Unable to leave the company');
      setError(m);
      show({ type: 'error', message: m });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async ({ title, body, emails }: { title: string; body: string; emails: string }) => {
      const recipientsEmails = emails ? emails.split(',').map(e => e.trim()) : null;
      const result = await http.post('/notifications', { companyId: id, title, body, recipientsEmails });
      return result.data;
    },
    onSuccess: async (result) => {
      show({ type: 'success', message: 'Global message sent' });
      setShowNotificationModal(false);
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationEmails('');

      if (result.validationResults && result.validationResults.length > 0) {
        result.validationResults.forEach((entry: any) => {
          const tone = entry.status === 'sent' ? 'success' : 'error';
          const label = entry.email === '*' ? 'Company members' : entry.email;
          const message = entry.status === 'sent' 
            ? getSuccessMessage(entry.code, { count: entry.count })
            : getErrorMessageByCode(entry.code);
          show({ type: tone, message: `${label}: ${message}` });
        });
      }
    },
    onError: (err: any) => {
      const m = getErrorMessage(err, 'Unable to send notification');
      setError(m);
      show({ type: 'error', message: m });
    },
  });

  const roleQuery = useQuery<{ role: 'OWNER'|'ADMIN'|'MEMBER'|null}>({
    queryKey: ['company-role', id],
    queryFn: async () => { const { data } = await http.get(`/company/${id}/members/role`); return data; },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const companyQuery = useQuery<Company>({
    queryKey: ['company', id],
    queryFn: async () => { 
      try {
        const { data } = await http.get(`/company/${id}`); 
        return data;
      } catch (err: any) {
        if (err?.response?.status === 403 || err?.response?.status === 401) {
          const { data } = await http.get(`/company/${id}/public-info`);
          return {
            id: data.id,
            name: data.name,
            logoUrl: data.logoUrl,
            description: data.description,
            is_public: data.is_public,
            createdAt: data.createdAt,
          };
        }
        throw err;
      }
    },
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const isMember = !!roleQuery.data?.role;

  const primaryOwnerQuery = useQuery<{ primaryOwnerUserId: string | null; primaryOwnerName: string; primaryOwnerEmail: string }>({
    queryKey: ['primary-owner', id],
    queryFn: async () => {
      const { data } = await http.get(`/company/${id}/members/primary-owner`);
      return data;
    },
    enabled: Boolean(id) && isMember,
    staleTime: 60_000,
  });

  const publicCompanyInfoQuery = useQuery<{ memberCount: number; primaryOwnerName: string; primaryOwnerEmail: string }>({
    queryKey: ['public-company-info', id],
    queryFn: async () => {
      try {
        const publicInfo = await http.get(`/company/${id}/public-info`);
        return {
          memberCount: publicInfo.data?.memberCount || 0,
          primaryOwnerName: publicInfo.data?.primaryOwnerName || 'N/A',
          primaryOwnerEmail: publicInfo.data?.primaryOwnerEmail || 'N/A',
        };
      } catch {
        return { memberCount: 0, primaryOwnerName: 'N/A', primaryOwnerEmail: 'N/A' };
      }
    },
    enabled: Boolean(id) && companyQuery.data?.is_public && !isMember,
    staleTime: 60_000,
  });

  const canEdit = useMemo(() => roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN', [roleQuery.data]);
  const canManage = canEdit;
  const canDelete = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);
  const canLeave = useMemo(() => roleQuery.data?.role && roleQuery.data.role !== 'OWNER', [roleQuery.data]);
  const canSendNotification = canEdit;
  const canTransferOwnership = useMemo(() => roleQuery.data?.role === 'OWNER', [roleQuery.data]);

  const transferOwnershipMutation = useMutation({
    mutationFn: async (newOwnerId: string) => {
      await http.post(`/company/${id}/members/transfer-ownership`, { newOwnerId });
    },
    onSuccess: async () => {
      show({ type: 'success', message: 'Ownership transferred successfully' });
      setShowTransferModal(false);
      setTransferToUserId('');
      await qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
      await qc.invalidateQueries({ queryKey: ['primary-owner', id] });
      await qc.invalidateQueries({ queryKey: ['company-role', id] });
    },
    onError: (err: any) => {
      const m = getErrorMessage(err, 'Failed to transfer ownership');
      setError(m);
      show({ type: 'error', message: m });
    },
  });

  useEffect(() => {
    if (membersQuery.isSuccess && members.length === 0) {
      setMembers(membersQuery.data.members || []);
    }
  }, [membersQuery.isSuccess, membersQuery.data, members.length]);

  const [hasSelectedCompany, setHasSelectedCompany] = useState(false);
  useEffect(() => {
    if (!membersQuery.isLoading && selectMutation.status === 'idle' && id && id !== 'undefined' && !hasSelectedCompany) {
      selectMutation.mutate();
      setHasSelectedCompany(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [membersQuery.isLoading, id]);

  const handleInvited = useCallback((inviteUrl: string) => {
    setInviteToken(inviteUrl);
    show({ type:'success', message:'Invitation created' });
  }, [show]);

  useEffect(() => {
    let active = true;
    const unsubscribers: Array<() => void> = [];

    whenReady().then(() => {
      if (!active) return;
      unsubscribers.push(
        subscribe(RT_EVENTS.COMPANY_UPDATED, (payload: any) => {
          if (payload?.id === id) {
            qc.invalidateQueries({ queryKey: ['company', id] });
          }
        }),
      );
      const refetchMembers = () => {
        qc.invalidateQueries({ queryKey: queryKeys.companyMembers(id) });
        qc.invalidateQueries({ queryKey: ['company', id] });
      };
      unsubscribers.push(
        subscribe(RT_EVENTS.MEMBER_JOINED, (payload: any) => {
          if (payload?.companyId === id) {
            refetchMembers();
          }
        }),
      );
      unsubscribers.push(
        subscribe(RT_EVENTS.MEMBER_LEFT, (payload: any) => {
          if (payload?.companyId === id) {
            refetchMembers();
          }
        }),
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [id, qc]);

  const company = companyQuery.data;

  if (companyQuery.isLoading || roleQuery.isLoading) {
    return <Skeleton className="h-32" />;
  }

  if (!company) {
    return <div className="text-red-600">Company not found.</div>;
  }

  if (!company.is_public && !isMember) {
    return (
      <div className="space-y-4 p-6">
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Acesso Negado</h2>
          <p className="text-red-700">Acesso negado, empresa privada.</p>
        </div>
      </div>
    );
  }

  if (company.is_public && !isMember) {
   
    const defaultLogo = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO || 'https://example.com/default-company.png';
   
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-4 mb-4">
          <img
            src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
            alt="Logo da empresa"
            className="w-16 h-16 object-cover rounded"
            onError={() => setLogoError(true)}
          />
          <div>
            <h1 className="text-xl font-semibold">{company.name}</h1>
            <p className="text-sm text-gray-600">ID: {company.id}</p>
          </div>
        </div>
        {company.description && (
          <div className="mb-4">
            <p className="text-sm text-gray-700">{company.description}</p>
          </div>
        )}
        {publicCompanyInfoQuery.data && (
          <div className="text-sm text-gray-600 mb-4 space-y-1">
            <p><strong>Quantidade de Membros:</strong> {publicCompanyInfoQuery.data.memberCount}</p>
            <p><strong>Owner Principal:</strong> {
              publicCompanyInfoQuery.data.primaryOwnerName !== 'N/A' 
                ? `${publicCompanyInfoQuery.data.primaryOwnerName}${publicCompanyInfoQuery.data.primaryOwnerEmail !== 'N/A' ? ` (${publicCompanyInfoQuery.data.primaryOwnerEmail})` : ''}`
                : 'Não disponível'
            }</p>
            {company.createdAt && (
              <p><strong>Data de Criação:</strong> {formatDate(company.createdAt)}</p>
            )}
          </div>
        )}
        <button
          onClick={() => setShowRequestToJoinModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Pedir para participar
        </button>
        <Modal
          open={showRequestToJoinModal}
          title="Pedir para Participar"
          onClose={() => {
            setShowRequestToJoinModal(false);
            setRequestContacts('');
            setRequestMessage('');
          }}
        >
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const contacts = requestContacts.trim() ? requestContacts.split(',').map(e => e.trim()) : null;
                await http.post('/notifications', {
                  companyId: id,
                  title: `Solicitação de Ingresso para ${company.name}`,
                  body: requestMessage.trim() || `Gostaria de participar da empresa ${company.name}.`,
                  recipientsEmails: contacts,
                  onlyOwnersAndAdmins: true, // Enviar apenas para OWNERs e ADMINs
                });
                show({ type: 'success', message: 'Solicitação enviada com sucesso' });
                setShowRequestToJoinModal(false);
                setRequestContacts('');
                setRequestMessage('');
              } catch (err: any) {
                const m = getErrorMessage(err, 'Falha ao enviar solicitação');
                show({ type: 'error', message: m });
              }
            }}
          >
            <div>
              <label className="block text-sm text-gray-600 mb-1">Contatos (emails separados por vírgula)</label>
              <input
                type="text"
                value={requestContacts}
                onChange={(e) => setRequestContacts(e.target.value)}
                placeholder="kauan@gmail.com, rodrigo@gmail.com (deixe vazio para enviar a todos owners e admins)"
                className="border px-2 py-1 w-full text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Deixe vazio para enviar a todos os owners e admins da empresa</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Mensagem</label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Mensagem opcional"
                className="border px-2 py-1 w-full resize-none"
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRequestToJoinModal(false);
                  setRequestContacts('');
                  setRequestMessage('');
                }}
                className="px-3 py-1 border rounded text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Enviar Solicitação
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  const defaultLogo = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO ||  'https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png';
 
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <img
          src={logoError || !company.logoUrl ? defaultLogo : company.logoUrl}
          alt="Company logo"
          className="w-16 h-16 object-cover rounded"
          onError={() => setLogoError(true)}
        />
        <div>
          <h1 className="text-xl font-semibold">{company.name}</h1>
          {company.description && (
            <div className="text-sm text-gray-600">
              {company.is_public && !isMember ? (
                <span>{truncate(company.description, 400)}</span>
              ) : (
                <>
                  <span>{showFullDescription ? company.description : truncate(company.description, 400)}</span>
                  {company.description.length > 400 && (
                    <button
                      className="text-blue-600 underline ml-2"
                      onClick={() => setShowFullDescription((prev) => !prev)}
                    >
                      {showFullDescription ? 'Mostrar menos' : 'Ler mais'}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {isMember && (
            <div className="text-xs text-gray-500 mt-2 space-y-1">
              {company.createdAt && (roleQuery.data?.role === 'OWNER' || roleQuery.data?.role === 'ADMIN') && (
                <div>Criado: {formatDate(company.createdAt)}</div>
              )}
              {membersQuery.data?.total !== undefined && (
                <div>Membros: {membersQuery.data.total}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {message && <p className="text-green-700 text-sm">{message}</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {canLeave && (
        <button className="px-3 py-1 border rounded bg-red-600 text-white" onClick={() => setShowLeaveModal(true)}>
          Sair da empresa
        </button>
      )}
      {canSendNotification && (
        <button className="px-3 py-1 border rounded bg-blue-600 text-white flex items-center gap-1" onClick={() => setShowNotificationModal(true)}>
          <span className="text-sm">📢</span>
          Enviar mensagem global
        </button>
      )}
      {canTransferOwnership && (
        <button className="px-3 py-1 border rounded bg-purple-600 text-white flex items-center gap-1" onClick={() => setShowTransferModal(true)}>
          <span className="text-sm">⭐</span>
          Transferir Propriedade
        </button>
      )}
      {canManage && (
        <>
          <div className="flex gap-2 items-center">
            <button onClick={() => setShowInvite(s=>!s)} className="text-xs underline text-blue-600">
              {showInvite ? 'Ocultar formulário de convite' : 'Mostrar formulário de convite'}
            </button>
            {canEdit && (
              <button className="text-xs px-2 py-1 border rounded"
                      onClick={()=>{ setEditOpen(true); setEditName(company.name); setEditLogo(company.logoUrl || ''); setEditDescription(company.description || ''); setEditIsPublic(company.is_public); }}>Editar empresa
              </button>
            )}
            {canDelete && (
              <button className="text-xs px-2 py-1 border rounded border-red-600 text-red-700"
                      onClick={async ()=>{
                if(!confirm('Tem certeza que deseja excluir esta empresa? Esta ação não pode ser desfeita.')) return;
                try { await http.delete(`/company/${id}`); show({type:'success', message:'Empresa excluída'});
                    window.location.href = '/dashboard'; }
                catch(err){ const m=getErrorMessage(err,'Falha ao excluir empresa'); setError(m); show({type:'error', message:m});
                }
              }}>Excluir empresa</button>
            )}
          </div>
          {showInvite && <InviteForm companyId={id} onInvited={handleInvited} />}
        </>
      )}
      {inviteToken && (
        <div className="text-sm flex items-center gap-2">
          <span>Link de convite:</span>
          <code className="bg-gray-200 px-1 break-all">{inviteToken}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(inviteToken);             show({type:'info', message:'Link copiado!'}); }}
            className="px-2 py-0.5 border rounded text-xs"
          >Copiar link</button>
        </div>
      )}
      <Modal open={editOpen} title="Editar Empresa" onClose={()=>setEditOpen(false)}>
    <form className="space-y-3"
        onSubmit={async e=>{ e.preventDefault(); setSaving(true);
          setError(null); try { await http.patch(`/company/${id}`, {
            name: editName || undefined,
            logoUrl: editLogo || undefined,
            description: editDescription.trim().slice(0, 400) || undefined,
            is_public: editIsPublic
          });
            show({type:'success', message:'Empresa atualizada'}); setMessage('Empresa atualizada'); setEditOpen(false); await qc.invalidateQueries({ queryKey: ['company', id] });}
          catch(err){ const m=
            getErrorMessage(err,'Falha ao atualizar empresa'); setError(m); show({type:'error', message:m}); } finally {
            setSaving(false);} }}>
      <input value={editName}
         onChange={e=>setEditName(e.target.value)} placeholder="Novo nome" className="border px-2 py-1 w-full"/>
      <input value={editLogo}
         onChange={e=>setEditLogo(e.target.value)} placeholder="URL do logo" className="border px-2 py-1 w-full"/>
      <textarea value={editDescription}
          onChange={e=>setEditDescription(e.target.value)}
          placeholder="Descrição (máximo 400 caracteres)"
          maxLength={400}
          className="border px-2 py-1 w-full resize-none"/>
      <label className="flex items-center space-x-2">
        <input type="checkbox"
               checked={editIsPublic}
               onChange={e=>setEditIsPublic(e.target.checked)}
               className="rounded"/>
        <span>Empresa pública (visível para todos os usuários)</span>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button"
            onClick={()=>setEditOpen(false)} className="px-3 py-1 border rounded text-sm">Cancelar</button>
        <button disabled={saving} type="submit" className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
          {saving?'Salvando...':'Salvar'}</button>
      </div>
    </form>
  </Modal>
      <Modal open={showNotificationModal} title="Enviar Mensagem Global" onClose={() => setShowNotificationModal(false)}>
        <form className="space-y-3" onSubmit={async e => { e.preventDefault(); await sendNotificationMutation.mutateAsync({ title: notificationTitle, body: notificationBody, emails: notificationEmails }); }}>
          <input value={notificationTitle} onChange={e => setNotificationTitle(e.target.value)} placeholder="Assunto" className="border px-2 py-1 w-full" required />
          <textarea value={notificationBody} onChange={e => setNotificationBody(e.target.value)} placeholder="Mensagem" className="border px-2 py-1 w-full resize-none" required />
          <input value={notificationEmails} onChange={e => setNotificationEmails(e.target.value)} placeholder="Emails (separados por vírgula, deixe vazio para todos)" className="border px-2 py-1 w-full" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowNotificationModal(false)} className="px-3 py-1 border rounded text-sm">Cancelar</button>
            <button type="submit" disabled={sendNotificationMutation.isPending} className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50">
              {sendNotificationMutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </Modal>
      {membersQuery.isLoading || roleQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      ) : (
        <MemberList
          members={membersQuery.data?.members || members}
          currentRole={(roleQuery.data?.role ?? null) as any}
          currentUserId={profileQuery.data?.id}
          primaryOwnerUserId={primaryOwnerQuery.data?.primaryOwnerUserId || null}
          onDelete={async (m) => {
            setRemoveMemberConfirm(m);
          }}
          onChangeRole={async (m, role) => {
            await changeRoleMutation.mutateAsync({ member: m, role });
            show({ type: 'success', message: 'Role updated' });
          }}
          loadingIds={[]}
        />
      )}
      <ConfirmModal
        open={showLeaveModal}
        title="Sair da empresa?"
        onCancel={() => setShowLeaveModal(false)}
        onConfirm={() => leaveMutation.mutate()}
      >
        Você realmente deseja sair da empresa? Todos os administradores serão notificados.
      </ConfirmModal>
      <ConfirmModal
        open={!!removeMemberConfirm}
        title="Remover membro?"
        onCancel={() => setRemoveMemberConfirm(null)}
        onConfirm={() => {
          if (removeMemberConfirm) {
            removeMemberMutation.mutate(removeMemberConfirm);
          }
        }}
      >
        Tem certeza que deseja remover este membro da empresa? Esta ação não pode ser desfeita.
      </ConfirmModal>
      <Modal
        open={showTransferModal}
        title="Transferir Propriedade"
        onClose={() => {
          setShowTransferModal(false);
          setTransferToUserId('');
        }}
      >
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!transferToUserId.trim()) {
              show({ type: 'error', message: 'Por favor, selecione um membro' });
              return;
            }
            await transferOwnershipMutation.mutateAsync(transferToUserId);
          }}
        >
          <div>
            <label className="block text-sm text-gray-600 mb-1">Selecionar novo proprietário</label>
            <select
              value={transferToUserId}
              onChange={(e) => setTransferToUserId(e.target.value)}
              className="border px-2 py-1 w-full"
              required
            >
              <option value="">Selecione um membro...</option>
              {(membersQuery.data?.members || members)
                .filter((m: Member) => m.userId !== profileQuery.data?.id && m.role !== 'OWNER')
                .map((m: Member) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || 'Unknown'} ({m.email || m.userId}) - {m.role}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Você se tornará um ADMIN após transferir a propriedade.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowTransferModal(false);
                setTransferToUserId('');
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={transferOwnershipMutation.isPending || !transferToUserId}
              className="px-3 py-1 bg-purple-600 text-white rounded text-sm disabled:opacity-50"
            >
              {transferOwnershipMutation.isPending ? 'Transferindo...' : 'Transferir Propriedade'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

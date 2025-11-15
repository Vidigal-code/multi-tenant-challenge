"use client";
import React, { useEffect, useState } from 'react';
import { http } from '../../lib/http';
import { getErrorMessage } from '../../lib/error';
import { getSuccessMessage } from '../../lib/messages';
import { useToast } from '../../hooks/useToast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../components/Skeleton';
import { queryKeys } from '../../lib/queryKeys';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Modal } from '../../components/Modal';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Friendship {
  id: string;
  requester: User;
  addressee: User;
  status: string;
  createdAt: string;
}

export default function FriendsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'messages'>('friends');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [messageMode, setMessageMode] = useState<'selective' | 'global'>('selective');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const { show } = useToast();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: [queryKeys.profile()],
    queryFn: async () => {
      const { data } = await http.get('/auth/profile');
      return data;
    },
    staleTime: 60_000,
  });
  const currentUserId = profileQuery.data?.id;
  const currentUserEmail = profileQuery.data?.email?.toLowerCase?.();

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: queryKeys.friendships(),
    queryFn: async () => {
      const response = await http.get('/friendships?status=ACCEPTED');
      return response.data.data as Friendship[];
    },
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: async () => {
      const response = await http.get('/friendships?status=PENDING');
      const allRequests = response.data.data as Friendship[];
      return allRequests.filter((req) => {
        if (!req.addressee || !req.requester) return false;
        return req.addressee.id === currentUserId;
      });
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      const response = await http.get(`/friendships/search?q=${encodeURIComponent(query)}`);
      return response.data as User[];
    },
    onSuccess: (results) => {
      const filtered = results.filter(
        (user) =>
          user.id !== currentUserId &&
          user.email.toLowerCase() !== currentUserEmail,
      );
      setSearchResults(filtered);
      if (filtered.length === 0) {
        show({ message: 'User not found ❌', type: 'error' });
      }
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (email: string) => {
      await http.post('/friendships/request', { email });
    },
    onSuccess: () => {
      show({ message: getSuccessMessage('FRIEND_REQUEST_SENT'), type: 'success' });
      setSearchQuery('');
      setSearchResults([]);
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (error) => {
      const errorMsg = getErrorMessage(error);
      show({ message: errorMsg, type: 'error' });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await http.post(`/friendships/${friendshipId}/accept`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships() });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      show({ message: 'Solicitação de amizade aceita', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await http.delete(`/friendships/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      show({ message: 'Solicitação de amizade rejeitada', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      await http.delete(`/friendships/${friendshipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.friendships() });
      show({ message: 'Amigo removido', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery.trim());
    }
  };

  const handleSendRequest = (email: string) => {
    if (email.toLowerCase() === currentUserEmail) {
      show({ message: 'Você não pode enviar uma solicitação de amizade para si mesmo.', type: 'error' });
      return;
    }
    sendRequestMutation.mutate(email);
  };

  const handleAcceptRequest = (friendshipId: string) => {
    acceptRequestMutation.mutate(friendshipId);
  };

  const handleRejectRequest = (friendshipId: string) => {
    removeFriendMutation.mutate(friendshipId);
  };

  const handleRemoveFriend = () => {
    if (removeConfirm) {
      removeFriendMutation.mutate(removeConfirm);
      setRemoveConfirm(null);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ friendEmails, title, body }: { friendEmails: string[]; title: string; body: string }) => {
      // Enviar para cada amigo individualmente (com throttling para evitar sobrecarga)
      const results = [];
      for (let i = 0; i < friendEmails.length; i++) {
        try {
          await http.post('/notifications/friend', { friendEmail: friendEmails[i], title, body });
          results.push({ email: friendEmails[i], status: 'sent' });
          // Throttling: aguardar 100ms entre envios para evitar sobrecarga
          if (i < friendEmails.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err: any) {
          results.push({ email: friendEmails[i], status: 'failed', error: getErrorMessage(err) });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;
      if (failed === 0) {
        show({ type: 'success', message: `Mensagem enviada para ${sent} amigo(s)` });
      } else {
        show({ type: 'warning', message: `Enviado para ${sent}, falhou para ${failed}` });
      }
      setShowMessageModal(false);
      setSelectedFriend(null);
      setSelectedFriends([]);
      setMessageTitle('');
      setMessageBody('');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      show({ type: 'error', message: getErrorMessage(err, 'Falha ao enviar mensagem') });
    },
  });

  const handleSendMessage = (friend: User) => {
    setSelectedFriend(friend);
    setShowMessageModal(true);
  };

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    let friendEmails: string[] = [];
    
    if (messageMode === 'global') {
      // Enviar para todos os amigos
      friendEmails = friends
        .map(f => {
          const friend = f.requester.id === currentUserId ? f.addressee : f.requester;
          return friend?.email;
        })
        .filter(Boolean) as string[];
    } else {
      // Enviar apenas para amigos selecionados
      if (selectedFriend) {
        friendEmails = [selectedFriend.email];
      } else if (selectedFriends.length > 0) {
        friendEmails = selectedFriends.map(f => f.email);
      } else {
        show({ type: 'error', message: 'Selecione pelo menos um amigo' });
        return;
      }
    }
    
    if (friendEmails.length === 0) {
      show({ type: 'error', message: 'Nenhum amigo selecionado' });
      return;
    }
    
    await sendMessageMutation.mutateAsync({
      friendEmails,
      title: messageTitle,
      body: messageBody,
    });
  };

  useEffect(() => {
    let active = true;
    const unsubscribers: Array<() => void> = [];

    whenReady().then(() => {
      if (!active) return;
      const refetchFriendships = () => queryClient.invalidateQueries({ queryKey: queryKeys.friendships() });
      const refetchRequests = () => queryClient.invalidateQueries({ queryKey: ['friend-requests'] });

      unsubscribers.push(
        subscribe(RT_EVENTS.FRIEND_REQUEST_SENT, () => {
          refetchFriendships();
          refetchRequests();
        }),
      );
      unsubscribers.push(
        subscribe(RT_EVENTS.FRIEND_REQUEST_ACCEPTED, () => {
          refetchFriendships();
          refetchRequests();
        }),
      );
      unsubscribers.push(
        subscribe(RT_EVENTS.FRIEND_REMOVED, () => {
          refetchFriendships();
          refetchRequests();
        }),
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);

  const isLoading = friendsLoading || requestsLoading;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Amigos</h1>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Buscar usuários</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Digite um nome ou email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {searchMutation.isPending ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((user) => {
              if (!user || !user.id) {
                return null;
              }
              return (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <div className="font-medium">{user.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{user.email || ''}</div>
                  </div>
                  <button
                    onClick={() => handleSendRequest(user.email)}
                    disabled={sendRequestMutation.isPending}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    Enviar solicitação
                  </button>
                </div>
              );
            }).filter(Boolean)}
          </div>
        )}
      </div>

      <div className="mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 ${activeTab === 'friends' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Amigos ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 ${activeTab === 'requests' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Solicitações Pendentes ({requests.length})
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-4 py-2 ${activeTab === 'messages' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Enviar Mensagem
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : activeTab === 'friends' ? (
        <div className="space-y-4">
          {friends.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Você ainda não tem amigos
            </div>
          ) : (
            friends.map((friendship) => {
              if (!friendship.requester || !friendship.addressee) {
                return null;
              }
              const friend = friendship.requester.id === currentUserId ? friendship.addressee : friendship.requester;
              if (!friend || !friend.name) {
                return null;
              }
              return (
                <div key={friendship.id} className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <div className="font-medium">{friend.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{friend.email || ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSendMessage(friend)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                    Enviar Mensagem
                  </button>
                    <button
                      onClick={() => setRemoveConfirm(friendship.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)
          )}
        </div>
      ) : activeTab === 'messages' ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="messageMode"
                checked={messageMode === 'selective'}
                onChange={() => setMessageMode('selective')}
                className="rounded"
              />
              <span>Envio Seletivo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="messageMode"
                checked={messageMode === 'global'}
                onChange={() => setMessageMode('global')}
                className="rounded"
              />
              <span>Envio Global (todos os amigos)</span>
            </label>
          </div>
          
          {messageMode === 'selective' && (
            <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-2">
              {friends.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nenhum amigo disponível</p>
              ) : (
                friends.map((friendship) => {
                  const friend = friendship.requester.id === currentUserId ? friendship.addressee : friendship.requester;
                  if (!friend) return null;
                  const isSelected = selectedFriends.some(f => f.id === friend.id);
                  return (
                    <label key={friendship.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFriends([...selectedFriends, friend]);
                          } else {
                            setSelectedFriends(selectedFriends.filter(f => f.id !== friend.id));
                          }
                        }}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{friend.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-600">{friend.email || ''}</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          )}
          
          {messageMode === 'global' && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-sm text-blue-800">
                <strong>Modo Global Ativo:</strong> A mensagem será enviada para todos os {friends.length} amigo(s) na lista.
              </p>
            </div>
          )}
          
          <button
            onClick={() => {
              if (messageMode === 'selective' && selectedFriends.length === 0) {
                show({ type: 'error', message: 'Selecione pelo menos um amigo antes de enviar' });
                return;
              }
              setSelectedFriend(null);
              // Não limpar selectedFriends aqui - manter seleção ao abrir modal
              setMessageTitle('');
              setMessageBody('');
              setShowMessageModal(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            disabled={friends.length === 0 || (messageMode === 'selective' && selectedFriends.length === 0)}
          >
            {messageMode === 'global' ? 'Enviar Mensagem Global' : 'Enviar Mensagem Seletiva'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Nenhuma solicitação pendente
            </div>
          ) : (
            requests.map((request) => {
              if (!request.requester || !request.requester.name) {
                return null;
              }
              if (request.addressee?.id !== currentUserId) {
                return null;
              }
              return (
                <div key={request.id} className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <div className="font-medium">{request.requester.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600">{request.requester.email || ''}</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={acceptRequestMutation.isPending}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={removeFriendMutation.isPending}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)
          )}
        </div>
      )}

      <ConfirmModal
        open={!!removeConfirm}
        title="Remover amigo"
        onConfirm={handleRemoveFriend}
        onCancel={() => setRemoveConfirm(null)}
      >
        Tem certeza que deseja remover este amigo?
      </ConfirmModal>

      <Modal open={showMessageModal} title={messageMode === 'global' ? 'Enviar Mensagem Global' : 'Enviar Mensagem Seletiva'} onClose={() => {
        setShowMessageModal(false);
        setSelectedFriend(null);
        setSelectedFriends([]);
        setMessageTitle('');
        setMessageBody('');
      }}>
        <form className="space-y-3" onSubmit={handleSubmitMessage}>
          {messageMode === 'selective' && selectedFriends.length > 0 && (
            <div className="mb-3 bg-gray-50 p-2 rounded">
              <div className="text-sm text-gray-600 mb-1">Para ({selectedFriends.length} amigo(s)):</div>
              <div className="text-xs text-gray-500 max-h-32 overflow-y-auto">
                {selectedFriends.map(f => (
                  <div key={f.id}>{f.name} ({f.email})</div>
                ))}
              </div>
            </div>
          )}
          {messageMode === 'global' && (
            <div className="mb-3 bg-blue-50 p-2 rounded">
              <div className="text-sm text-blue-800">
                <strong>Enviando para todos os {friends.length} amigo(s)</strong>
              </div>
            </div>
          )}
          <input
            value={messageTitle}
            onChange={e => setMessageTitle(e.target.value)}
            placeholder="Assunto"
            className="border px-2 py-1 w-full"
            required
          />
          <textarea
            value={messageBody}
            onChange={e => setMessageBody(e.target.value)}
            placeholder="Mensagem"
            className="border px-2 py-1 w-full resize-none"
            rows={5}
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowMessageModal(false);
                setSelectedFriend(null);
                setSelectedFriends([]);
                setMessageTitle('');
                setMessageBody('');
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sendMessageMutation.isPending || (messageMode === 'selective' && selectedFriends.length === 0 && !selectedFriend)}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
            >
              {sendMessageMutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getErrorMessage } from "../../lib/error";
import { getSuccessMessage } from "../../lib/messages";
import { useToast } from "../../hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import Skeleton from "../../components/skeleton/Skeleton";
import { ConfirmModal } from "../../components/modals/ConfirmModal";
import { Modal } from "../../components/modals/Modal";
import { RT_EVENTS, subscribe, whenReady } from "../../lib/realtime";
import { MdChevronLeft, MdChevronRight } from "react-icons/md";
import { useParams } from "next/navigation";
import {
    type Friendship,
    useAcceptFriendRequest,
    useFriendRequests,
    useFriendships,
    useProfile,
    type User,
    useRemoveFriend,
    useSearchUsers,
    useSendFriendNotification,
    useSendFriendRequest
} from "../../services/api";

export default function FriendsPage() {

    const params = useParams();
    const requestId = params?.id as string | undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'messages'>(requestId ? 'requests' : 'friends');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [messageMode, setMessageMode] = useState<'selective' | 'global'>('selective');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [selectedFriendsIds, setSelectedFriendsIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [friendsPage, setFriendsPage] = useState(1);
  const [requestsPage, setRequestsPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [searchResultsPage, setSearchResultsPage] = useState(1);
  const itemsPerPage = 3;
  const { show } = useToast();
  const queryClient = useQueryClient();

  const profileQuery = useProfile();
  const currentUserId = profileQuery.data?.id;
  const currentUserEmail = profileQuery.data?.email?.toLowerCase?.();

  const { data: friends = [], isLoading: friendsLoading } = useFriendships('ACCEPTED');
  const { data: allRequests = [], isLoading: requestsLoading } = useFriendRequests();
  
  const requests = allRequests.filter((req) => {
    if (!req.addressee || !req.requester) return false;
    return req.addressee.id === currentUserId;
  });

  const filteredRequests = useMemo(() => {
    if (requestId) {
      return requests.filter(req => req.id === requestId);
    }
    return requests;
  }, [requests, requestId]);

  const allTabs = useMemo(() => [
    { id: 'friends', label: `Amigos (${friends.length})` },
    { id: 'requests', label: `Solicitações Pendentes (${requestId ? filteredRequests.length : requests.length})` },
    { id: 'messages', label: 'Enviar Mensagem' },
  ], [friends.length, requests.length, filteredRequests.length, requestId]);

  useEffect(() => {
    if (requestId) {
      setActiveTab('requests');
    }
  }, [requestId]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const maxVisibleTabs = useMemo(() => isMobile ? 1 : 3, [isMobile]);

  useEffect(() => {
    const currentActiveIndex = allTabs.findIndex(tab => tab.id === activeTab);
    if (currentActiveIndex !== -1 && allTabs.length > 0) {
      const maxStart = Math.max(0, allTabs.length - maxVisibleTabs);
      const newTabIndex = Math.max(0, Math.min(currentActiveIndex, maxStart));
      
      setTabIndex(prev => {
        const currentStart = Math.max(0, Math.min(prev, maxStart));
        const currentEnd = currentStart + maxVisibleTabs;
        
        if (currentActiveIndex < currentStart || currentActiveIndex >= currentEnd) {
          return newTabIndex;
        }
        return prev;
      });
    }
  }, [activeTab, allTabs, maxVisibleTabs]);

  useEffect(() => {
    setFriendsPage(1);
  }, [activeTab]);

  useEffect(() => {
    setRequestsPage(1);
  }, [activeTab]);

  useEffect(() => {
    setMessagesPage(1);
  }, [activeTab]);

  const startTabIndex = useMemo(() => {
    return Math.max(0, Math.min(tabIndex, Math.max(0, allTabs.length - maxVisibleTabs)));
  }, [tabIndex, allTabs.length, maxVisibleTabs]);

  const visibleTabsSlice = useMemo(() => {
    return allTabs.slice(startTabIndex, startTabIndex + maxVisibleTabs);
  }, [allTabs, startTabIndex, maxVisibleTabs]);

  const handlePreviousTab = () => {
    setTabIndex(prev => {
      const newIndex = Math.max(0, prev - 1);
      return newIndex;
    });
  };

  const handleNextTab = () => {
    setTabIndex(prev => {
        return Math.min(Math.max(0, allTabs.length - maxVisibleTabs), prev + 1);
    });
  };

  const searchMutation = useSearchUsers();
  const sendRequestMutation = useSendFriendRequest();
  const acceptRequestMutation = useAcceptFriendRequest();
  const removeFriendMutation = useRemoveFriend();
  const sendMessageMutation = useSendFriendNotification();

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery.trim(), {
        onSuccess: (results) => {
          const filtered = results.filter(
            (user) =>
              user.id !== currentUserId &&
              user.email.toLowerCase() !== currentUserEmail,
          );
          setSearchResults(filtered);
          setSearchResultsPage(1);
          if (filtered.length === 0) {
            show({ message: 'Usuário não encontrado', type: 'error' });
          }
        },
        onError: (error) => {
          show({ message: getErrorMessage(error), type: 'error' });
        },
      });
    }
  };

  const handleSendRequest = (email: string) => {
    if (email.toLowerCase() === currentUserEmail) {
      show({ message: 'Você não pode enviar uma solicitação de amizade para si mesmo.', type: 'error' });
      return;
    }
    sendRequestMutation.mutate(email, {
      onSuccess: () => {
        show({ message: getSuccessMessage('FRIEND_REQUEST_SENT'), type: 'success' });
        setSearchQuery('');
        setSearchResults([]);
      },
      onError: (error) => {
        const errorMsg = getErrorMessage(error);
        show({ message: errorMsg, type: 'error' });
      },
    });
  };

  const handleAcceptRequest = (friendshipId: string) => {
    acceptRequestMutation.mutate(friendshipId, {
      onSuccess: () => {
        show({ message: 'Solicitação de amizade aceita', type: 'success' });
      },
      onError: (error) => {
        show({ message: getErrorMessage(error), type: 'error' });
      },
    });
  };

  const handleRejectRequest = (friendshipId: string) => {
    removeFriendMutation.mutate(friendshipId, {
      onSuccess: () => {
        show({ message: 'Solicitação rejeitada', type: 'success' });
      },
      onError: (error) => {
        show({ message: getErrorMessage(error), type: 'error' });
      },
    });
  };

  const handleRemoveFriend = () => {
    if (removeConfirm) {
      removeFriendMutation.mutate(removeConfirm, {
        onSuccess: () => {
          setRemoveConfirm(null);
          setSelectedFriendsIds(prev => prev.filter(id => id !== removeConfirm));
          show({ message: 'Amigo removido', type: 'success' });
        },
        onError: (error) => {
          show({ message: getErrorMessage(error), type: 'error' });
        },
      });
    }
  };

  function handleSelectAll(items: Friendship[]) {
    setSelectedFriendsIds(items.map(i => i.id));
  }

  async function handleDelete(ids: string[]) {
    setShowDeleteModal(false);
    if (ids.length === 1) {
      removeFriendMutation.mutate(ids[0], {
        onSuccess: () => {
          setSelectedFriendsIds(prev => prev.filter(id => id !== ids[0]));
          setDeleteIds([]);
          show({ message: 'Amigo removido', type: 'success' });
        },
        onError: (err: any) => {
          const m = getErrorMessage(err, 'Não foi possível remover o amigo');
          show({ type: 'error', message: m });
        },
      });
    } else {
      const results = [];
      for (let i = 0; i < ids.length; i++) {
        try {
          await removeFriendMutation.mutateAsync(ids[i]);
          results.push({ id: ids[i], status: 'success' });
          if (i < ids.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (err: any) {
          results.push({ id: ids[i], status: 'failed', error: getErrorMessage(err) });
        }
      }
      
      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      
      setSelectedFriendsIds(prev => prev.filter(id => !ids.includes(id)));
      setDeleteIds([]);
      
      if (failedCount === 0) {
        show({ message: `${successCount} amigo(s) removido(s)`, type: 'success' });
      } else {
        show({ message: `${successCount} removido(s), ${failedCount} falhou(ram)`, type: 'warning' });
      }
    }
  }

  const handleSendMessage = (friend: User) => {
    setSelectedFriend(friend);
    setShowMessageModal(true);
  };

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    let friendEmails: string[] = [];
    
    if (messageMode === 'global') {
      friendEmails = friends
        .map(f => {
          const friend = f.requester.id === currentUserId ? f.addressee : f.requester;
          return friend?.email;
        })
        .filter(Boolean) as string[];
    } else {
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
    
    const results = [];
    for (let i = 0; i < friendEmails.length; i++) {
      try {
        await sendMessageMutation.mutateAsync({
          friendEmail: friendEmails[i],
          title: messageTitle,
          body: messageBody,
        });
        results.push({ email: friendEmails[i], status: 'sent' });
        if (i < friendEmails.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (err: any) {
        results.push({ email: friendEmails[i], status: 'failed', error: getErrorMessage(err) });
      }
    }
    
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
  };

  useEffect(() => {
    let active = true;
    const unsubscribers: Array<() => void> = [];

    whenReady().then(() => {
      if (!active) return;
      const refetchFriendships = () => queryClient.invalidateQueries({ queryKey: ['friendships'] });
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 w-full min-w-0">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Amigos</h1>
        <p className="text-gray-600 dark:text-gray-400">Conecte-se com outros usuários e gerencie suas amizades</p>
      </div>

      <div className="mb-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-3 text-gray-900 dark:text-white">Buscar usuários</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Digite um nome ou email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-800
            rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white
            placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none
            focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"
          />
          <button
            onClick={handleSearch}
            disabled={searchMutation.isPending}
            className="px-4 py-3 bg-gray-900 dark:bg-white
            text-white dark:text-gray-900 rounded-lg
            hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
          >
            {searchMutation.isPending ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        {searchResults.length > 0 && (() => {
          const startIndex = (searchResultsPage - 1) * itemsPerPage;
          const endIndex = startIndex + itemsPerPage;
          const paginatedResults = searchResults.slice(startIndex, endIndex);
          const totalPages = Math.max(1, Math.ceil(searchResults.length / itemsPerPage));
          
          return (
            <>
              <div className="mt-4 space-y-3">
                {paginatedResults.map((user) => {
                  if (!user || !user.id) {
                    return null;
                  }
                  return (
                    <div key={user.id} className="flex flex-col sm:flex-row
                     items-start sm:items-center justify-between gap-3 p-4
                     border border-gray-200 dark:border-gray-800 rounded-lg
                     bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">{user.name || 'Unknown'}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{user.email || ''}</div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.email)}
                        disabled={sendRequestMutation.isPending}
                        className="px-4 py-2 bg-gray-900 dark:bg-white
                        text-white dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800
                        dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                        font-medium whitespace-nowrap flex-shrink-0"
                      >
                        Enviar solicitação
                      </button>
                    </div>
                  );
                }).filter(Boolean)}
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t
                border-gray-200 dark:border-gray-800 mt-4">
                  <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                    <button
                      className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                      text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors text-sm font-medium"
                      onClick={() => setSearchResultsPage(p => Math.max(1, p - 1))}
                      disabled={searchResultsPage === 1}
                    >
                      Avançar
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Página {searchResultsPage} de {totalPages}</span>
                    <button
                      className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                      text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50
                      disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      onClick={() => setSearchResultsPage(p => p + 1)}
                      disabled={searchResultsPage >= totalPages}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-800 w-full">
          <div className="flex items-center gap-2 w-full justify-center">
            {startTabIndex > 0 && (
              <button
                onClick={handlePreviousTab}
                className="flex-shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-800
                hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                aria-label="Aba anterior"
              >
                <MdChevronLeft className="text-xl text-gray-600 dark:text-gray-400" />
              </button>
            )}
            
            <nav className="flex-1 flex justify-center items-center space-x-1 overflow-x-auto scrollbar-hide" aria-label="Tabs">
              {visibleTabsSlice.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'friends' | 'requests' | 'messages')}
                  className={`
                    flex items-center justify-center gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium
                     whitespace-nowrap border-b-2 transition-colors flex-shrink-0 w-full sm:w-auto
                    ${activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 ' +
                      'dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <span className="text-xs sm:text-sm text-center">{tab.label}</span>
                </button>
              ))}
            </nav>

            {(startTabIndex + maxVisibleTabs < allTabs.length) && allTabs.length > maxVisibleTabs && (
              <button
                onClick={handleNextTab}
                className="flex-shrink-0 p-2 rounded-lg border border-gray-200 dark:border-gray-800 hover:bg-gray-50
                dark:hover:bg-gray-900 transition-colors"
                aria-label="Próxima aba"
              >
                <MdChevronRight className="text-xl text-gray-600 dark:text-gray-400" />
              </button>
            )}
          </div>
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
            <div className="text-center text-gray-600 dark:text-gray-400 py-12
            sm:py-16 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">
              <p className="text-sm sm:text-base">Você ainda não tem amigos</p>
            </div>
          ) : (() => {
            const startIndex = (friendsPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedFriends = friends.slice(startIndex, endIndex);
            const totalPages = Math.max(1, Math.ceil(friends.length / itemsPerPage));
            
            return (
              <>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4 justify-center">
                  <button 
                    className="w-full sm:w-auto px-3 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                    text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors
                    text-sm font-medium whitespace-nowrap"
                    onClick={() => handleSelectAll(friends)}
                  >
                    Selecionar todos
                  </button>
                  <button 
                    className="w-full sm:w-auto px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white
                    dark:bg-gray-950 text-red-600
                     dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                      text-sm font-medium whitespace-nowrap"
                    disabled={!selectedFriendsIds.length} 
                    onClick={() => { 
                      setDeleteIds(selectedFriendsIds); 
                      setShowDeleteModal(true); 
                    }}
                  >
                    Deletar selecionados
                  </button>
                  <button 
                    className="w-full sm:w-auto px-3 py-2 border border-red-200 dark:border-red-800 rounded-lg bg-white
                    dark:bg-gray-950 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors text-sm font-medium whitespace-nowrap"
                    disabled={!friends.length} 
                    onClick={() => { 
                      setDeleteIds(friends.map(f => f.id)); 
                      setShowDeleteModal(true); 
                    }}
                  >
                    Limpar todos
                  </button>
                </div>
                {paginatedFriends.map((friendship) => {
              if (!friendship.requester || !friendship.addressee) {
                return null;
              }
              const friend = friendship.requester.id === currentUserId ? friendship.addressee : friendship.requester;
              if (!friend || !friend.name) {
                return null;
              }
              return (
                <div key={friendship.id} className="flex flex-col
                 sm:flex-row items-start sm:items-center justify-between
                 gap-3 p-4 sm:p-6 border border-gray-200 dark:border-gray-800
                 rounded-lg bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={selectedFriendsIds.includes(friendship.id)} 
                      onChange={e => {
                        setSelectedFriendsIds(sel => e.target.checked ? [...sel, friendship.id]
                            : sel.filter(sid => sid !== friendship.id));
                      }} 
                      className="mt-1 flex-shrink-0 w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900
                      dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 dark:text-white text-base sm:text-lg mb-1">{friend.name || 'Unknown'}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">{friend.email || ''}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleSendMessage(friend)}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-gray-900
                      dark:bg-white text-white dark:text-gray-900 text-sm rounded-lg
                       hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium whitespace-nowrap"
                    >
                      Enviar Mensagem
                    </button>
                    <button
                      onClick={() => setRemoveConfirm(friendship.id)}
                      className="flex-1 sm:flex-initial px-4 py-2 border
                      border-red-200 dark:border-red-800 rounded-lg bg-white dark:bg-gray-950
                      text-red-600 dark:text-red-400 hover:bg-red-50
                      dark:hover:bg-red-900/20 text-sm transition-colors font-medium whitespace-nowrap"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                    <button
                      className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                      text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50
                      disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      onClick={() => setFriendsPage(p => Math.max(1, p - 1))}
                      disabled={friendsPage === 1}
                    >
                      Avançar
                    </button>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Página {friendsPage} de {totalPages}</span>
                    <button
                      className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                      text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900
                      disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      onClick={() => setFriendsPage(p => p + 1)}
                      disabled={friendsPage >= totalPages}
                    >
                      Próximo
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : activeTab === 'messages' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="messageMode"
                checked={messageMode === 'selective'}
                onChange={() => setMessageMode('selective')}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900
                dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
              />
              <span className="text-sm sm:text-base text-gray-900 dark:text-white">Envio Seletivo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="messageMode"
                checked={messageMode === 'global'}
                onChange={() => setMessageMode('global')}
                className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900
                dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
              />
              <span className="text-sm sm:text-base text-gray-900 dark:text-white">Envio Global (todos os amigos)</span>
            </label>
          </div>
          
          {messageMode === 'selective' && (
            <>
              <div className="space-y-2 border border-gray-200
               dark:border-gray-800 rounded-lg p-3 bg-white dark:bg-gray-950">
                {friends.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">Nenhum amigo disponível</p>
                ) : (() => {
                  const startIndex = (messagesPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedFriends = friends.slice(startIndex, endIndex);
                  
                  return paginatedFriends.map((friendship) => {
                    const friend = friendship.requester.id === currentUserId ? friendship.addressee : friendship.requester;
                    if (!friend) return null;
                    const isSelected = selectedFriends.some(f => f.id === friend.id);
                    return (
                      <label key={friendship.id} className="flex items-center gap-3 p-3
                      hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer rounded-lg transition-colors">
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
                          className="w-4 h-4 rounded border-gray-300 dark:border-gray-700 text-gray-900
                          dark:text-white focus:ring-2 focus:ring-gray-900 dark:focus:ring-white"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white text-sm sm:text-base truncate">{friend.name || 'Unknown'}</div>
                          <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{friend.email || ''}</div>
                        </div>
                      </label>
                    );
                  });
                })()}
              </div>
              {(() => {
                const totalPages = Math.max(1, Math.ceil(friends.length / itemsPerPage));
                return (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                      <button
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                        text-gray-900 dark:text-white hover:bg-gray-50
                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        onClick={() => setMessagesPage(p => Math.max(1, p - 1))}
                        disabled={messagesPage === 1}
                      >
                        Avançar
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Página {messagesPage} de {totalPages}</span>
                      <button
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                        text-gray-900 dark:text-white hover:bg-gray-50
                        dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        onClick={() => setMessagesPage(p => p + 1)}
                        disabled={messagesPage >= totalPages}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
          
          {messageMode === 'global' && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm sm:text-base text-blue-800 dark:text-blue-300">
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
              setMessageTitle('');
              setMessageBody('');
              setShowMessageModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900
            rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors font-medium text-sm sm:text-base"
            disabled={friends.length === 0 || (messageMode === 'selective' && selectedFriends.length === 0)}
          >
            {messageMode === 'global' ? 'Enviar Mensagem Global' : 'Enviar Mensagem Seletiva'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-gray-400 py-12 sm:py-16
             border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900">
              <p className="text-sm sm:text-base">{requestId ? 'Solicitação não encontrada' : 'Nenhuma solicitação pendente'}</p>
            </div>
          ) : (() => {

            const displayRequests = requestId ? filteredRequests :
                filteredRequests.slice((requestsPage - 1) * itemsPerPage, requestsPage * itemsPerPage);

            const totalPages = requestId ? 1 : Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
            
            return (
              <>
                {displayRequests.map((request) => {
              if (!request.requester || !request.requester.name) {
                return null;
              }
              if (request.addressee?.id !== currentUserId) {
                return null;
              }
              return (
                <div key={request.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 sm:p-6 border
                border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900
                transition-colors">
                  <div className="min-w-0 flex-1 w-full sm:w-auto">
                    <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono
                    text-center sm:text-left">id:{request.id}</div>
                    <div className="font-medium text-gray-900 dark:text-white text-base sm:text-lg mb-1 text-center sm:text-left">
                        {request.requester.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 truncate text-center sm:text-left">{request.requester.email || ''}</div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleAcceptRequest(request.id)}
                      disabled={acceptRequestMutation.isPending}
                      className="flex-1 sm:flex-initial px-4 py-2 bg-gray-900 dark:bg-white text-white
                      dark:text-gray-900 text-sm rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50
                       disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleRejectRequest(request.id)}
                      disabled={removeFriendMutation.isPending}
                      className="flex-1 sm:flex-initial px-4 py-2 border border-gray-200 dark:border-gray-800
                      rounded-lg bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 hover:bg-gray-50
                      dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm transition-colors font-medium whitespace-nowrap"
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            }).filter(Boolean)}
                {!requestId && filteredRequests.length > itemsPerPage && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2 flex-wrap justify-center w-full">
                      <button
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                        text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50
                        disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        onClick={() => setRequestsPage(p => Math.max(1, p - 1))}
                        disabled={requestsPage === 1}
                      >
                        Avançar
                      </button>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Página {requestsPage} de {totalPages}</span>
                      <button
                        className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white dark:bg-gray-950
                        text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors text-sm font-medium"
                        onClick={() => setRequestsPage(p => p + 1)}
                        disabled={requestsPage >= totalPages}
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
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
      <ConfirmModal 
        open={showDeleteModal} 
        title="Remover amigos?" 
        onCancel={()=>{setShowDeleteModal(false); setDeleteIds([]);}} 
        onConfirm={()=>handleDelete(deleteIds)}
      >
        Tem certeza que deseja remover {deleteIds.length} amigo(s)? Esta ação não pode ser desfeita.
      </ConfirmModal>
      <Modal open={showMessageModal} title={messageMode === 'global' ? 'Enviar Mensagem Global' : 'Enviar Mensagem Seletiva'} onClose={() => {
        setShowMessageModal(false);
        setSelectedFriend(null);
        setSelectedFriends([]);
        setMessageTitle('');
        setMessageBody('');
      }}>
        <form className="space-y-4" onSubmit={handleSubmitMessage}>
          {messageMode === 'selective' && selectedFriends.length > 0 && (
            <div className="mb-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-lg">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Para ({selectedFriends.length}) amigo:</div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto space-y-1">
                {selectedFriends.map(f => (
                  <div key={f.id} className="truncate">{f.name} ({f.email})</div>
                ))}
              </div>
            </div>
          )}
          {messageMode === 'global' && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <div className="text-sm sm:text-base font-medium text-blue-800 dark:text-blue-300">
                Enviando para todos os {friends.length} amigos
              </div>
            </div>
          )}
          <div>
            <input
              value={messageTitle}
              onChange={e => setMessageTitle(e.target.value)}
              placeholder="Assunto"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
              dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-colors"
              required
            />
          </div>
          <div>
            <textarea
              value={messageBody}
              onChange={e => setMessageBody(e.target.value)}
              placeholder="Mensagem"
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
              dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
               focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent resize-none transition-colors"
              rows={5}
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowMessageModal(false);
                setSelectedFriend(null);
                setSelectedFriends([]);
                setMessageTitle('');
                setMessageBody('');
              }}
              className="px-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-white
              dark:bg-gray-950 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-900
              transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sendMessageMutation.isPending || (messageMode === 'selective' && selectedFriends.length === 0 && !selectedFriend)}
              className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg
               hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
            >
              {sendMessageMutation.isPending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
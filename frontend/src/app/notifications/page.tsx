"use client";
import React, { useEffect, useState } from 'react';
import { http } from '../../lib/http';
import { getErrorMessage } from '../../lib/error';
import { useToast } from '../../hooks/useToast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Skeleton from '../../components/Skeleton';
import { queryKeys } from '../../lib/queryKeys';
import { ConfirmModal } from '../../components/ConfirmModal';
import { subscribe, whenReady, RT_EVENTS } from '../../lib/realtime';
import { formatNotificationMessage, getNotificationStyle, NotificationData } from '../../lib/notification-messages';
import { formatDate } from '../../lib/date-utils';

type Notification = NotificationData;

function truncate(text: string, max: number) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

export default function NotificationsPage() {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedNotifications, setExpandedNotifications] = useState<Record<string, boolean>>({});
  const { show } = useToast();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: queryKeys.notifications(),
    queryFn: async () => {
      const response = await http.get('/notifications');
      const items = (response.data.items ?? []) as Notification[];
      const notificationsWithSenders = await Promise.all(
        items.map(async (notif) => {
          if (notif.meta?.sender) {
            return notif;
          }
          try {
            return notif;
          } catch {
            return notif;
          }
        })
      );
      return notificationsWithSenders;
    },
  });

  useEffect(() => {
    let active = true;
    const unsubscribers: Array<() => void> = [];

    whenReady().then(() => {
      if (!active) return;
      const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_CREATED, refetch));
      unsubscribers.push(subscribe(RT_EVENTS.NOTIFICATION_READ, refetch));
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await http.patch(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      show({ message: 'Notification marked as read', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await http.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications() });
      show({ message: 'Notification deleted', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      await http.post(`/notifications/${id}/reply`, { replyBody: body });
    },
    onSuccess: () => {
      setReplyingTo(null);
      setReplyBody('');
      show({ message: 'Reply sent', type: 'success' });
    },
    onError: (error) => {
      show({ message: getErrorMessage(error), type: 'error' });
    },
  });

  const handleReply = () => {
    if (!replyBody.trim()) {
      show({ message: 'Please enter a reply', type: 'error' });
      return;
    }
    if (replyingTo) {
      replyMutation.mutate({ id: replyingTo, body: replyBody.trim() });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Notifications</h1>
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-32 mb-4" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="border rounded p-6 text-center text-gray-500">
          No notifications found
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border rounded p-4 ${notification.read ? '' : 'border-blue-500 bg-blue-50'}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span className={getNotificationStyle(notification.meta?.kind).color}>
                      {getNotificationStyle(notification.meta?.kind).icon}
                    </span>
                    {formatNotificationMessage(notification)}
                    {!notification.read && (
                      <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                        New
                      </span>
                    )}
                    {notification.meta?.kind === 'notification.reply' && (
                      <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                        Reply
                      </span>
                    )}
                  </h3>
                  <div className="text-sm text-gray-600 mt-2 space-y-1">
                    <div className="bg-gray-50 p-2 rounded">
                      <div><strong>From:</strong> {notification.meta?.sender?.name || 'Unknown User'}</div>
                      <div><strong>Email:</strong> {notification.meta?.sender?.email || notification.senderUserId || 'N/A'}</div>
                      <div><strong>Data e Hora:</strong> {formatDate(notification.createdAt)}</div>
                      {notification.meta?.channel && (
                        <div><strong>Channel:</strong> {notification.meta.channel}</div>
                      )}
                      {notification.companyId && (
                        <div><strong>Company ID:</strong> {notification.companyId}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {!notification.read && (
                    <button
                      onClick={() => markReadMutation.mutate(notification.id)}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                      disabled={markReadMutation.isPending}
                    >
                      Mark as read
                    </button>
                  )}
                  <button
                    onClick={() => setReplyingTo(notification.id)}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                  >
                    Reply
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(notification.id)}
                    className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <p className="text-gray-700">
                  {expandedNotifications[notification.id] ? notification.body : truncate(notification.body, 400)}
                  {notification.body.length > 400 && (
                    <button
                      className="text-blue-600 underline ml-2 text-sm"
                      onClick={() =>
                        setExpandedNotifications((prev) => ({
                          ...prev,
                          [notification.id]: !prev[notification.id],
                        }))
                      }
                    >
                      {expandedNotifications[notification.id] ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </p>
                {notification.meta?.kind === 'notification.reply' && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    This is a reply to a previous notification
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {replyingTo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Reply to Notification</h3>
            {(() => {
              const notification = notifications.find(n => n.id === replyingTo);
              return notification ? (
                <div className="mb-4 space-y-3 p-4 bg-gray-50 rounded border">
                  <div className="space-y-1">
                    <div className="text-sm">
                      <strong>Subject:</strong> <span className="text-gray-700">{notification.title}</span>
                    </div>
                    <div className="text-sm">
                      <strong>From:</strong> <span className="text-gray-700">{notification.meta?.sender?.name || 'Unknown User'}</span>
                    </div>
                    <div className="text-sm">
                      <strong>Email:</strong> <span className="text-gray-700">{notification.meta?.sender?.email || notification.senderUserId || 'N/A'}</span>
                    </div>
                    <div className="text-sm">
                      <strong>Date & Time:</strong> <span className="text-gray-700">{new Date(notification.createdAt).toLocaleString()}</span>
                    </div>
                    {notification.companyId && (
                      <div className="text-sm">
                        <strong>Company ID:</strong> <span className="text-gray-700">{notification.companyId}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <strong className="text-sm">Original Message:</strong>
                    <p className="text-sm text-gray-700 mt-1 p-2 bg-white rounded">{notification.body}</p>
                  </div>
                </div>
              ) : null;
            })()}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Reply</label>
              <textarea
                placeholder="Type your reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full p-2 border rounded resize-none"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Your reply will be sent to: {(() => {
                  const notification = notifications.find(n => n.id === replyingTo);
                  return notification ? (
                    <span className="font-medium">
                      {notification.meta?.sender?.name || 'Unknown'} ({notification.meta?.sender?.email || notification.senderUserId || 'N/A'})
                    </span>
                  ) : 'the original sender';
                })()}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setReplyBody('');
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleReply}
                disabled={replyMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
              >
                {replyMutation.isPending ? 'Sending...' : 'Send Reply'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteConfirm}
        title="Delete Notification"
        onConfirm={() => {
          if (deleteConfirm) {
            deleteMutation.mutate(deleteConfirm);
            setDeleteConfirm(null);
          }
        }}
        onCancel={() => setDeleteConfirm(null)}
      >
        Are you sure you want to delete this notification? This action cannot be undone.
      </ConfirmModal>
    </div>
  );
}
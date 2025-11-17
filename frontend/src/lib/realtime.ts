import { io, Socket } from 'socket.io-client';
import { api } from '../api/apiClient';

export const RT_EVENTS = {
  COMPANY_UPDATED: 'companys.updated',
  MEMBER_JOINED: 'member.joined',
  MEMBER_LEFT: 'member.left',
  NOTIFICATION_CREATED: 'notifications.created',
  INVITE_REJECTED: 'invites.rejected',
  INVITE_ACCEPTED: 'invites.accepted',
  NOTIFICATION_READ: 'notifications.read',
  FRIEND_REQUEST_SENT: 'friend.request.sent',
  FRIEND_REQUEST_ACCEPTED: 'friend.request.accepted',
  FRIEND_REMOVED: 'friend.removed',
  NOTIFICATION_DELIVERED: 'notifications.delivered',
  NOTIFICATION_DELIVERY_FAILED: 'notifications.delivery.failed',
} as const;

let socket: Socket | null = null;
let readyPromise: Promise<void> | null = null;

async function handshake() {
  const res = await api.get('/realtimes/rooms');
  return res.data as { userRoom: string; companyRooms: string[]; events: Record<string,string>; namespace: string };
}

export function getRealtimeSocket() {
  if (socket) return socket;
  // Use WS URL if defined, otherwise use API URL, otherwise fallback to current origin
  const base = process.env.NEXT_PUBLIC_WS_URL || 
               process.env.NEXT_PUBLIC_API_URL || 
               (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
  const namespace = '/rt';
  socket = io(base + namespace, {
    withCredentials: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    transports: ['websocket'],
  });
  readyPromise = new Promise((resolve) => {
    socket!.on('connect', async () => {
      try {
        const data = await handshake();
        resolve();
      } catch (e) {
        resolve();
      }
    });
  });
  return socket;
}

export function subscribe(event: string, handler: (payload: any) => void) {
  const s = getRealtimeSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}

/**
 * Emit an event to the WebSocket server
 * 
 * EN: Sends an event to the WebSocket server. Used for delivery confirmation and other client-to-server events.
 * 
 * PT: Envia um evento ao servidor WebSocket. Usado para confirmação de entrega e outros eventos cliente-para-servidor.
 * 
 * @param event - Event name
 * @param payload - Event payload
 */
export function emit(event: string, payload: any) {
  const s = getRealtimeSocket();
  s.emit(event, payload);
}

export async function whenReady() {
  if (!readyPromise) getRealtimeSocket();
  return readyPromise;
}

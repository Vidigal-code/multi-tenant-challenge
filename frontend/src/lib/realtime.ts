import { io, Socket } from 'socket.io-client';
import axios from 'axios';

export const RT_EVENTS = {
  COMPANY_UPDATED: 'company.updated',
  MEMBER_JOINED: 'member.joined',
  MEMBER_LEFT: 'member.left',
  NOTIFICATION_CREATED: 'notification.created',
  INVITE_REJECTED: 'invite.rejected',
  INVITE_ACCEPTED: 'invite.accepted',
  NOTIFICATION_READ: 'notification.read',
  FRIEND_REQUEST_SENT: 'friend.request.sent',
  FRIEND_REQUEST_ACCEPTED: 'friend.request.accepted',
  FRIEND_REMOVED: 'friend.removed',
};

let socket: Socket | null = null;
let readyPromise: Promise<void> | null = null;

async function handshake() {
  const res = await axios.get('/realtime/rooms', { withCredentials: true });
  return res.data as { userRoom: string; companyRooms: string[]; events: Record<string,string>; namespace: string };
}

export function getRealtimeSocket() {
  if (socket) return socket;
  const base = process.env.NEXT_PUBLIC_WS_URL || window.location.origin.replace(/^http/, 'http');
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

export async function whenReady() {
  if (!readyPromise) getRealtimeSocket();
  return readyPromise;
}

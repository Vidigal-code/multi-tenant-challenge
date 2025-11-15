import { getRealtimeSocket, whenReady, subscribe } from '../lib/realtime';

jest.mock('axios', () => ({ get: jest.fn(() => Promise.resolve({ data: { userRoom: 'user:u1', companyRooms: [], events: {}, namespace: '/rt' } })) }));
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => {
    const handlers: Record<string, Function[]> = {};
    setTimeout(() => handlers['connect']?.forEach(h => h()), 10);
    return {
      on: (e: string, h: Function) => {
        handlers[e] = handlers[e] || []; handlers[e].push(h);
      },
      off: (e: string, h: Function) => {
        handlers[e] = (handlers[e] || []).filter(fn => fn !== h);
      },
      emit: (e: string, payload: any) => {
        handlers[e]?.forEach(h => h(payload));
      },
    } as any;
  })
}));

describe('Realtime client', () => {
  it('handshake resolves whenReady', async () => {
    getRealtimeSocket();
    await expect(whenReady()).resolves.toBeUndefined();
  });

  it('subscribe attaches and detaches listener', async () => {
    const s = getRealtimeSocket();
    const handler = jest.fn();
    const off = subscribe('company.updated', handler);
    off();
    expect(typeof off).toBe('function');
  });

  it('handles notification.read event', async () => {
    const s = getRealtimeSocket();
    const handler = jest.fn();
    subscribe('notification.read', handler);
    // simulate emit
    (s as any).emit('notification.read', { notificationId: 1 });
    expect(handler).toHaveBeenCalledWith({ notificationId: 1 });
  });
});

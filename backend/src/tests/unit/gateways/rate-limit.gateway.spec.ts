import {EventsGateway, RT_EVENT} from '../../../realtime/events.gateway';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';

class RedisMock {
    store: Record<string, { value: number; expireAt: number }> = {};
    listeners: Record<string, Function[]> = {};

    constructor(public url: string) {
    }

    on(event: string, cb: Function) {
        (this.listeners[event] ||= []).push(cb);
    }

    async connect() {
    }

    async incr(key: string) {
        const now = Date.now();
        const entry = this.store[key];
        if (!entry || entry.expireAt < now) {
            this.store[key] = {value: 1, expireAt: now + 1000};
            return 1;
        }
        entry.value += 1;
        return entry.value;
    }

    async expire(key: string, ttlSeconds: number) {
        const entry = this.store[key];
        if (entry) entry.expireAt = Date.now() + ttlSeconds * 1000;
    }
}


describe('EventsGateway Rate Limiting', () => {
    let gateway: EventsGateway;
    let deliveryConfirmation: {confirmDelivery: jest.Mock; removePendingDelivery: jest.Mock};

    beforeEach(() => {
        process.env.WS_RATE_LIMIT_WINDOW_MS = '1000';
        process.env.WS_RATE_LIMIT_MAX = '3';
        process.env.WS_RATE_LIMIT_MAX_NOTIFICATIONS_CREATED = '5';
        delete (process.env as any).REDIS_URL;
        deliveryConfirmation = {
            confirmDelivery: jest.fn(),
            removePendingDelivery: jest.fn(),
        };
        gateway = new EventsGateway(
            new JwtService({}),
            new ConfigService(),
            {listByUser: async () => []} as any,
            deliveryConfirmation as any,
        );
        (gateway as any).redisClient = new RedisMock('redis://mock');
    });

    it('allows emits until global limit exceeded', async () => {
        const roomEmitter = {emit: jest.fn()};
        const server: any = {to: () => roomEmitter, emit: jest.fn()};
        (gateway as any).server = server;
        await gateway.emitToCompany('c1', RT_EVENT.COMPANY_UPDATED, {id: 'c1'});
        await gateway.emitToCompany('c1', RT_EVENT.COMPANY_UPDATED, {id: 'c1'});
        await gateway.emitToCompany('c1', RT_EVENT.COMPANY_UPDATED, {id: 'c1'});
        await gateway.emitToCompany('c1', RT_EVENT.COMPANY_UPDATED, {id: 'c1'});
        const emitCalls = roomEmitter.emit.mock.calls.length;
        expect(emitCalls).toBe(3);
    });

    it('applies per-event override correctly', async () => {
        const roomEmitter = {emit: jest.fn()};
        const server: any = {to: () => roomEmitter, emit: jest.fn()};
        (gateway as any).server = server;
        for (let i = 0; i < 6; i++) {
            await gateway.emitToCompany('c1', RT_EVENT.NOTIFICATION_CREATED, {notificationId: 'n1'});
        }
        expect(roomEmitter.emit.mock.calls.length).toBe(5);
    });
});

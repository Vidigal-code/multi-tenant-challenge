import {WsDomainEventsBridgeService} from '../../../realtime/ws-domain-events.service';
import {RT_EVENT} from '../../../realtime/events.gateway';

class FakeRabbit {
    publish = jest.fn(async () => {
    });
}

class FakeNotificationCreator {
    createNotificationForEvent = jest.fn(async () => {
    });
}

describe('WsDomainEventsBridgeService', () => {
    const userRepo = {findById: jest.fn().mockResolvedValue({id: 'u1', notificationPreferences: {}})} as any;
    const notificationRepo = {findById: jest.fn().mockResolvedValue({meta: {}})} as any;

    it('maps notifications.sent to notifications.created websocket', async () => {
        const gw = {emitToCompany: jest.fn(), emitToUser: jest.fn()} as any;
        const notificationCreator = new FakeNotificationCreator() as any;
        const svc = new WsDomainEventsBridgeService(
            new FakeRabbit() as any,
            gw,
            notificationCreator,
            userRepo,
            notificationRepo,
        );
        await svc.publish({name: 'notifications.sent', payload: {companyId: 'c1'}});
        expect(gw.emitToCompany).toHaveBeenCalledWith('c1', RT_EVENT.NOTIFICATION_CREATED, {companyId: 'c1'});
    });

    it('maps invites.rejected to companys room', async () => {
        const gw = {emitToCompany: jest.fn(), emitToUser: jest.fn()} as any;
        const notificationCreator = new FakeNotificationCreator() as any;
        const svc = new WsDomainEventsBridgeService(
            new FakeRabbit() as any,
            gw,
            notificationCreator,
            userRepo,
            notificationRepo,
        );
        await svc.publish({name: 'invites.rejected', payload: {companyId: 'c2', inviteId: 'inv'}});
        expect(gw.emitToCompany).toHaveBeenCalledWith('c2', RT_EVENT.INVITE_REJECTED, {companyId: 'c2', inviteId: 'inv'});
    });
});

import {WsDomainEventsBridgeService} from '../../../realtime/ws-domain-events.service';
import {EventsGateway} from '../../../realtime/events.gateway';

class FakeRabbit {
    publish = jest.fn(async () => {
    });
}

class FakeNotificationCreator {
    createNotificationForEvent = jest.fn(async () => {
    });
}

describe('WsDomainEventsBridgeService', () => {
    it('maps notifications.sent to notifications.created websocket', async () => {
        const gw = new EventsGateway({} as any, {get: () => 'mt_session'} as any, {listByUser: async () => []} as any);
        (gw as any).server = {to: jest.fn().mockReturnThis(), emit: jest.fn()};
        const notificationCreator = new FakeNotificationCreator() as any;
        const svc = new WsDomainEventsBridgeService(new FakeRabbit() as any, gw, notificationCreator);
        await svc.publish({name: 'notification.sent', payload: {companyId: 'c1'}});
        expect((gw as any).server.to).toHaveBeenCalledWith('companys:c1');
        expect((gw as any).server.emit).toHaveBeenCalledWith('notifications.created', {companyId: 'c1'});
    });

    it('maps invites.rejected to companys room', async () => {
        const gw = new EventsGateway({} as any, {get: () => 'mt_session'} as any, {listByUser: async () => []} as any);
        (gw as any).server = {to: jest.fn().mockReturnThis(), emit: jest.fn()};
        const notificationCreator = new FakeNotificationCreator() as any;
        const svc = new WsDomainEventsBridgeService(new FakeRabbit() as any, gw, notificationCreator);
        await svc.publish({name: 'invite.rejected', payload: {companyId: 'c2', inviteId: 'inv'}});
        expect((gw as any).server.to).toHaveBeenCalledWith('companys:c2');
    });
});

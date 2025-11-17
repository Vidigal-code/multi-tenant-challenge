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

class FakeDeliveryConfirmationService {
    confirmDelivery = jest.fn(async () => {
    });
}

describe('WsDomainEventsBridgeService', () => {
    it('maps notifications.sent to notifications.created websocket', async () => {
        const deliveryConfirmation = new FakeDeliveryConfirmationService() as any;
        const roomEmitter = {emit: jest.fn()};
        const gw = new EventsGateway(
            {} as any,
            {get: () => 'mt_session'} as any,
            {listByUser: async () => []} as any,
            deliveryConfirmation,
        );
        (gw as any).server = {to: jest.fn().mockReturnValue(roomEmitter), emit: jest.fn()};
        (gw as any).allowEmit = jest.fn().mockResolvedValue(true);
        const notificationCreator = new FakeNotificationCreator() as any;
        const userRepo = {findById: jest.fn().mockResolvedValue({notificationPreferences: {}})} as any;
        const notificationRepo = {findById: jest.fn()} as any;
        const svc = new WsDomainEventsBridgeService(new FakeRabbit() as any, gw, notificationCreator, userRepo, notificationRepo);
        await svc.publish({name: 'notifications.sent', payload: {companyId: 'c1'}});
        expect((gw as any).server.to).toHaveBeenCalledWith('company:c1');
        expect(roomEmitter.emit).toHaveBeenCalledWith('notifications.created', expect.objectContaining({companyId: 'c1'}));
    });

    it('maps invites.rejected to companys room', async () => {
        const deliveryConfirmation = new FakeDeliveryConfirmationService() as any;
        const roomEmitter = {emit: jest.fn()};
        const gw = new EventsGateway(
            {} as any,
            {get: () => 'mt_session'} as any,
            {listByUser: async () => []} as any,
            deliveryConfirmation,
        );
        (gw as any).server = {to: jest.fn().mockReturnValue(roomEmitter), emit: jest.fn()};
        (gw as any).allowEmit = jest.fn().mockResolvedValue(true);
        const notificationCreator = new FakeNotificationCreator() as any;
        const userRepo = {findById: jest.fn().mockResolvedValue({notificationPreferences: {}})} as any;
        const notificationRepo = {findById: jest.fn()} as any;
        const svc = new WsDomainEventsBridgeService(new FakeRabbit() as any, gw, notificationCreator, userRepo, notificationRepo);
        await svc.publish({name: 'invites.rejected', payload: {companyId: 'c2', inviteId: 'inv'}});
        expect((gw as any).server.to).toHaveBeenCalledWith('company:c2');
    });
});

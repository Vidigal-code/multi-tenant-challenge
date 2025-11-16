import {RabbitMQService} from '@infrastructure/messaging/services/rabbitmq.service';
import {BaseDeliveryAwareConsumer} from '../base.delivery-aware.consumer';
import {DeliveryConfirmationService} from '@infrastructure/messaging/services/delivery-confirmation.service';
import {ConfigService} from '@nestjs/config';
import {LoggerService} from '@infrastructure/logging/logger.service';

const NOTIFICATIONS_REALTIME_QUEUE = 'notifications.realtimes';
const DLQ_REALTIME_NOTIFICATIONS = 'dlq.notifications.realtimes';

/**
 * RealtimeNotificationsConsumer - Consumer that waits for delivery confirmation before saving to DB
 *
 * EN: This consumer implements the delivery confirmation flow:
 * 1. Consumes message from RabbitMQ queue
 * 2. Stores message in Redis with TTL (pending delivery)
 * 3. Emits WebSocket notification to users
 * 4. Waits for delivery confirmation from frontend
 * 5. If confirmed: Creates notification in database, ack message
 * 6. If timeout/failure: Nack message (returns to queue or DLQ)
 *
 * PT: Este consumidor implementa o fluxo de confirmação de entrega:
 * 1. Consome mensagem da fila RabbitMQ
 * 2. Armazena mensagem no Redis com TTL (entrega pendente)
 * 3. Emite notificação WebSocket para usuários
 * 4. Aguarda confirmação de entrega do frontend
 * 5. Se confirmado: Cria notificação no banco de dados, ack mensagem
 * 6. Se timeout/falha: Nack mensagem (volta para fila ou DLQ)
 */
class RealtimeNotificationsConsumer extends BaseDeliveryAwareConsumer<any> {
    private notificationCreator: any;
    private gateway: any;
    private userRepo: any;
    private notificationRepo: any;
    private RT_EVENT: any;

    constructor(
        rabbit: RabbitMQService,
        config: ConfigService,
        deliveryConfirmation: DeliveryConfirmationService,
        services: {
            notificationCreator: any;
            gateway: any;
            userRepo: any;
            notificationRepo: any;
            RT_EVENT: any;
        }
    ) {
        super(
            rabbit,
            {
                queue: NOTIFICATIONS_REALTIME_QUEUE,
                dlq: DLQ_REALTIME_NOTIFICATIONS,
                prefetch: parseInt((config.get('app.rabbitmq.prefetch') as any) ?? '50', 10),
                retryMax: parseInt((config.get('app.rabbitmq.retryMax') as any) ?? '5', 10),
                redisUrl: (config.get('app.redisUrl') as string) || process.env.REDIS_URL || 'redis://redis:6379',
                dedupTtlSeconds: 60,
            },
            deliveryConfirmation,
            config
        );
        this.notificationCreator = services.notificationCreator;
        this.gateway = services.gateway;
        this.userRepo = services.userRepo;
        this.notificationRepo = services.notificationRepo;
        this.RT_EVENT = services.RT_EVENT;
    }

    /**
     * Override dedupKey to use a unique key per message based on messageId.
     * This prevents dedup conflicts with upstream workers (members, invites, generic).
     * Since messages arrive here from upstream workers, we need a different dedup strategy.
     */
    protected dedupKey(payload: any): string | null {
        // Use messageId from RabbitMQ if available (most reliable)
        if (payload?.messageId || payload?.id) {
            return `realtime:msg:${payload.messageId || payload.id}`;
        }
        
        // Fallback to a key that includes the queue name to avoid conflicts with upstream workers
        const baseKey = super.dedupKey(payload);
        if (baseKey) {
            return `realtime:${baseKey}`;
        }
        
        return null;
    }

    protected async processWithDelivery(payload: any, messageId: string): Promise<{ confirmed: boolean; saved?: boolean; error?: string }> {
        try {
            this.logger.rabbitmq(`Processing realtime notification with delivery confirmation: messageId=${messageId}, eventId=${payload?.eventId || 'unknown'}`);
            
            const eventId = payload?.eventId;
            if (!eventId) {
                this.logger.rabbitmq('No eventId found in payload, skipping');
                return { confirmed: true, saved: false, error: 'No eventId found' };
            }

            const eventNameMapping: Record<string, string> = {
                'INVITE_CREATED': 'invite.created',
                'INVITE_ACCEPTED': 'invite.accepted',
                'INVITE_REJECTED': 'invite.rejected',
                'USER_REMOVED': 'membership.removed',
                'USER_JOINED': 'membership.joined',
                'USER_STATUS_UPDATED': 'membership.role.updated',
                'FRIEND_REQUEST_SENT': 'friend.request.sent',
                'FRIEND_REQUEST_ACCEPTED': 'friend.request.accepted',
                'FRIEND_REQUEST_REJECTED': 'friend.request.rejected',
                'FRIEND_REMOVED': 'friend.removed',
                'NOTIFICATION_SENT': 'notification.sent',
                'NOTIFICATION_CREATED': 'notification.created',
                'NOTIFICATION_REPLIED': 'notification.reply',
            };

            const eventName = eventNameMapping[eventId];
            if (!eventName) {
                this.logger.rabbitmq(`Unknown eventId: ${eventId}, skipping`);
                return { confirmed: true, saved: false, error: `Unknown eventId: ${eventId}` };
            }

            const companyId = payload?.companyId;
            const userIds: string[] = [];
            
            if (Array.isArray(payload?.notifiedUserIds) && payload.notifiedUserIds.length > 0) {
                userIds.push(...payload.notifiedUserIds);
            } else if (payload?.receiver?.id) {
                userIds.push(payload.receiver.id);
                this.logger.rabbitmq(`Using receiver.id for ${eventId}: ${payload.receiver.id}`);
            } else {
                const userId = payload?.userId || payload?.recipientUserId || payload?.invitedUserId;
                if (userId) {
                    userIds.push(userId);
                    this.logger.rabbitmq(`Using fallback userId for ${eventId}: ${userId}`);
                } else if (eventId === 'INVITE_CREATED' && payload?.receiverEmail) {
                    const user = await this.userRepo.findByEmail(payload.receiverEmail);
                    if (user) {
                        userIds.push(user.id);
                        this.logger.rabbitmq(`Found user by email for INVITE_CREATED: ${user.id} (${payload.receiverEmail})`);
                    } else {
                        this.logger.rabbitmq(`User not found by email for INVITE_CREATED: ${payload.receiverEmail}`);
                    }
                } else if (eventId === 'INVITE_CREATED' && payload?.invitedEmail) {
                    const user = await this.userRepo.findByEmail(payload.invitedEmail);
                    if (user) {
                        userIds.push(user.id);
                        this.logger.rabbitmq(`Found user by email for INVITE_CREATED: ${user.id} (${payload.invitedEmail})`);
                    } else {
                        this.logger.rabbitmq(`User not found by email for INVITE_CREATED: ${payload.invitedEmail}`);
                    }
                } else if (eventId === 'FRIEND_REQUEST_SENT' && payload?.addresseeId) {
                    userIds.push(payload.addresseeId);
                    this.logger.rabbitmq(`Found recipient for FRIEND_REQUEST_SENT: ${payload.addresseeId}`);
                } else if (eventId === 'FRIEND_REQUEST_ACCEPTED' && payload?.requesterId) {
                    userIds.push(payload.requesterId);
                    this.logger.rabbitmq(`Found recipient for FRIEND_REQUEST_ACCEPTED: ${payload.requesterId}`);
                } else if (eventId === 'FRIEND_REQUEST_REJECTED' && payload?.requesterId) {
                    userIds.push(payload.requesterId);
                    this.logger.rabbitmq(`Found recipient for FRIEND_REQUEST_REJECTED: ${payload.requesterId}`);
                } else if (eventId === 'FRIEND_REMOVED') {
                    const {requesterId, addresseeId, userId} = payload;
                    if (userId && requesterId && addresseeId) {
                        const notifyUserId = userId === requesterId ? addresseeId : requesterId;
                        if (notifyUserId) {
                            userIds.push(notifyUserId);
                            this.logger.rabbitmq(`Found recipient for FRIEND_REMOVED: ${notifyUserId}`);
                        }
                    } else if (payload?.addresseeId) {
                        userIds.push(payload.addresseeId);
                        this.logger.rabbitmq(`Found recipient for FRIEND_REMOVED: ${payload.addresseeId}`);
                    } else if (payload?.requesterId) {
                        userIds.push(payload.requesterId);
                        this.logger.rabbitmq(`Found recipient for FRIEND_REMOVED: ${payload.requesterId}`);
                    }
                }
            }

            this.logger.rabbitmq(`Preparing to emit notifications to ${userIds.length} user(s): ${userIds.join(', ')}`);

            if (userIds.length === 0) {
                this.logger.rabbitmq(`Warning: No user IDs found in payload, creating notification without WebSocket delivery`);
                const notificationPayload = {
                    ...payload,
                    recipientUserId: payload?.receiver?.id,
                    senderUserId: payload?.sender?.id || payload?.senderUserId,
                    companyId: payload?.companyId || payload?.company?.id,
                    inviteId: payload?.inviteId,
                    invitedEmail: payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email,
                    inviteUrl: payload?.inviteUrl,
                    role: payload?.role,
                };
                this.logger.rabbitmq(`Creating notification without user IDs: eventName=${eventName}, inviteId=${notificationPayload.inviteId}, invitedEmail=${notificationPayload.invitedEmail}`);
                await this.notificationCreator.createNotificationForEvent(eventName, notificationPayload);
                return { confirmed: true, saved: true, error: undefined };
            }

            const confirmedUserIds: string[] = [];
            const userMessageIds: Map<string, string> = new Map();

            for (const userId of userIds) {
                const user = await this.userRepo.findById(userId);
                if (!user) {
                    this.logger.rabbitmq(`User ${userId} not found, skipping`);
                    continue;
                }

                const prefs = user.notificationPreferences || {};
                this.logger.rabbitmq(`User ${userId} preferences: realtimeEnabled=${prefs.realtimeEnabled}, realtimePopups=${prefs.realtimePopups}`);
                
                if (prefs.realtimeEnabled === false) {
                    this.logger.rabbitmq(`WebSocket emit skipped for user ${userId}: realtimeEnabled is false, creating notification without delivery confirmation`);
                    const notificationPayload = {
                        ...payload,
                        userId,
                        recipientUserId: payload?.receiver?.id || userId,
                        senderUserId: payload?.sender?.id || payload?.senderUserId,
                        companyId: payload?.companyId || payload?.company?.id,
                        inviteId: payload?.inviteId,
                        invitedEmail: payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email,
                        inviteUrl: payload?.inviteUrl,
                        role: payload?.role,
                    };
                    this.logger.rabbitmq(`Creating notification without WebSocket for user ${userId}: eventName=${eventName}, inviteId=${notificationPayload.inviteId}, invitedEmail=${notificationPayload.invitedEmail}`);
                    await this.notificationCreator.createNotificationForEvent(eventName, notificationPayload);
                    confirmedUserIds.push(userId);
                    continue;
                }

                const userMessageId = `${messageId}_${userId}`;
                userMessageIds.set(userId, userMessageId);

                const notificationPayload = {
                    ...payload,
                    messageId: userMessageId,
                    eventName,
                    userId,
                };

                await this.deliveryConfirmation.storePendingDelivery(userMessageId, notificationPayload, {
                    userId,
                    companyId: companyId || undefined,
                    timestamp: Date.now(),
                    queue: NOTIFICATIONS_REALTIME_QUEUE,
                });

                this.gateway.emitToUser(userId, this.RT_EVENT.NOTIFICATION_CREATED, notificationPayload);
                this.logger.websocket(`WebSocket event emitted to user: ${userId}, event: ${this.RT_EVENT.NOTIFICATION_CREATED}, messageId: ${userMessageId}`);
            }

            if (companyId) {
                this.gateway.emitToCompany(companyId, this.RT_EVENT.NOTIFICATION_CREATED, { ...payload, messageId });
                this.logger.rabbitmq(`WebSocket event emitted to company: ${companyId}, messageId: ${messageId}`);
            }

            if (userMessageIds.size === 0) {
                this.logger.rabbitmq(`No users require confirmation, all notifications saved`);
                return { confirmed: true, saved: true, error: undefined };
            }

            const timeoutMs = this.confirmationTimeout;
            const startTime = Date.now();
            const pollIntervalMs = 500;

            this.logger.rabbitmq(`Waiting for delivery confirmation: messageId=${messageId}, users=${Array.from(userMessageIds.keys()).join(', ')}, timeout=${timeoutMs}ms`);

            while (Date.now() - startTime < timeoutMs && confirmedUserIds.length < userMessageIds.size) {
                for (const [userId, userMessageId] of userMessageIds.entries()) {
                    if (confirmedUserIds.includes(userId)) continue;

                    const isPending = await this.deliveryConfirmation.isPending(userMessageId);
                    if (!isPending) {
                        const confirmedData = await this.deliveryConfirmation.confirmDelivery(userMessageId);
                        if (confirmedData) {
                            this.logger.rabbitmq(`Delivery confirmed for user ${userId}: messageId=${userMessageId}`);
                            try {
                                const storedPayload = confirmedData?.payload || {};
                                const notificationPayload = {
                                    ...payload,
                                    ...storedPayload,
                                    userId,
                                    recipientUserId: payload?.receiver?.id || storedPayload?.recipientUserId || userId,
                                    senderUserId: payload?.sender?.id || payload?.senderUserId || storedPayload?.senderUserId,
                                    companyId: payload?.companyId || payload?.company?.id || storedPayload?.companyId,
                                    inviteId: payload?.inviteId || storedPayload?.inviteId,
                                    invitedEmail: payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email || storedPayload?.invitedEmail || storedPayload?.receiverEmail,
                                    inviteUrl: payload?.inviteUrl || storedPayload?.inviteUrl,
                                    role: payload?.role || storedPayload?.role,
                                };
                                this.logger.rabbitmq(`Creating notification for user ${userId}: eventName=${eventName}, inviteId=${notificationPayload.inviteId}, invitedEmail=${notificationPayload.invitedEmail}`);
                                this.logger.rabbitmq(`Notification payload keys: ${Object.keys(notificationPayload).join(', ')}`);
                                this.logger.rabbitmq(`Notification payload full: ${JSON.stringify(notificationPayload, null, 2)}`);
                                await this.notificationCreator.createNotificationForEvent(eventName, notificationPayload);
                                this.logger.rabbitmq(`Notification saved in database for user ${userId}: eventName=${eventName}`);
                                confirmedUserIds.push(userId);
                            } catch (error: any) {
                                this.logger.error(`Error creating notification for user ${userId}: ${error?.message || String(error)}`);
                                this.logger.error(`Error stack: ${error?.stack || 'No stack trace'}`);
                            }
                        } else {
                            this.logger.rabbitmq(`Delivery already confirmed or expired for user ${userId}: messageId=${userMessageId}, attempting to save notification from original payload`);
                            try {
                                const additionalData = payload?.additionalData || {};
                                const notificationPayload = {
                                    ...payload,
                                    userId,
                                    recipientUserId: payload?.receiver?.id || userId,
                                    senderUserId: payload?.sender?.id || payload?.senderUserId,
                                    companyId: payload?.companyId || payload?.company?.id,
                                    inviteId: payload?.inviteId || additionalData?.inviteId,
                                    invitedEmail: payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email || additionalData?.invitedEmail,
                                    inviteUrl: payload?.inviteUrl || additionalData?.inviteUrl,
                                    role: payload?.role || additionalData?.role,
                                };
                                this.logger.rabbitmq(`Creating notification from original payload for user ${userId}: eventName=${eventName}, inviteId=${notificationPayload.inviteId}, invitedEmail=${notificationPayload.invitedEmail}`);
                                this.logger.rabbitmq(`Notification payload keys: ${Object.keys(notificationPayload).join(', ')}`);
                                this.logger.rabbitmq(`Notification payload full: ${JSON.stringify(notificationPayload, null, 2)}`);
                                await this.notificationCreator.createNotificationForEvent(eventName, notificationPayload);
                                this.logger.rabbitmq(`Notification saved in database for user ${userId}: eventName=${eventName}`);
                                confirmedUserIds.push(userId);
                            } catch (error: any) {
                                this.logger.error(`Error creating notification for user ${userId}: ${error?.message || String(error)}`);
                                this.logger.error(`Error stack: ${error?.stack || 'No stack trace'}`);
                                confirmedUserIds.push(userId);
                            }
                        }
                    }
                }

                if (confirmedUserIds.length >= userMessageIds.size) {
                    break;
                }

                await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
            }

            for (const [userId, userMessageId] of userMessageIds.entries()) {
                if (!confirmedUserIds.includes(userId)) {
                    this.logger.rabbitmq(`Delivery timeout for user ${userId}: messageId=${userMessageId}, saving notification without confirmation`);
                    try {
                        const notificationPayload = {
                            ...payload,
                            userId,
                            recipientUserId: payload?.receiver?.id || userId,
                            senderUserId: payload?.sender?.id || payload?.senderUserId,
                            companyId: payload?.companyId || payload?.company?.id,
                            inviteId: payload?.inviteId,
                            invitedEmail: payload?.invitedEmail || payload?.receiverEmail || payload?.receiver?.email || payload?.email,
                            inviteUrl: payload?.inviteUrl,
                            role: payload?.role,
                        };
                        this.logger.rabbitmq(`Creating notification after timeout for user ${userId}: eventName=${eventName}, inviteId=${notificationPayload.inviteId}, invitedEmail=${notificationPayload.invitedEmail}`);
                        await this.notificationCreator.createNotificationForEvent(eventName, notificationPayload);
                        this.logger.rabbitmq(`Notification saved in database after timeout for user ${userId}: eventName=${eventName}`);
                        confirmedUserIds.push(userId);
                    } catch (error: any) {
                        this.logger.error(`Error saving notification after timeout for user ${userId}: ${error?.message || String(error)}`);
                        this.logger.error(`Error stack: ${error?.stack || 'No stack trace'}`);
                    }
                    await this.deliveryConfirmation.removePendingDelivery(userMessageId);
                    this.logger.rabbitmq(`Pending delivery cleaned up after timeout for user ${userId}: messageId=${userMessageId}`);
                }
            }

            const allConfirmed = confirmedUserIds.length >= userMessageIds.size;
            const savedCount = confirmedUserIds.length;
            
            this.logger.rabbitmq(`Notification processing completed: messageId=${messageId}, confirmed=${allConfirmed}, saved=${savedCount}/${userMessageIds.size}, elapsed=${Date.now() - startTime}ms`);
            
            return { confirmed: allConfirmed, saved: savedCount > 0, error: allConfirmed ? undefined : `Some deliveries timed out, but all notifications saved: ${savedCount}/${userMessageIds.size}` };
        } catch (error: any) {
            const errorMsg = error?.message || String(error);
            this.logger.error(`Failed to process realtime notification: messageId=${messageId}, error=${errorMsg}`);
            return { confirmed: false, saved: false, error: errorMsg };
        }
    }
}

async function bootstrap() {
    const config = new ConfigService();
    const logger = new LoggerService('RealtimeNotificationsConsumer', config);
    logger.default('Starting realtime notifications consumer...');
    
    let app: any = null;
    let stopAutoCleanup: (() => void) | null = null;
    
    try {
        const { AppModule } = require('../../../app.module');
        const { NestFactory } = require('@nestjs/core');
        

        const workerPort = parseInt(process.env.WORKER_PORT || '4001', 10);
        app = await NestFactory.create(AppModule);
        await app.listen(workerPort);
        logger.default(`Worker HTTP server listening on port ${workerPort} (for WebSocket initialization)`);
        
        const { NotificationCreatorService } = require('@application/services/notification-creator.service');
        const { EventsGateway, RT_EVENT } = require('../../../realtime/events.gateway');
        const { USER_REPOSITORY } = require('@domain/repositories/users/user.repository');
        const { NOTIFICATION_REPOSITORY } = require('@domain/repositories/notifications/notification.repository');
        const { DeliveryConfirmationService } = require('@infrastructure/messaging/services/delivery-confirmation.service');
        
        const notificationCreator = app.get(NotificationCreatorService);
        const gateway = app.get(EventsGateway);
        const userRepo = app.get(USER_REPOSITORY);
        const notificationRepo = app.get(NOTIFICATION_REPOSITORY);
        const deliveryConfirmation = app.get(DeliveryConfirmationService);

        stopAutoCleanup = deliveryConfirmation.startAutoCleanup(60000);

        const rabbit = new (require('@infrastructure/messaging/services/rabbitmq.service').RabbitMQService)(config);
        await rabbit.onModuleInit();
        
        const consumer = new RealtimeNotificationsConsumer(rabbit, config, deliveryConfirmation, {
            notificationCreator,
            gateway,
            userRepo,
            notificationRepo,
            RT_EVENT,
        });
        
        await consumer.start();
        logger.default('Realtime notifications consumer started.');
        
        process.on('SIGINT', async () => {
            logger.default('Shutting down realtime notifications consumer...');
            if (stopAutoCleanup) {
                stopAutoCleanup();
            }
            if (app) {
                await app.close();
            }
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            logger.default('Shutting down realtime notifications consumer...');
            if (stopAutoCleanup) {
                stopAutoCleanup();
            }
            if (app) {
                await app.close();
            }
            process.exit(0);
        });
    } catch (error: any) {
        logger.error(`Failed to start realtime notifications consumer: ${error?.message || String(error)}`);
        if (stopAutoCleanup) {
            stopAutoCleanup();
        }
        if (app) {
            await app.close();
        }
        process.exit(1);
    }
}

if (require.main === module) {
    bootstrap();
}

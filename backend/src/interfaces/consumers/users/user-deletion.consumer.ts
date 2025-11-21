import {Injectable, OnModuleInit} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {RabbitMQService} from "@infrastructure/messaging/services/rabbitmq.service";
import {BaseResilientConsumer} from "../base.resilient.consumer";
import {UserDeletionJobPayload} from "@application/dto/users/user-deletion.dto";
import {PrismaService} from "@infrastructure/prisma/services/prisma.service";
import {UserDeletionCacheService} from "@infrastructure/cache/user-deletion-cache.service";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {
    DLQ_USERS_DELETE_QUEUE,
    USERS_DELETE_QUEUE
} from "@infrastructure/messaging/constants/queue.constants";
import {Role} from "@domain/enums/role.enum";

@Injectable()
export class UserDeletionConsumer extends BaseResilientConsumer<UserDeletionJobPayload> implements OnModuleInit {
    constructor(
        rabbit: RabbitMQService,
        private readonly prisma: PrismaService,
        private readonly cache: UserDeletionCacheService,
        configService: ConfigService,
    ) {
        super(rabbit, {
            queue: USERS_DELETE_QUEUE,
            dlq: DLQ_USERS_DELETE_QUEUE,
            prefetch: 1, // Sequential processing per job to avoid race conditions on same user data
            retryMax: 5,
            redisUrl: (configService.get("app.redisUrl") as string) || process.env.REDIS_URL || "redis://localhost:6379",
            dedupTtlSeconds: 60,
        }, configService);
    }

    async onModuleInit() {
        await this.start();
    }

    protected async process(payload: UserDeletionJobPayload): Promise<void> {
        this.logger.default(`Processing user deletion job: ${payload.jobId}, Step: ${payload.step}, User: ${payload.userId}`);
        
        try {
            if (payload.step === 'INIT') {
                await this.cache.updateMeta(payload.jobId, {status: "processing", currentStep: "OWNED_COMPANIES", progress: 5});
                await this.requeue({...payload, step: 'OWNED_COMPANIES', cursor: null, deletedOwnedCompanies: 0});
                return;
            }

            if (payload.step === 'OWNED_COMPANIES') {
                const BATCH_SIZE = 100;
                // Find companies where user is OWNER
                // We need to be careful: "Primary Owner" usually implies checking the creator or specific logic. 
                // The original logic filtered by Role.OWNER.
                // Let's fetch memberships where role is OWNER and delete those companies.
                
                const memberships = await (this.prisma as any).membership.findMany({
                    where: {
                        userId: payload.userId,
                        role: Role.OWNER
                    },
                    take: BATCH_SIZE,
                    select: { companyId: true }
                });

                if (memberships.length === 0) {
                    // No more owned companies
                    await this.cache.updateMeta(payload.jobId, {currentStep: "MEMBERSHIPS", progress: 30});
                    await this.requeue({...payload, step: 'MEMBERSHIPS', cursor: null});
                    return;
                }

                // Delete these companies
                // Use transaction or deleteMany if cascading is set up correctly in DB (usually it is for Owner -> Company)
                // However, schema says Membership -> Company (Cascade), Invite -> Company (Cascade).
                // If we delete Company, memberships and invites go away.
                // But we are deleting based on User being OWNER.
                
                const companyIds = memberships.map((m: any) => m.companyId);
                
                // In "millions" scenario, we delete in batches.
                await (this.prisma as any).company.deleteMany({
                    where: {
                        id: { in: companyIds }
                    }
                });

                const deletedCount = (payload.deletedOwnedCompanies || 0) + memberships.length;
                await this.cache.updateMeta(payload.jobId, {progress: 10 + Math.min(20, Math.floor(deletedCount / 10))}); // Fake progress for now or cumulative
                
                // Requeue to check for more
                await this.requeue({...payload, step: 'OWNED_COMPANIES', deletedOwnedCompanies: deletedCount});
                return;
            }

            if (payload.step === 'MEMBERSHIPS') {
                // Remove user from other companies (where they are not owner, or remaining ones)
                const BATCH_SIZE = 500;
                const memberships = await (this.prisma as any).membership.findMany({
                    where: { userId: payload.userId },
                    take: BATCH_SIZE,
                    select: { id: true }
                });

                if (memberships.length === 0) {
                    await this.cache.updateMeta(payload.jobId, {currentStep: "NOTIFICATIONS", progress: 50});
                    await this.requeue({...payload, step: 'NOTIFICATIONS'});
                    return;
                }

                const ids = memberships.map((m: any) => m.id);
                await (this.prisma as any).membership.deleteMany({
                    where: { id: { in: ids } }
                });

                await this.requeue({...payload, step: 'MEMBERSHIPS'});
                return;
            }

            if (payload.step === 'NOTIFICATIONS') {
                await (this.prisma as any).notification.deleteMany({
                    where: {
                        OR: [
                            { senderUserId: payload.userId },
                            { recipientUserId: payload.userId },
                        ],
                    },
                });
                await this.cache.updateMeta(payload.jobId, {currentStep: "FRIENDSHIPS", progress: 70});
                await this.requeue({...payload, step: 'FRIENDSHIPS'});
                return;
            }

            if (payload.step === 'FRIENDSHIPS') {
                await (this.prisma as any).friendship.deleteMany({
                    where: {
                        OR: [
                            { requesterId: payload.userId },
                            { addresseeId: payload.userId },
                        ],
                    },
                });
                await this.cache.updateMeta(payload.jobId, {currentStep: "INVITES", progress: 80});
                await this.requeue({...payload, step: 'INVITES'});
                return;
            }

            if (payload.step === 'INVITES') {
                await (this.prisma as any).invite.deleteMany({
                    where: {
                        inviterId: payload.userId,
                    },
                });
                
                // Also delete invites sent TO this user email
                const user = await (this.prisma as any).user.findUnique({
                    where: { id: payload.userId },
                    select: { email: true }
                });
                
                if (user?.email) {
                    await (this.prisma as any).invite.deleteMany({
                        where: {
                            email: user.email,
                        },
                    });
                }

                await this.cache.updateMeta(payload.jobId, {currentStep: "USER", progress: 90});
                await this.requeue({...payload, step: 'USER'});
                return;
            }

            if (payload.step === 'USER') {
                await (this.prisma as any).user.delete({
                    where: { id: payload.userId }
                });

                await this.cache.updateMeta(payload.jobId, {
                    status: "completed",
                    progress: 100,
                    finishedAt: Date.now(),
                });
                
                this.logger.default(`User deletion job ${payload.jobId} completed.`);
                return;
            }

        } catch (error: any) {
            const message = error?.message || "USER_DELETE_JOB_FAILED";
            this.logger.error(`User deletion job failed: ${payload.jobId} - ${message}`);
            await this.cache.updateMeta(payload.jobId, {
                status: "failed",
                error: message,
                finishedAt: Date.now(),
            });
            throw error;
        }
    }

    private async requeue(payload: UserDeletionJobPayload) {
        await this.rabbit.sendToQueue(USERS_DELETE_QUEUE, Buffer.from(JSON.stringify(payload)));
    }
}


import {Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards} from "@nestjs/common";
import {ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {SendNotificationUseCase} from "@application/use-cases/notifications/send-notification.usecase";
import {SendFriendMessageUseCase} from "@application/use-cases/friendships/send-friend-message.usecase";
import {ListNotificationsUseCase} from "@application/use-cases/notifications/list-notifications.usecase";
import {MarkNotificationReadUseCase} from "@application/use-cases/notifications/mark-notification-read.usecase";
import {DeleteNotificationUseCase} from "@application/use-cases/notifications/delete-notification.usecase";
import {DeleteNotificationsUseCase} from "@application/use-cases/notifications/delete-notifications.usecase";
import {ReplyToNotificationUseCase} from "@application/use-cases/notifications/reply-to-notification.usecase";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {NotificationReadPayloadDto} from "@application/dto/realtimes/realtime.dto";
import {SuccessCode} from "@application/success/success-code";
import {ErrorCode} from "@application/errors/error-code";
import {ConfigService} from "@nestjs/config";
import {LoggerService} from "@infrastructure/logging/logger.service";
import {NotificationListingJobsService} from "@application/services/notification-listing-jobs.service";
import {NotificationDeletionJobsService} from "@application/services/notification-deletion-jobs.service";
import {
    CreateNotificationListJobDto,
    NotificationListJobResponseDto,
    NotificationListQueryDto
} from "@application/dto/notifications/notification-listing.dto";
import {
    CreateNotificationDeleteJobDto,
    NotificationDeleteJobResponseDto
} from "@application/dto/notifications/notification-deletion.dto";
import {
    CreateNotificationBroadcastJobDto,
    NotificationBroadcastJobResponseDto
} from "@application/dto/notifications/notification-broadcast.dto";
import {NotificationBroadcastJobsService} from "@application/services/notification-broadcast-jobs.service";
import {
    CreateFriendBroadcastJobDto,
    NotificationFriendBroadcastJobResponseDto
} from "@application/dto/notifications/notification-friend-broadcast.dto";
import {NotificationFriendBroadcastJobsService} from "@application/services/notification-friend-broadcast-jobs.service";

@ApiTags("notifications")
@ApiCookieAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    private readonly logger: LoggerService;

    constructor(
        private readonly sendNotification: SendNotificationUseCase,
        private readonly sendFriendMessage: SendFriendMessageUseCase,
        private readonly listNotifications: ListNotificationsUseCase,
        private readonly markRead: MarkNotificationReadUseCase,
        private readonly deleteNotification: DeleteNotificationUseCase,
        private readonly deleteNotificationsUseCase: DeleteNotificationsUseCase,
        private readonly replyToNotification: ReplyToNotificationUseCase,
        private readonly configService: ConfigService,
        private readonly listingJobs: NotificationListingJobsService,
        private readonly deletionJobs: NotificationDeletionJobsService,
        private readonly broadcastJobs: NotificationBroadcastJobsService,
        private readonly friendBroadcastJobs: NotificationFriendBroadcastJobsService,
    ) {
        this.logger = new LoggerService(NotificationsController.name, configService);
    }

    @Post("listing")
    @ApiOperation({summary: "Start a background job to list notifications"})
    @ApiResponse({
        status: 201,
        description: "Job created",
        schema: {example: {jobId: "uuid", status: "pending", processed: 0, items: [], done: false}},
    })
    async createListingJob(@CurrentUser() user: any, @Body() body: CreateNotificationListJobDto) {
        const meta = await this.listingJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            items: [],
            done: false,
        };
    }

    @Post("broadcast-jobs")
    @ApiOperation({summary: "Start a background job to broadcast notifications"})
    @ApiResponse({
        status: 201,
        description: "Broadcast job created",
        schema: {example: {jobId: "uuid", status: "pending", processed: 0, done: false}},
    })
    async createBroadcastJob(
        @CurrentUser() user: any,
        @Body() body: CreateNotificationBroadcastJobDto,
    ) {
        const meta = await this.broadcastJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            totalTargets: meta.totalTargets,
            done: false,
        };
    }

    @Get("broadcast-jobs/:jobId")
    @ApiOperation({summary: "Get broadcast job status"})
    @ApiResponse({status: 200, type: NotificationBroadcastJobResponseDto})
    async getBroadcastJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
    ) {
        return this.broadcastJobs.getJob(user.sub, jobId);
    }

    @Post("friend-broadcast-jobs")
    @ApiOperation({summary: "Start a background job to broadcast messages to friends"})
    @ApiResponse({
        status: 201,
        description: "Friend broadcast job created",
        schema: {example: {jobId: "uuid", status: "pending", processed: 0, done: false}},
    })
    async createFriendBroadcastJob(
        @CurrentUser() user: any,
        @Body() body: CreateFriendBroadcastJobDto,
    ) {
        const meta = await this.friendBroadcastJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            totalTargets: meta.totalTargets,
            done: false,
        };
    }

    @Get("friend-broadcast-jobs/:jobId")
    @ApiOperation({summary: "Get friend broadcast job status"})
    @ApiResponse({status: 200, type: NotificationFriendBroadcastJobResponseDto})
    async getFriendBroadcastJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
    ) {
        return this.friendBroadcastJobs.getJob(user.sub, jobId);
    }

    @Get("listing/:jobId")
    @ApiOperation({summary: "Get notification listing job status and page"})
    @ApiResponse({status: 200, type: NotificationListJobResponseDto})
    @ApiResponse({status: 404, description: "Job not found", type: ErrorResponse})
    async getListingJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
        @Query() query: NotificationListQueryDto,
    ) {
        return this.listingJobs.getJob(user.sub, jobId, query);
    }

    @Delete("listing/:jobId")
    @ApiOperation({summary: "Delete/Cancel a notification listing job"})
    @ApiResponse({status: 200, description: "Job deleted"})
    async deleteListingJob(@CurrentUser() user: any, @Param("jobId") jobId: string) {
        await this.listingJobs.deleteJob(user.sub, jobId);
        return {success: true};
    }

    @Post("deletion-jobs")
    @ApiOperation({summary: "Start a background job to delete notifications"})
    @ApiResponse({
        status: 201,
        description: "Job created",
        schema: {example: {jobId: "uuid", status: "pending", deletedCount: 0, done: false}},
    })
    async createDeletionJob(@CurrentUser() user: any, @Body() body: CreateNotificationDeleteJobDto) {
        const meta = await this.deletionJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            deletedCount: meta.deletedCount,
            done: false,
        };
    }

    @Get("deletion-jobs/:jobId")
    @ApiOperation({summary: "Get notification deletion job status"})
    @ApiResponse({status: 200, type: NotificationDeleteJobResponseDto})
    @ApiResponse({status: 404, description: "Job not found", type: ErrorResponse})
    async getDeletionJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
    ) {
        return this.deletionJobs.getJob(user.sub, jobId);
    }

    @Post()
    @ApiOperation({summary: "Send a global message to companys members or friends"})
    @ApiResponse({
        status: 201,
        description: "Message queued for delivery",
        schema: {
            example: {
                notifications: [
                    {
                        id: "1",
                        companyId: "companys-id",
                        senderUserId: "users-1",
                        recipientUserId: "users-2",
                        title: "Subject",
                        body: "Message body",
                        createdAt: "2025-11-13T10:00:00.000Z",
                        read: false,
                        meta: {kind: "notifications.sent", channel: "company"},
                    },
                ],
                validationResults: [
                    {email: "member@example.com", status: "sent", code: SuccessCode.NOTIFICATION_SENT},
                    {
                        email: "guest@example.com",
                        status: "failed",
                        code: ErrorCode.USER_MUST_BE_MEMBER_OR_FRIEND
                    },
                ],
            },
        },
    })
    @ApiResponse({status: 403, description: "Insufficient role", type: ErrorResponse})
    async create(
        @CurrentUser() user: any,
        @Body() body: { companyId: string; title: string; body: string; recipientsEmails?: string[]; onlyOwnersAndAdmins?: boolean },
    ) {
        this.logger.default(`POST /notifications - user: ${user.sub}, company: ${body.companyId}, recipients: ${body.recipientsEmails?.length || 'all'}`);
        const result = await this.sendNotification.execute({
            companyId: body.companyId,
            senderUserId: user.sub,
            recipientsEmails: body.recipientsEmails,
            title: body.title,
            body: body.body,
            onlyOwnersAndAdmins: body.onlyOwnersAndAdmins,
        });
        this.logger.default(`Notification sent - ${result.notifications.length} notifications created`);
        return {
            notifications: result.notifications.map((notification) => notification.toJSON()),
            validationResults: result.validationResults,
        };
    }

    @Get()
    @ApiOperation({summary: "List notifications for the authenticated users"})
    @ApiResponse({
        status: 200,
        description: "Notifications returned",
        schema: {
            example: {
                items: [
                    {
                        id: "1",
                        companyId: "companys-id",
                        senderUserId: "users-1",
                        recipientUserId: "users-2",
                        title: "Subject",
                        body: "Message body",
                        createdAt: "2025-11-13T10:00:00.000Z",
                        read: false,
                        meta: {kind: "notifications.sent", channel: "company"},
                    },
                ],
                total: 1,
                page: 1,
                pageSize: 20,
            },
        },
    })
    async list(
        @CurrentUser() user: any,
        @Query("page") page = "1",
        @Query("pageSize") pageSize = "20",
    ) {
        const paginated = await this.listNotifications.execute({
            userId: user.sub,
            page: parseInt(page, 10) || 1,
            pageSize: parseInt(pageSize, 10) || 20,
        });
        return {
            items: paginated.data.map((notification) => notification.toJSON()),
            total: paginated.total,
            page: paginated.page,
            pageSize: paginated.pageSize,
        };
    }

    @Patch(":id/read")
    @ApiOperation({
        summary: "Mark notifications as read",
        description: "Marks a notifications as read and publishes a realtimes notifications.read event"
    })
    @ApiResponse({status: 200, description: "Notification marked as read", type: NotificationReadPayloadDto})
    @ApiResponse({status: 404, description: "Notification not found or not owned by users", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Access denied", type: ErrorResponse})
    async read(@CurrentUser() user: any, @Param('id') id: string) {
        return this.markRead.execute({notificationId: id, userId: user.sub});
    }

    @Delete(":id")
    @ApiOperation({summary: "Delete a notifications"})
    @ApiResponse({status: 200, description: "Notification deleted"})
    @ApiResponse({status: 404, description: "Not found", type: ErrorResponse})
    async delete(@CurrentUser() user: any, @Param('id') id: string) {
        return this.deleteNotification.execute({notificationId: id, userId: user.sub});
    }

    @Delete()
    @ApiOperation({summary: "Delete multiple notifications"})
    @ApiBody({schema: {properties: {notificationIds: {type: 'array', items: {type: 'string'}}}}})
    @ApiResponse({status: 200, description: "Notifications deleted"})
    @ApiResponse({status: 403, description: "Forbidden", type: ErrorResponse})
    async deleteNotifications(@CurrentUser() user: any, @Body() body: { notificationIds: string[] }) {
        const {notificationIds} = body;
        return this.deleteNotificationsUseCase.execute({notificationIds, userId: user.sub});
    }

    @Post(":id/reply")
    @ApiOperation({
        summary: "Reply to notifications",
        description: "Reply to a notifications and send the response back to the original sender only"
    })
    @ApiResponse({status: 201, description: "Reply sent"})
    @ApiResponse({status: 404, description: "Notification not found or not belongs to users", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Access denied", type: ErrorResponse})
    async reply(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() body: { replyBody: string },
    ) {
        return this.replyToNotification.execute({
            notificationId: id,
            userId: user.sub,
            replyBody: body.replyBody,
        });
    }

    @Post("friend")
    @ApiOperation({summary: "Send a message to a friend"})
    @ApiResponse({
        status: 201,
        description: "Message sent to friend",
    })
    async sendToFriend(
        @CurrentUser() user: any,
        @Body() body: { friendEmail: string; title: string; body: string },
    ) {
        const result = await this.sendFriendMessage.execute({
            senderUserId: user.sub,
            friendEmail: body.friendEmail,
            title: body.title,
            body: body.body,
        });
        return {
            notification: result.notification ? result.notification.toJSON() : null,
            validationResult: result.validationResult,
        };
    }
}
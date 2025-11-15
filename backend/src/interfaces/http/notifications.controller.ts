import {Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards} from "@nestjs/common";
import {ApiCookieAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {SendNotificationUseCase} from "@application/use-cases/send-notification.usecase";
import {SendFriendMessageUseCase} from "@application/use-cases/send-friend-message.usecase";
import {ListNotificationsUseCase} from "@application/use-cases/list-notifications.usecase";
import {MarkNotificationReadUseCase} from "@application/use-cases/mark-notification-read.usecase";
import {DeleteNotificationUseCase} from "@application/use-cases/delete-notification.usecase";
import {ReplyToNotificationUseCase} from "@application/use-cases/reply-to-notification.usecase";
import {ErrorResponse} from "@application/dto/error.response.dto";
import {NotificationReadPayloadDto} from "@application/dto/realtime.dto";
import {SuccessCode} from "@application/success/success-code";
import {ErrorCode} from "@application/errors/error-code";

@ApiTags("notifications")
@ApiCookieAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(
        private readonly sendNotification: SendNotificationUseCase,
        private readonly sendFriendMessage: SendFriendMessageUseCase,
        private readonly listNotifications: ListNotificationsUseCase,
        private readonly markRead: MarkNotificationReadUseCase,
        private readonly deleteNotification: DeleteNotificationUseCase,
        private readonly replyToNotification: ReplyToNotificationUseCase,
    ) {
    }

    @Post()
    @ApiOperation({summary: "Send a global message to company members or friends"})
    @ApiResponse({
        status: 201,
        description: "Message queued for delivery",
        schema: {
            example: {
                notifications: [
                    {
                        id: "1",
                        companyId: "company-id",
                        senderUserId: "user-1",
                        recipientUserId: "user-2",
                        title: "Subject",
                        body: "Message body",
                        createdAt: "2025-11-13T10:00:00.000Z",
                        read: false,
                        meta: {kind: "notification.sent", channel: "company"},
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
        const result = await this.sendNotification.execute({
            companyId: body.companyId,
            senderUserId: user.sub,
            recipientsEmails: body.recipientsEmails,
            title: body.title,
            body: body.body,
            onlyOwnersAndAdmins: body.onlyOwnersAndAdmins,
        });
        return {
            notifications: result.notifications.map((notification) => notification.toJSON()),
            validationResults: result.validationResults,
        };
    }

    @Get()
    @ApiOperation({summary: "List notifications for the authenticated user"})
    @ApiResponse({
        status: 200,
        description: "Notifications returned",
        schema: {
            example: {
                items: [
                    {
                        id: "1",
                        companyId: "company-id",
                        senderUserId: "user-1",
                        recipientUserId: "user-2",
                        title: "Subject",
                        body: "Message body",
                        createdAt: "2025-11-13T10:00:00.000Z",
                        read: false,
                        meta: {kind: "notification.sent", channel: "company"},
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
        summary: "Mark notification as read",
        description: "Marks a notification as read and publishes a realtime notification.read event"
    })
    @ApiResponse({status: 200, description: "Notification marked as read", type: NotificationReadPayloadDto})
    @ApiResponse({status: 404, description: "Notification not found or not owned by user", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Access denied", type: ErrorResponse})
    async read(@CurrentUser() user: any, @Param('id') id: string) {
        return this.markRead.execute({notificationId: id, userId: user.sub});
    }

    @Delete(":id")
    @ApiOperation({summary: "Delete a notification"})
    @ApiResponse({status: 200, description: "Notification deleted"})
    @ApiResponse({status: 404, description: "Not found", type: ErrorResponse})
    async delete(@CurrentUser() user: any, @Param('id') id: string) {
        return this.deleteNotification.execute({notificationId: id, userId: user.sub});
    }

    @Post(":id/reply")
    @ApiOperation({
        summary: "Reply to notification",
        description: "Reply to a notification and send the response back to the original sender only"
    })
    @ApiResponse({status: 201, description: "Reply sent"})
    @ApiResponse({status: 404, description: "Notification not found or not belongs to user", type: ErrorResponse})
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
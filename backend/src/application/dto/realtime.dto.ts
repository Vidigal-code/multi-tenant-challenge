import {ApiProperty} from '@nestjs/swagger';

export class NotificationReadPayloadDto {
    @ApiProperty({example: 'notif_123', description: 'ID of the notification marked as read.'})
    notificationId!: string;
    @ApiProperty({example: 'comp_456', description: 'Related company (if applicable).'})
    companyId!: string;
    @ApiProperty({example: 'user_789', description: 'Notification recipient (user who received it).', required: false})
    recipientUserId?: string;
}

export class RealtimeEventCatalogDto {
    @ApiProperty({
        type: [String],
        example: ['company.updated', 'member.joined', 'notification.created', 'notification.read', 'invite.rejected']
    })
    events!: string[];
}

export class RealtimeRoomsResponseDto {
    @ApiProperty({type: [String], example: ['user:user_789', 'company:comp_456']})
    rooms!: string[];
    @ApiProperty({type: RealtimeEventCatalogDto})
    catalog!: RealtimeEventCatalogDto;
}
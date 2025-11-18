import {Controller, Get, Inject, UseGuards} from '@nestjs/common';
import {JwtAuthGuard} from '@common/guards/jwt.guard';
import {CurrentUser} from '@common/decorators/current-user.decorator';
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from '@domain/repositories/memberships/membership.repository';
import {RT_EVENT} from '../../../realtime/events.gateway';
import {ApiCookieAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags} from '@nestjs/swagger';
import {RealtimeRoomsResponseDto} from '@application/dto/realtimes/realtime.dto';
import {
    CompanyUpdatedEventDto,
    FriendRemovedEventDto,
    FriendRequestAcceptedEventDto,
    FriendRequestSentEventDto,
    InviteRejectedEventDto,
    MemberJoinedEventDto,
    MemberLeftEventDto,
    NotificationCreatedEventDto,
    NotificationReadEventDto,
    RealtimeEventDefinitionDto,
    RealtimeEventsCatalogResponseDto
} from '@application/dto/realtimes/realtime.events.dto';

@ApiTags('realtimes')
@ApiCookieAuth()
@ApiExtraModels(
    RealtimeRoomsResponseDto,
    RealtimeEventsCatalogResponseDto,
    RealtimeEventDefinitionDto,
    CompanyUpdatedEventDto,
    MemberJoinedEventDto,
    MemberLeftEventDto,
    NotificationCreatedEventDto,
    NotificationReadEventDto,
    InviteRejectedEventDto,
    FriendRequestSentEventDto,
    FriendRequestAcceptedEventDto,
    FriendRemovedEventDto,
)
@Controller('realtimes')
export class RealtimeController {
    constructor(@Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: MembershipRepository) {
    }

    @Get('rooms')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Realtime handshake',
        description: 'Returns rooms (users + companies) and event catalog for WebSocket client.'
    })
    @ApiOkResponse({description: 'Rooms and catalog', type: RealtimeRoomsResponseDto})
    async rooms(@CurrentUser() user: any) {
        const mems = await this.memberships.listByUser(user.sub);
        const companyRooms = mems.map(m => `company:${m.companyId}`);
        return {
            userRoom: `user:${user.sub}`,
            companyRooms,
            events: RT_EVENT,
            namespace: process.env.WS_NAMESPACE || '/rt',
        };
    }

    @Get('events')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({
        summary: 'Detailed realtimes events catalog',
        description: 'Lists each available event and example payload.'
    })
    @ApiOkResponse({type: RealtimeEventsCatalogResponseDto})
    async eventsCatalog() {
        const catalog = [
            {
                event: 'companys.updated',
                description: 'Company metadata updated.',
                example: {id: 'comp_123', name: 'New Company', logoUrl: '/logo.png'},
            },
            {
                event: 'member.joined',
                description: 'New member joined the companys.',
                example: {companyId: 'comp_123', userId: 'user_456', role: 'MEMBER'},
            },
            {
                event: 'member.left',
                description: 'Member left or was removed.',
                example: {companyId: 'comp_123', userId: 'user_456'},
            },
            {
                event: 'notifications.created',
                description: 'Notification created and delivered to recipients.',
                example: {notificationId: 'notif_1', companyId: 'comp_123', recipientUserId: 'user_789'},
            },
            {
                event: 'notifications.read',
                description: 'Notification marked as read.',
                example: {notificationId: 'notif_1', companyId: 'comp_123', recipientUserId: 'user_789'},
            },
            {
                event: 'invites.rejected',
                description: 'Invitation was rejected.',
                example: {inviteId: 'inv_123', companyId: 'comp_123'},
            },
            {
                event: 'friend.request.sent',
                description: 'Friend request sent.',
                example: {friendshipId: 'friend_123', requesterId: 'user_456', addresseeId: 'user_789'},
            },
            {
                event: 'friend.request.accepted',
                description: 'Friend request accepted.',
                example: {friendshipId: 'friend_123', requesterId: 'user_456', addresseeId: 'user_789'},
            },
            {
                event: 'friend.request.rejected',
                description: 'Friend request rejected.',
                example: {friendshipId: 'friend_123', requesterId: 'user_456', addresseeId: 'user_789'},
            },
        ];
        return {events: catalog};
    }
}

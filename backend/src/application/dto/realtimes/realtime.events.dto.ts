import { ApiProperty } from "@nestjs/swagger";

export class CompanyUpdatedEventDto {
  @ApiProperty() id!: string;
  @ApiProperty({ required: false }) name?: string;
  @ApiProperty({ required: false }) logoUrl?: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ required: false }) isPublic?: boolean;
}

export class MemberJoinedEventDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() userId!: string;
  @ApiProperty({ example: "MEMBER" }) role!: string;
}

export class MemberLeftEventDto {
  @ApiProperty() companyId!: string;
  @ApiProperty() userId!: string;
}

export class NotificationCreatedEventDto {
  @ApiProperty() notificationId!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty({ required: false }) recipientUserId?: string;
}

export class NotificationReadEventDto {
  @ApiProperty() notificationId!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty({ required: false }) recipientUserId?: string;
}

export class InviteRejectedEventDto {
  @ApiProperty() inviteId!: string;
  @ApiProperty() companyId!: string;
}

export class FriendRequestSentEventDto {
  @ApiProperty() friendshipId!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() addresseeId!: string;
}

export class FriendRequestAcceptedEventDto {
  @ApiProperty() friendshipId!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() addresseeId!: string;
}

export class FriendRemovedEventDto {
  @ApiProperty() friendshipId!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() addresseeId!: string;
}

export class RealtimeEventDefinitionDto {
  @ApiProperty({ example: "notifications.created" }) event!: string;
  @ApiProperty({ description: "JSON schema fields description" })
  description!: string;
  @ApiProperty({ type: Object, description: "Payload shape example" })
  example!: any;
}

export class RealtimeEventsCatalogResponseDto {
  @ApiProperty({ type: [RealtimeEventDefinitionDto] })
  events!: RealtimeEventDefinitionDto[];
}

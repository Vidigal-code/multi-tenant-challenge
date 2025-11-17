import { ApiProperty } from "@nestjs/swagger";

export class NotificationReadPayloadDto {
  @ApiProperty({
    example: "notif_123",
    description: "ID of the notifications marked as read.",
  })
  notificationId!: string;
  @ApiProperty({
    example: "comp_456",
    description: "Related companys (if applicable).",
  })
  companyId!: string;
  @ApiProperty({
    example: "user_789",
    description: "Notification recipient (users who received it).",
    required: false,
  })
  recipientUserId?: string;
}

export class RealtimeEventCatalogDto {
  @ApiProperty({
    type: [String],
    example: [
      "companys.updated",
      "member.joined",
      "notifications.created",
      "notifications.read",
      "invites.rejected",
    ],
  })
  events!: string[];
}

export class RealtimeRoomsResponseDto {
  @ApiProperty({
    type: [String],
    example: ["users:user_789", "companys:comp_456"],
  })
  rooms!: string[];
  @ApiProperty({ type: RealtimeEventCatalogDto })
  catalog!: RealtimeEventCatalogDto;
}

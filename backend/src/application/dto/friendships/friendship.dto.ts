import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendFriendRequestDto {
  @ApiProperty({ example: "friend@example.com" })
  @IsEmail()
  email!: string;
}

export class AcceptFriendRequestDto {
  @ApiProperty({ example: "friendships-id" })
  @IsString()
  friendshipId!: string;
}

export class RejectFriendRequestDto {
  @ApiProperty({ example: "friendships-id" })
  @IsString()
  friendshipId!: string;
}

export class ListFriendshipsDto {
  @ApiProperty({ example: "ACCEPTED", required: false })
  @IsOptional()
  @IsIn(["PENDING", "ACCEPTED", "BLOCKED"])
  status?: string;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  page?: number = 1;

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  pageSize?: number = 10;
}

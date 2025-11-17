import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsObject,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: "John New" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ example: "john.new@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Current password to confirm sensitive changes.",
    example: "oldPassword123",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  currentPassword?: string;

  @ApiPropertyOptional({ example: "NewPassword#2025" })
  @IsOptional()
  @IsString()
  @MinLength(8)
  newPassword?: string;

  @ApiPropertyOptional({
    description: "Notification preferences",
    example: { emailNotifications: true, pushNotifications: false },
  })
  @IsOptional()
  @IsObject()
  notificationPreferences?: Record<string, any>;
}

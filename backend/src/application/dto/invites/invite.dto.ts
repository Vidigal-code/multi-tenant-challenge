import {IsEmail, IsEnum} from "class-validator";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {Role} from "@domain/enums/role.enum";

export class InviteDto {
    @ApiProperty({example: "member@example.com"})
    @IsEmail()
    email!: string;

    @ApiProperty({enum: Role, example: Role.MEMBER})
    @IsEnum(Role)
    role!: Role;
}

export class InviteCreatedResponse {
    @ApiProperty({example: 'inv_123'})
    id!: string;

    @ApiProperty({example: 'member@example.com'})
    email!: string;

    @ApiProperty({example: 'MEMBER'})
    role!: 'OWNER' | 'ADMIN' | 'MEMBER';

    @ApiProperty({example: 'abc123token'})
    token!: string;

    @ApiProperty({example: '2025-11-19T10:00:00.000Z'})
    expiresAt!: string;

    @ApiProperty({example: 'http://localhost:3000/invite/abc123token'})
    inviteUrl!: string;

    @ApiProperty({example: 'INVITE_CREATED'})
    message!: string;

    @ApiPropertyOptional({example: 'usr_123'})
    inviterId?: string;
}

export class InviteInfoResponse {
    @ApiProperty({example: 'inv_123'})
    id!: string;

    @ApiProperty({example: 'comp_456'})
    companyId!: string;

    @ApiProperty({example: 'users@example.com'})
    email!: string;

    @ApiProperty({example: 'PENDING'})
    status!: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

    @ApiProperty({example: 'MEMBER'})
    role!: 'OWNER' | 'ADMIN' | 'MEMBER';

    @ApiProperty({example: '2025-11-12T10:00:00.000Z'})
    createdAt!: string;

    @ApiProperty({example: '2025-11-19T10:00:00.000Z'})
    expiresAt!: string;

    @ApiPropertyOptional({example: 'usr_123'})
    inviterId?: string;
}

export class SuccessResponse {
    @ApiProperty({example: true})
    success!: boolean;
}
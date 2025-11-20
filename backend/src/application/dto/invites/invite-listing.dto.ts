import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {Type} from "class-transformer";
import {IsIn, IsInt, IsOptional, Max, Min} from "class-validator";

export type InviteListJobStatus = "pending" | "processing" | "completed" | "failed";

export interface InviteListJobMeta {
    jobId: string;
    userId: string;
    type: "created" | "received";
    status: InviteListJobStatus;
    chunkSize: number;
    processed: number;
    total?: number;
    createdAt: string;
    finishedAt?: string;
    error?: string;
}

export interface InviteListItem {
    id: string;
    companyId: string;
    email: string;
    role: string;
    status: string;
    token: string;
    inviterId?: string | null;
    inviterName?: string | null;
    inviterEmail?: string | null;
    recipientName?: string | null;
    recipientEmail?: string | null;
    inviteUrl?: string | null;
    createdAt: string;
    expiresAt?: string | null;
    name?: string | null;
    description?: string | null;
    logoUrl?: string | null;
}

export interface InviteListJobPayload {
    jobId: string;
    userId: string;
    userEmail?: string;
    type: "created" | "received";
    chunkSize: number;
}

export class InviteListItemResponseDto implements InviteListItem {
    @ApiProperty()
    id!: string;

    @ApiProperty()
    companyId!: string;

    @ApiProperty()
    email!: string;

    @ApiProperty()
    role!: string;

    @ApiProperty()
    status!: string;

    @ApiProperty()
    token!: string;

    @ApiPropertyOptional()
    inviterId?: string | null;

    @ApiPropertyOptional()
    inviterName?: string | null;

    @ApiPropertyOptional()
    inviterEmail?: string | null;

    @ApiPropertyOptional()
    recipientName?: string | null;

    @ApiPropertyOptional()
    recipientEmail?: string | null;

    @ApiPropertyOptional()
    inviteUrl?: string | null;

    @ApiProperty()
    createdAt!: string;

    @ApiPropertyOptional()
    expiresAt?: string | null;

    @ApiPropertyOptional()
    name?: string | null;

    @ApiPropertyOptional()
    description?: string | null;

    @ApiPropertyOptional()
    logoUrl?: string | null;
}

export class CreateInviteListJobDto {
    @ApiProperty({enum: ["created", "received"]})
    @IsIn(["created", "received"])
    type!: "created" | "received";

    @ApiPropertyOptional({minimum: 50, maximum: 5000})
    @IsOptional()
    @IsInt()
    @Min(50)
    @Max(5000)
    @Type(() => Number)
    chunkSize?: number;
}

export class InviteListQueryDto {
    @ApiPropertyOptional({minimum: 0, default: 0})
    @IsOptional()
    @IsInt()
    @Min(0)
    @Type(() => Number)
    cursor?: number = 0;

    @ApiPropertyOptional({minimum: 1, maximum: 1000, default: 200})
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(1000)
    @Type(() => Number)
    pageSize?: number = 200;
}

export class InviteListJobResponseDto {
    @ApiProperty({example: "job_123"})
    jobId!: string;

    @ApiProperty({example: 0})
    cursor!: number;

    @ApiProperty({enum: ["pending", "processing", "completed", "failed"]})
    status!: InviteListJobStatus;

    @ApiProperty({example: 2000})
    processed!: number;

    @ApiPropertyOptional({example: 5000})
    total?: number;

    @ApiProperty({example: false})
    done!: boolean;

    @ApiPropertyOptional({example: 200})
    nextCursor?: number | null;

    @ApiProperty({type: [InviteListItemResponseDto]})
    items!: InviteListItemResponseDto[];

    @ApiPropertyOptional({example: "Optional failure message"})
    error?: string;
}

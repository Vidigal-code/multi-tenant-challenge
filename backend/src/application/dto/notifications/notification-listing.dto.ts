import {IsNumber, IsOptional} from "class-validator";
import {ApiProperty} from "@nestjs/swagger";

export class CreateNotificationListJobDto {
    @ApiProperty({
        description: "Optional chunk size for processing",
        example: 1000,
        required: false
    })
    @IsNumber()
    @IsOptional()
    chunkSize?: number;

    @ApiProperty({
        description: "Filter type (e.g. invites, friends)",
        required: false
    })
    @IsOptional()
    type?: string;
}

export class NotificationListItem {
    id!: string;
    companyId!: string;
    senderUserId!: string;
    recipientUserId!: string;
    title!: string;
    body!: string;
    createdAt!: string;
    read!: boolean;
    meta: any;
    sender?: {
        id: string;
        name: string;
        email: string;
    };
}

export class NotificationListJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    processed!: number;

    @ApiProperty({required: false})
    total?: number;

    @ApiProperty({type: [NotificationListItem]})
    items!: NotificationListItem[];

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    nextCursor?: number;

    @ApiProperty({required: false})
    error?: string;
}

export class NotificationListQueryDto {
    @ApiProperty({required: false})
    @IsOptional()
    cursor?: number;

    @ApiProperty({required: false})
    @IsOptional()
    pageSize?: number;
}

export interface NotificationListingJobPayload {
    jobId: string;
    userId: string;
    chunkSize: number;
    type?: string;
}

export interface NotificationListJobMeta {
    jobId: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed: number;
    total?: number;
    nextCursor?: number | null;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
}

import {ApiProperty} from "@nestjs/swagger";
import {IsArray, IsBoolean, IsOptional, IsString} from "class-validator";

export class CreateNotificationDeleteJobDto {
    @ApiProperty({
        description: "List of notification IDs to delete",
        required: false,
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({each: true})
    ids?: string[];

    @ApiProperty({
        description: "If true, delete all notifications for the user",
        required: false,
        type: Boolean
    })
    @IsOptional()
    @IsBoolean()
    deleteAll?: boolean;
}

export class NotificationDeleteJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    deletedCount!: number;

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    error?: string;
}

export interface NotificationDeletionJobPayload {
    jobId: string;
    userId: string;
    ids?: string[];
    deleteAll?: boolean;
}

export interface NotificationDeleteJobMeta {
    jobId: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    deletedCount: number;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
}


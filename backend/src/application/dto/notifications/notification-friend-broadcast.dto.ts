import {ApiProperty} from "@nestjs/swagger";

export class CreateFriendBroadcastJobDto {
    @ApiProperty({description: "Notification title"})
    title!: string;

    @ApiProperty({description: "Notification body"})
    body!: string;

    @ApiProperty({
        required: false,
        description: "Specific friend emails (selective mode). Leave empty to broadcast to all accepted friends.",
        type: [String],
    })
    recipientsEmails?: string[];
}

export class NotificationFriendBroadcastJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    processed!: number;

    @ApiProperty({required: false})
    totalTargets?: number;

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    error?: string;
}

export interface NotificationFriendBroadcastJobPayload {
    jobId: string;
    userId: string;
    step: 'INIT' | 'SELECTED' | 'FRIENDS';
    index?: number;
    cursor?: string | null;
}

export interface NotificationFriendBroadcastJobMeta {
    jobId: string;
    userId: string;
    title: string;
    body: string;
    mode: 'selected' | 'friends';
    selectedTargets?: string[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed: number;
    totalTargets?: number;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
}


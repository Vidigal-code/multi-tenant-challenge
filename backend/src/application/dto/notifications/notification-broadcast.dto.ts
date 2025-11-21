import {ApiProperty} from "@nestjs/swagger";

export class CreateNotificationBroadcastJobDto {
    @ApiProperty({description: "Company identifier that owns the broadcast"})
    companyId!: string;

    @ApiProperty({description: "Notification title"})
    title!: string;

    @ApiProperty({description: "Notification body"})
    body!: string;

    @ApiProperty({
        required: false,
        description: "Specific recipient emails (selected mode). When omitted the broadcast targets company members.",
        type: [String],
    })
    recipientsEmails?: string[];

    @ApiProperty({
        required: false,
        description: "Restrict broadcast to owners/admins when targeting company members.",
    })
    onlyOwnersAndAdmins?: boolean;
}

export class NotificationBroadcastJobResponseDto {
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

export interface NotificationBroadcastJobPayload {
    jobId: string;
    userId: string;
    step: 'INIT' | 'SELECTED' | 'MEMBERS';
    index?: number;
    cursor?: string | null;
}

export interface NotificationBroadcastJobMeta {
    jobId: string;
    userId: string;
    companyId: string;
    title: string;
    body: string;
    onlyOwnersAndAdmins: boolean;
    mode: 'selected' | 'members';
    selectedTargets?: string[];
    status: 'pending' | 'processing' | 'completed' | 'failed';
    processed: number;
    totalTargets?: number;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
}


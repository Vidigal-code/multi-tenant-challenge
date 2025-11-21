import {ApiProperty} from "@nestjs/swagger";

export class CreateUserDeleteJobDto {}

export class UserDeleteJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    progress!: number; // 0 to 100

    @ApiProperty()
    currentStep!: string;

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    error?: string;
}

export interface UserDeletionJobPayload {
    jobId: string;
    userId: string;
    step?: 'INIT' | 'OWNED_COMPANIES' | 'MEMBERSHIPS' | 'NOTIFICATIONS' | 'FRIENDSHIPS' | 'INVITES' | 'USER';
    cursor?: string | null;
    totalOwnedCompanies?: number;
    deletedOwnedCompanies?: number;
}

export interface UserDeleteJobMeta {
    jobId: string;
    userId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    currentStep: string;
    startedAt?: number;
    finishedAt?: number;
    error?: string;
}


import {IsNumber, IsOptional, IsString} from "class-validator";
import {ApiProperty} from "@nestjs/swagger";

export class CreateFriendshipListJobDto {
    @ApiProperty({
        description: "Optional chunk size for processing",
        example: 1000,
        required: false
    })
    @IsNumber()
    @IsOptional()
    chunkSize?: number;

    @ApiProperty({
        description: "Friendship status to filter (PENDING, ACCEPTED, etc.)",
        example: "ACCEPTED",
        required: false
    })
    @IsString()
    @IsOptional()
    status?: string;
}

export class FriendshipListItem {
    id!: string;
    requesterId!: string;
    addresseeId!: string;
    status!: string;
    createdAt!: string;
    updatedAt!: string;
    friend?: {
        id: string;
        name: string;
        email: string;
    };
}

export class FriendshipListJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    processed!: number;

    @ApiProperty({required: false})
    total?: number;

    @ApiProperty({type: [FriendshipListItem]})
    items!: FriendshipListItem[];

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    nextCursor?: number;

    @ApiProperty({required: false})
    error?: string;
}

export class FriendshipListQueryDto {
    @ApiProperty({required: false})
    @IsOptional()
    cursor?: number;

    @ApiProperty({required: false})
    @IsOptional()
    pageSize?: number;
}

export interface FriendshipListingJobPayload {
    jobId: string;
    userId: string;
    status?: string;
    chunkSize: number;
}

export interface FriendshipListJobMeta {
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


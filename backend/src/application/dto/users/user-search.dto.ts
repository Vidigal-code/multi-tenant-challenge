import {IsNumber, IsOptional, IsString} from "class-validator";
import {ApiProperty} from "@nestjs/swagger";

export class CreateUserSearchJobDto {
    @ApiProperty({
        description: "Search query string",
        example: "john",
    })
    @IsString()
    query!: string;

    @ApiProperty({
        description: "Optional chunk size for processing",
        example: 1000,
        required: false
    })
    @IsNumber()
    @IsOptional()
    chunkSize?: number;
}

export class UserSearchItem {
    id!: string;
    name!: string;
    email!: string;
}

export class UserSearchJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ['pending', 'processing', 'completed', 'failed']})
    status!: 'pending' | 'processing' | 'completed' | 'failed';

    @ApiProperty()
    processed!: number;

    @ApiProperty({required: false})
    total?: number;

    @ApiProperty({type: [UserSearchItem]})
    items!: UserSearchItem[];

    @ApiProperty()
    done!: boolean;

    @ApiProperty({required: false})
    nextCursor?: number;

    @ApiProperty({required: false})
    error?: string;
}

export class UserSearchQueryDto {
    @ApiProperty({required: false})
    @IsOptional()
    cursor?: number;

    @ApiProperty({required: false})
    @IsOptional()
    pageSize?: number;
}

export interface UserSearchJobPayload {
    jobId: string;
    userId: string;
    query: string;
    chunkSize: number;
}

export interface UserSearchJobMeta {
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


import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {Type} from "class-transformer";
import {ArrayNotEmpty, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min} from "class-validator";

export type InviteBulkAction = "delete" | "reject";
export type InviteBulkScope = "selected" | "all";
export type InviteBulkJobStatus = "pending" | "processing" | "completed" | "failed";

export interface InviteBulkJobMeta {
    jobId: string;
    userId: string;
    action: InviteBulkAction;
    scope: InviteBulkScope;
    chunkSize: number;
    processed: number;
    succeeded: number;
    failed: number;
    status: InviteBulkJobStatus;
    createdAt: string;
    finishedAt?: string;
    error?: string;
}

export interface InviteBulkJobPayload {
    jobId: string;
    userId: string;
    action: InviteBulkAction;
    scope: InviteBulkScope;
    chunkSize: number;
    inviteIds?: string[];
    userEmail?: string;
}

export class CreateInviteBulkJobDto {
    @ApiProperty({enum: ["delete", "reject"]})
    @IsIn(["delete", "reject"])
    action!: InviteBulkAction;

    @ApiProperty({enum: ["selected", "all"]})
    @IsIn(["selected", "all"])
    scope!: InviteBulkScope;

    @ApiPropertyOptional({type: [String], description: "Required when scope=selected"})
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({each: true})
    inviteIds?: string[];

    @ApiPropertyOptional({minimum: 50, maximum: 2000})
    @IsOptional()
    @IsInt()
    @Min(50)
    @Max(2000)
    @Type(() => Number)
    chunkSize?: number;
}

export class InviteBulkJobResponseDto {
    @ApiProperty()
    jobId!: string;

    @ApiProperty({enum: ["pending", "processing", "completed", "failed"]})
    status!: InviteBulkJobStatus;

    @ApiProperty()
    processed!: number;

    @ApiProperty()
    succeeded!: number;

    @ApiProperty()
    failed!: number;

    @ApiPropertyOptional()
    error?: string;
}


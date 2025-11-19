import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {IsArray, IsEnum, IsIn, IsOptional, ArrayMinSize, ArrayMaxSize, IsInt, Min, Max, IsString, Matches} from "class-validator";
import {Type} from "class-transformer";

export type InviteBulkAction = "delete" | "reject";
export type InviteBulkTarget = "created" | "received";
export type InviteBulkScope = "selected" | "all";
export type InviteBulkJobStatus = "pending" | "processing" | "completed" | "failed";

export class CreateInviteBulkJobDto {
    @ApiProperty({enum: ["delete", "reject"]})
    @IsIn(["delete", "reject"])
    action!: InviteBulkAction;

    @ApiProperty({enum: ["created", "received"]})
    @IsIn(["created", "received"])
    target!: InviteBulkTarget;

    @ApiProperty({enum: ["selected", "all"]})
    @IsIn(["selected", "all"])
    scope!: InviteBulkScope;

    @ApiPropertyOptional({type: [String], description: "List of invite IDs when scope=selected"})
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(1000)
    @IsString({each: true})
    @Matches(/^[a-z0-9]+$/i, {each: true})
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
    @ApiProperty({example: "job_123"})
    jobId!: string;

    @ApiProperty({enum: ["pending", "processing", "completed", "failed"]})
    status!: InviteBulkJobStatus;

    @ApiProperty({example: 100})
    processed!: number;

    @ApiProperty({example: 100})
    total!: number;

    @ApiProperty({example: 0})
    failedCount!: number;

    @ApiPropertyOptional({example: "Optional failure reason"})
    error?: string;
}


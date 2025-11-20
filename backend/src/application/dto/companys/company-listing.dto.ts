import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";
import {Type} from "class-transformer";
import {IsIn, IsInt, IsOptional, Max, Min} from "class-validator";

export type CompanyListingJobType = "primary-owner" | "member";
export type CompanyListingJobStatus = "pending" | "processing" | "completed" | "failed";

export interface CompanyListingJobMeta {
    jobId: string;
    userId: string;
    type: CompanyListingJobType;
    status: CompanyListingJobStatus;
    chunkSize: number;
    processed: number;
    total?: number;
    createdAt: string;
    finishedAt?: string;
    error?: string;
}

export interface CompanyListingJobPayload {
    jobId: string;
    userId: string;
    type: CompanyListingJobType;
    chunkSize: number;
}

export interface CompanyListingItem {
    id: string;
    name: string;
    logoUrl?: string | null;
    description?: string | null;
    isPublic: boolean;
    createdAt: string;
    memberCount: number;
    primaryOwnerName: string;
    primaryOwnerEmail: string;
    userRole?: string;
}

export class CreateCompanyListingJobDto {
    @ApiProperty({enum: ["primary-owner", "member"]})
    @IsIn(["primary-owner", "member"])
    type!: CompanyListingJobType;

    @ApiPropertyOptional({minimum: 50, maximum: 5000})
    @IsOptional()
    @IsInt()
    @Min(50)
    @Max(5000)
    @Type(() => Number)
    chunkSize?: number;
}

export class CompanyListingJobOptionsDto {
    @ApiPropertyOptional({minimum: 50, maximum: 5000})
    @IsOptional()
    @IsInt()
    @Min(50)
    @Max(5000)
    @Type(() => Number)
    chunkSize?: number;
}

export class CompanyListingQueryDto {
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

export class CompanyListingJobResponseDto {
    @ApiProperty({example: "job_123"})
    jobId!: string;

    @ApiProperty({example: 0})
    cursor!: number;

    @ApiProperty({enum: ["pending", "processing", "completed", "failed"]})
    status!: CompanyListingJobStatus;

    @ApiProperty({example: 2000})
    processed!: number;

    @ApiPropertyOptional({example: 5000})
    total?: number;

    @ApiProperty({example: false})
    done!: boolean;

    @ApiPropertyOptional({example: 200})
    nextCursor?: number | null;

    @ApiProperty({type: Array})
    items!: CompanyListingItem[];

    @ApiPropertyOptional({example: "Optional failure message"})
    error?: string;
}


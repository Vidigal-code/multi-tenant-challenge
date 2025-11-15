import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";

export class PrimaryOwnerCompanyDto {
    @ApiProperty({example: 'comp_123', description: 'Company ID'})
    id!: string;

    @ApiProperty({example: 'Acme Corp', description: 'Company name'})
    name!: string;

    @ApiPropertyOptional({example: 'https://example.com/logo.png', description: 'Company logo URL'})
    logoUrl?: string | null;

    @ApiPropertyOptional({example: 'A leading technology company', description: 'Company description'})
    description?: string | null;

    @ApiProperty({example: true, description: 'Whether the company is public'})
    isPublic!: boolean;

    @ApiProperty({example: '2025-11-12T10:00:00.000Z', description: 'Company creation date'})
    createdAt!: string;

    @ApiProperty({example: 5, description: 'Total number of members in the company'})
    memberCount!: number;

    @ApiProperty({example: 'John Doe', description: 'Primary owner name'})
    primaryOwnerName!: string;

    @ApiProperty({example: 'john.doe@example.com', description: 'Primary owner email'})
    primaryOwnerEmail!: string;
}

export class PrimaryOwnerCompaniesResponseDto {
    @ApiProperty({type: [PrimaryOwnerCompanyDto], description: 'List of primary owner companies'})
    data!: PrimaryOwnerCompanyDto[];

    @ApiProperty({example: 10, description: 'Total number of companies'})
    total!: number;

    @ApiProperty({example: 1, description: 'Current page number'})
    page!: number;

    @ApiProperty({example: 10, description: 'Number of items per page'})
    pageSize!: number;
}


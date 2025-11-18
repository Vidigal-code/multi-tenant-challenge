import {IsBoolean, IsOptional, IsString, MaxLength, MinLength} from "class-validator";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";

export class CreateCompanyDto {
    @ApiProperty({example: "Acme Corp"})
    @IsString()
    @MinLength(2)
    name!: string;

    @ApiPropertyOptional({example: "https://example.com/logo.png"})
    @IsOptional()
    @IsString()
    logoUrl?: string;

    @ApiPropertyOptional({example: "Company description", maxLength: 400})
    @IsOptional()
    @IsString()
    @MaxLength(400)
    description?: string;

    @ApiPropertyOptional({example: true})
    @IsOptional()
    @IsBoolean()
    is_public?: boolean;
}

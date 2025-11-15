import {IsOptional, IsString, MinLength} from "class-validator";
import {ApiProperty, ApiPropertyOptional} from "@nestjs/swagger";

export class AcceptInviteDto {
    @ApiProperty({example: "some-random-token-here"})
    @IsString()
    token!: string;

    @ApiPropertyOptional({example: "John Doe"})
    @IsOptional()
    @IsString()
    @MinLength(2)
    name?: string;

    @ApiPropertyOptional({example: "password123"})
    @IsOptional()
    @IsString()
    @MinLength(8)
    password?: string;
}

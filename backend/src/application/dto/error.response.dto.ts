import {ApiProperty} from '@nestjs/swagger';

export class ErrorResponse {
    @ApiProperty({example: 400})
    statusCode!: number;

    @ApiProperty({example: 'FORBIDDEN_ACTION', description: 'Standardized error code'})
    code!: string;

    @ApiProperty({example: 'Operação não permitida.'})
    message!: string;

    @ApiProperty({example: '2025-11-12T10:00:00.000Z'})
    timestamp!: string;

    @ApiProperty({example: '/auth/profile'})
    path!: string;
}

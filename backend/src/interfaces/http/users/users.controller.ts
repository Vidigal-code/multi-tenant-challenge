import {Body, Controller, Delete, Get, Param, Post, Query, UseGuards} from '@nestjs/common';
import {ApiCookieAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags} from '@nestjs/swagger';
import {JwtAuthGuard} from '@common/guards/jwt.guard';
import {CurrentUser} from '@common/decorators/current-user.decorator';
import {SearchUsersUseCase} from '@application/use-cases/users/search-users.usecase';
import {UserDeletionJobsService} from "@application/services/user-deletion-jobs.service";
import {CreateUserDeleteJobDto, UserDeleteJobResponseDto} from "@application/dto/users/user-deletion.dto";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {JwtPayload} from "@infrastructure/auth/jwtconfig/jwt.strategy";

@ApiTags('users')
@ApiCookieAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(
        private readonly searchUsersUseCase: SearchUsersUseCase,
        private readonly deletionJobs: UserDeletionJobsService,
    ) {
    }

    @Get('search')
    @ApiOperation({summary: 'Search users by name or email'})
    @ApiQuery({name: 'q', description: 'Search query for name or email'})
    @ApiResponse({status: 200, description: 'List of matching users'})
    async searchUsers(
        @Query('q') query: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.searchUsersUseCase.execute({
            query,
            currentUserId: user.sub,
        });
    }

    @Delete('me')
    @ApiOperation({summary: 'Start background job to delete current users account.'})
    @ApiResponse({
        status: 201,
        description: 'Job created',
        schema: {example: {jobId: "uuid", status: "pending", progress: 0, currentStep: "INIT", done: false}},
    })
    async deleteAccount(
        @CurrentUser() user: JwtPayload,
    ) {
        const meta = await this.deletionJobs.createJob({sub: user.sub, email: user.email}, {});
        return {
            jobId: meta.jobId,
            status: meta.status,
            progress: meta.progress,
            currentStep: meta.currentStep,
            done: false,
        };
    }

    @Get("deletion-jobs/:jobId")
    @ApiOperation({summary: "Get user deletion job status"})
    @ApiResponse({status: 200, type: UserDeleteJobResponseDto})
    @ApiResponse({status: 404, description: "Job not found", type: ErrorResponse})
    async getDeletionJob(
        @CurrentUser() user: JwtPayload,
        @Param("jobId") jobId: string,
    ) {
        return this.deletionJobs.getJob(user.sub, jobId);
    }
}
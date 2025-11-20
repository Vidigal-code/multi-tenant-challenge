import {Body, Controller, Delete, Get, Param, Post, Query, UseGuards} from "@nestjs/common";
import {ApiCookieAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {SendFriendRequestUseCase} from "@application/use-cases/friendships/send-friend-request.usecase";
import {AcceptFriendRequestUseCase} from "@application/use-cases/friendships/accept-friend-request.usecase";
import {RejectFriendRequestUseCase} from "@application/use-cases/friendships/reject-friend-request.usecase";
import {DeleteFriendshipUseCase} from "@application/use-cases/friendships/delete-friendship.usecase";
import {ListFriendshipsUseCase} from "@application/use-cases/friendships/list-friendships.usecase";
import {SearchUsersUseCase} from "@application/use-cases/users/search-users.usecase";
import {
    AcceptFriendRequestDto,
    ListFriendshipsDto,
    RejectFriendRequestDto,
    SendFriendRequestDto
} from "@application/dto/friendships/friendship.dto";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {SuccessCode} from "@application/success/success-code";
import {FriendshipListingJobsService} from "@application/services/friendship-listing-jobs.service";
import {UserSearchJobsService} from "@application/services/user-search-jobs.service";
import {
    CreateFriendshipListJobDto,
    FriendshipListJobResponseDto,
    FriendshipListQueryDto
} from "@application/dto/friendships/friendship-listing.dto";
import {
    CreateUserSearchJobDto,
    UserSearchJobResponseDto,
    UserSearchQueryDto
} from "@application/dto/users/user-search.dto";

@ApiTags("friendships")
@ApiCookieAuth()
@Controller("friendships")
@UseGuards(JwtAuthGuard)
export class FriendshipController {
    constructor(
        private readonly sendFriendRequest: SendFriendRequestUseCase,
        private readonly acceptFriendRequest: AcceptFriendRequestUseCase,
        private readonly rejectFriendRequest: RejectFriendRequestUseCase,
        private readonly deleteFriendship: DeleteFriendshipUseCase,
        private readonly listFriendships: ListFriendshipsUseCase,
        private readonly searchUsers: SearchUsersUseCase,
        private readonly friendshipJobs: FriendshipListingJobsService,
        private readonly userSearchJobs: UserSearchJobsService,
    ) {
    }

    @Post("request")
    @ApiOperation({summary: "Send friend request"})
    @ApiResponse({status: 201, description: "Friend request sent"})
    @ApiResponse({status: 400, description: "Invalid request", type: ErrorResponse})
    @ApiResponse({status: 409, description: "Already friends or request exists", type: ErrorResponse})
    async sendRequest(
        @CurrentUser() user: any,
        @Body() body: SendFriendRequestDto,
    ) {
        const {friendship} = await this.sendFriendRequest.execute({
            requesterId: user.sub,
            addresseeEmail: body.email,
        });
        return {
            friendship: friendship.toJSON(),
            code: SuccessCode.FRIEND_REQUEST_SENT,
        };
    }

    @Post("accept")
    @ApiOperation({summary: "Accept friend request"})
    @ApiResponse({status: 200, description: "Friend request accepted"})
    @ApiResponse({status: 400, description: "Invalid request", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Cannot accept others' requests", type: ErrorResponse})
    async acceptRequest(
        @CurrentUser() user: any,
        @Body() body: AcceptFriendRequestDto,
    ) {
        const {friendship} = await this.acceptFriendRequest.execute({
            friendshipId: body.friendshipId,
            userId: user.sub,
        });
        return {
            friendship: friendship.toJSON(),
            code: SuccessCode.FRIEND_REQUEST_ACCEPTED,
        };
    }

    @Post(":friendshipId/accept")
    @ApiOperation({summary: "Accept friend request by ID"})
    @ApiResponse({status: 200, description: "Friend request accepted"})
    @ApiResponse({status: 400, description: "Invalid request", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Cannot accept others' requests", type: ErrorResponse})
    async acceptRequestById(
        @CurrentUser() user: any,
        @Param("friendshipId") friendshipId: string,
    ) {
        const {friendship} = await this.acceptFriendRequest.execute({
            friendshipId,
            userId: user.sub,
        });
        return {
            friendship: friendship.toJSON(),
            code: SuccessCode.FRIEND_REQUEST_ACCEPTED,
        };
    }

    @Post("reject")
    @ApiOperation({summary: "Reject friend request"})
    @ApiResponse({status: 200, description: "Friend request rejected"})
    @ApiResponse({status: 400, description: "Invalid request", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Cannot reject others' requests", type: ErrorResponse})
    async rejectRequest(
        @CurrentUser() user: any,
        @Body() body: RejectFriendRequestDto,
    ) {
        await this.rejectFriendRequest.execute({
            friendshipId: body.friendshipId,
            userId: user.sub,
        });
        return {success: true};
    }

    @Delete(":friendshipId")
    @ApiOperation({summary: "Delete friendships (any status) or reject friend request"})
    @ApiResponse({status: 200, description: "Friendship deleted"})
    @ApiResponse({status: 400, description: "Invalid request", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Cannot delete others' friendships", type: ErrorResponse})
    async deleteFriendshipEndpoint(
        @CurrentUser() user: any,
        @Param("friendshipId") friendshipId: string,
    ) {
        await this.deleteFriendship.execute({
            friendshipId,
            userId: user.sub,
        });
        return {success: true};
    }

    @Get("listing/:jobId")
    @ApiOperation({summary: "Get friendship listing job status and page"})
    @ApiResponse({status: 200, type: FriendshipListJobResponseDto})
    @ApiResponse({status: 404, description: "Job not found", type: ErrorResponse})
    async getListingJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
        @Query() query: FriendshipListQueryDto,
    ) {
        return this.friendshipJobs.getJob(user.sub, jobId, query);
    }

    @Delete("listing/:jobId")
    @ApiOperation({summary: "Delete/Cancel a friendship listing job"})
    @ApiResponse({status: 200, description: "Job deleted"})
    async deleteListingJob(@CurrentUser() user: any, @Param("jobId") jobId: string) {
        await this.friendshipJobs.deleteJob(user.sub, jobId);
        return {success: true};
    }

    @Post("listing")
    @ApiOperation({summary: "Start a background job to list friendships"})
    @ApiResponse({
        status: 201,
        description: "Job created",
        schema: {example: {jobId: "uuid", status: "pending", processed: 0, items: [], done: false}},
    })
    async createListingJob(@CurrentUser() user: any, @Body() body: CreateFriendshipListJobDto) {
        const meta = await this.friendshipJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            items: [],
            done: false,
        };
    }

    @Post("search/listing")
    @ApiOperation({summary: "Start a background job to search users"})
    @ApiResponse({
        status: 201,
        description: "Job created",
        schema: {example: {jobId: "uuid", status: "pending", processed: 0, items: [], done: false}},
    })
    async createUserSearchJob(@CurrentUser() user: any, @Body() body: CreateUserSearchJobDto) {
        const meta = await this.userSearchJobs.createJob({sub: user.sub, email: user.email}, body);
        return {
            jobId: meta.jobId,
            status: meta.status,
            processed: meta.processed,
            items: [],
            done: false,
        };
    }

    @Get("search/listing/:jobId")
    @ApiOperation({summary: "Get user search job status and page"})
    @ApiResponse({status: 200, type: UserSearchJobResponseDto})
    @ApiResponse({status: 404, description: "Job not found", type: ErrorResponse})
    async getUserSearchJob(
        @CurrentUser() user: any,
        @Param("jobId") jobId: string,
        @Query() query: UserSearchQueryDto,
    ) {
        return this.userSearchJobs.getJob(user.sub, jobId, query);
    }

    @Delete("search/listing/:jobId")
    @ApiOperation({summary: "Delete/Cancel a user search job"})
    @ApiResponse({status: 200, description: "Job deleted"})
    async deleteUserSearchJob(@CurrentUser() user: any, @Param("jobId") jobId: string) {
        await this.userSearchJobs.deleteJob(user.sub, jobId);
        return {success: true};
    }

    @Get()
    @ApiOperation({summary: "List users's friendships"})
    @ApiResponse({status: 200, description: "Friendships listed"})
    async list(
        @CurrentUser() user: any,
        @Query() query: ListFriendshipsDto,
    ) {
        const result = await this.listFriendships.execute({
            userId: user.sub,
            status: query.status as any,
            page: query.page || 1,
            pageSize: query.pageSize || 10,
        });
        const friendships = result.data.map(f => {
            const json = f.toJSON();
            const record = (result as any).recordsWithUsers?.find((r: any) => r.id === f.id);
            if (record) {
                return {
                    ...json,
                    requester: {
                        id: record.requester.id,
                        name: record.requester.name,
                        email: record.requester.email,
                    },
                    addressee: {
                        id: record.addressee.id,
                        name: record.addressee.name,
                        email: record.addressee.email,
                    },
                };
            }
            return json;
        });
        return {
            data: friendships,
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
        };
    }

    @Get("search")
    @ApiOperation({summary: "Search users by name or email"})
    @ApiResponse({status: 200, description: "Users found"})
    async search(
        @CurrentUser() user: any,
        @Query('q') query: string,
    ) {
        return this.searchUsers.execute({
            query,
            currentUserId: user.sub,
        });
    }
}
import {Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Query, Res, UseGuards,} from "@nestjs/common";
import {ApiBody, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {UpdateProfileDto} from "@application/dto/users/update-profile.dto";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/users/user.repository";
import {HASHING_SERVICE, HashingService} from "@application/ports/hashing.service";
import {Response} from "express";
import {SignupDto} from "@application/dto/auths/signup.dto";
import {LoginDto} from "@application/dto/auths/login.dto";
import {AcceptInviteDto} from "@application/dto/invites/accept-invite.dto";
import {PrimaryOwnerCompaniesResponseDto} from "@application/dto/auths/primary-owner-companies.dto";
import {MemberCompaniesResponseDto} from "@application/dto/auths/member-companies.dto";
import {SignupUseCase} from "@application/use-cases/auths/signup.usecase";
import {LoginUseCase} from "@application/use-cases/auths/login.usecase";
import {AcceptInviteUseCase} from "@application/use-cases/memberships/accept-invite.usecase";
import {DeleteAccountUseCase} from "@application/use-cases/users/delete-account.usecase";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/companys/list-primary-owner-companies.usecase";
import {ListMemberCompaniesUseCase} from "@application/use-cases/companys/list-member-companies.usecase";
import {
    CompanyListingJobOptionsDto,
    CompanyListingJobResponseDto,
    CompanyListingQueryDto,
    CreateCompanyListingJobDto,
} from "@application/dto/companys/company-listing.dto";
import {CompanyListingJobsService} from "@application/services/company-listing-jobs.service";
import {ConfigService} from "@nestjs/config";
import {JwtService} from "@nestjs/jwt";
import {ApplicationError} from "@application/errors/application-error";
import {LoggerService} from "@infrastructure/logging/logger.service";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
    private readonly cookieName: string;
    private readonly logger: LoggerService;

    constructor(
        private readonly signupUseCase: SignupUseCase,
        private readonly loginUseCase: LoginUseCase,
        private readonly acceptInviteUseCase: AcceptInviteUseCase,
        private readonly deleteAccountUseCase: DeleteAccountUseCase,
        private readonly listPrimaryOwnerCompanies: ListPrimaryOwnerCompaniesUseCase,
        private readonly listMemberCompanies: ListMemberCompaniesUseCase,
        private readonly companyListingJobs: CompanyListingJobsService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
        @Inject(HASHING_SERVICE) private readonly hashing: HashingService,
    ) {
        this.cookieName =
            this.configService.get<string>("app.jwt.cookieName") ?? "session";
        this.logger = new LoggerService(AuthController.name, configService);
    }

    @Get("profile")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Get data from the authenticated users."})
    @ApiResponse({status: 200, description: "Profile returned"})
    async profile(@CurrentUser() user: any) {
        this.logger.default(`GET /auth/profile - user: ${user.sub}`);
        const dbUser = await this.userRepo.findById(user.sub);
        if (!dbUser) {
            this.logger.default(`Profile not found in database for user: ${user.sub}`);
            return {
                id: user.sub,
                email: user.email,
                activeCompanyId: user.activeCompanyId ?? null,
                notificationPreferences: {},
            };
        }
        this.logger.default(`Profile returned for user: ${user.sub}`);
        return dbUser.toJSON();
    }

    @Post("signup")
    @ApiOperation({summary: "Create a new users account"})
    @ApiResponse({status: 201, description: "User created successfully"})
    @ApiResponse({status: 400, description: "Validation errors or email already used", type: ErrorResponse})
    @ApiBody({
        schema: {
            properties: {
                email: {example: "john@example.com"},
                name: {example: "John Doe"},
                password: {example: "password123"}
            }
        }
    })
    async signup(
        @Body() body: SignupDto,
        @Res({passthrough: true}) res: Response,
    ) {
        this.logger.default(`POST /auth/signup - email: ${body.email}`);
        const {user} = await this.signupUseCase.execute(body);
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email.toString(),
            activeCompanyId: user.activeCompanyId,
        });
        this.attachCookie(res, token);
        this.logger.default(`User created successfully: ${user.id}, email: ${body.email}`);
        return user.toJSON();
    }

    @HttpCode(200)
    @Post("login")
    @ApiOperation({summary: "Login with email and password"})
    @ApiResponse({status: 200, description: "Login successful"})
    @ApiResponse({status: 400, description: "Invalid credentials", type: ErrorResponse})
    @ApiBody({schema: {properties: {email: {example: "john@example.com"}, password: {example: "password123"}}}})
    async login(
        @Body() body: LoginDto,
        @Res({passthrough: true}) res: Response,
    ) {
        this.logger.default(`POST /auth/login - email: ${body.email}`);
        const {user} = await this.loginUseCase.execute(body);
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email.toString(),
            activeCompanyId: user.activeCompanyId,
        });
        this.attachCookie(res, token);
        this.logger.default(`Login successful: user ${user.id}, email: ${body.email}`);
        return user.toJSON();
    }

    @HttpCode(200)
    @Post("accept-invites")
    @ApiOperation({summary: "Accept an invites and create/link users to companys"})
    @ApiResponse({status: 200, description: "Invite accepted successfully"})
    @ApiResponse({status: 400, description: "Invite expired/used/not found or missing data", type: ErrorResponse})
    @ApiBody({
        schema: {
            properties: {
                token: {example: "invites-token"},
                email: {example: "mary@example.com"},
                name: {example: "Mary"},
                password: {example: "password123"}
            }
        }
    })
    async acceptInvite(
        @Body() body: AcceptInviteDto,
        @Res({passthrough: true}) res: Response,
    ) {
        const {user, companyId} = await this.acceptInviteUseCase.execute(body);
        const token = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email.toString(),
            activeCompanyId: user.activeCompanyId,
        });
        this.attachCookie(res, token);
        return {user: user.toJSON(), companyId};
    }

    @Post("profile")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Update current users profile"})
    @ApiResponse({status: 200, description: "Profile updated"})
    @ApiResponse({status: 400, description: "Validation errors", type: ErrorResponse})
    async updateProfile(
        @CurrentUser() user: any,
        @Body() dto: UpdateProfileDto,
        @Res({passthrough: true}) res: Response,
    ) {
        this.logger.default(`Profile update request - user: ${user.sub}, has name: 
        ${!!dto.name}, has email: ${!!dto.email}, has newPassword: ${!!dto.newPassword}, 
        has notificationPreferences: ${dto.notificationPreferences !== undefined && dto.notificationPreferences !== null}`);
        
        const hasNotificationPreferences = dto.notificationPreferences !== undefined && dto.notificationPreferences !== null;
        if (!dto.name && !dto.email && !dto.newPassword && !hasNotificationPreferences) {
            this.logger.default(`Profile update failed: no fields to update - user: ${user.sub}`);
            throw new ApplicationError('NO_FIELDS_TO_UPDATE');
        }

        if ((dto.email || dto.newPassword) && !dto.currentPassword) {
            this.logger.default(`Profile update failed: current password required - user: ${user.sub}`);
            throw new ApplicationError('CURRENT_PASSWORD_REQUIRED');
        }

        let passwordHash: string | undefined;
        if (dto.newPassword) {
            const dbUser = await this.userRepo.findById(user.sub);
            if (!dbUser) {
                this.logger.default(`Profile update failed: user not found - user: ${user.sub}`);
                throw new ApplicationError('USER_NOT_FOUND');
            }
            const ok = await this.hashing.compare(dto.currentPassword || "", dbUser.passwordHash);
            if (!ok) {
                this.logger.default(`Profile update failed: invalid current password - user: ${user.sub}`);
                throw new ApplicationError('INVALID_CURRENT_PASSWORD');
            }
            passwordHash = await this.hashing.hash(dto.newPassword);
        }

        if (dto.email) {
            const existing = await this.userRepo.findByEmail(dto.email);
            if (existing && existing.id !== user.sub) {
                this.logger.default(`Profile update failed: email already in use -
                 user: ${user.sub}, email: ${dto.email}`);
                throw new ApplicationError('EMAIL_ALREADY_USED');
            }
        }

        let mergedNotificationPreferences: Record<string, any> | undefined;
        if (dto.notificationPreferences !== undefined) {
            const currentUser = await this.userRepo.findById(user.sub);
            const currentPrefs = currentUser?.notificationPreferences || {};
            mergedNotificationPreferences = { ...currentPrefs, ...dto.notificationPreferences };
            this.logger.default(`Updating notification preferences - user: ${user.sub}, 
            received: ${JSON.stringify(dto.notificationPreferences)}, current: ${JSON.stringify(currentPrefs)}, merged:
             ${JSON.stringify(mergedNotificationPreferences)}`);
        }

        const updated = await this.userRepo.update({
            id: user.sub,
            name: dto.name,
            email: dto.email,
            passwordHash,
            notificationPreferences: mergedNotificationPreferences,
        });

        const newToken = await this.jwtService.signAsync({
            sub: updated.id,
            email: updated.email.toString(),
            activeCompanyId: updated.activeCompanyId,
        });
        this.attachCookie(res, newToken);
        return updated.toJSON();
    }

    @Get("account/primary-owner-companies")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "List companies where users is primary owner (creator)"})
    @ApiResponse({status: 200, description: "Primary owner companies listed", type: PrimaryOwnerCompaniesResponseDto})
    async getPrimaryOwnerCompanies(@CurrentUser() user: any, @Query("page") page = "1", @Query("pageSize") pageSize = "10"):
        Promise<PrimaryOwnerCompaniesResponseDto> {
        const result = await this.listPrimaryOwnerCompanies.execute({
            userId: user.sub,
            page: parseInt(page, 10) || 1,
            pageSize: parseInt(pageSize, 10) || 10,
        });

        return {
            data: result.data.map(company => ({
                id: company.id,
                name: company.name,
                logoUrl: company.logoUrl ?? null,
                description: company.description ?? null,
                isPublic: company.isPublic,
                createdAt: company.createdAt.toISOString(),
                memberCount: company.memberCount,
                primaryOwnerName: company.primaryOwnerName,
                primaryOwnerEmail: company.primaryOwnerEmail,
            })),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
        };
    }

    @Post("account/primary-owner-companies/listing")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Create asynchronous job for primary-owner companies listing"})
    @ApiResponse({status: 201, description: "Job created", type: CompanyListingJobResponseDto})
    async createPrimaryOwnerCompaniesListingJob(
        @CurrentUser() user: any,
        @Body() body: CompanyListingJobOptionsDto,
    ): Promise<CompanyListingJobResponseDto> {
        const meta = await this.companyListingJobs.createJob(user, {
            type: "primary-owner",
            chunkSize: body.chunkSize,
        } as CreateCompanyListingJobDto);
        return {
            jobId: meta.jobId,
            cursor: 0,
            status: meta.status,
            processed: meta.processed,
            total: meta.total ?? 0,
            items: [],
            nextCursor: 0,
            done: false,
        };
    }

    @Get("account/primary-owner-companies/listing/:jobId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Fetch primary-owner companies listing job status"})
    @ApiResponse({status: 200, description: "Job data returned", type: CompanyListingJobResponseDto})
    async getPrimaryOwnerCompaniesListingJob(
        @CurrentUser() user: any,
        @Param("jobId", new ParseUUIDPipe()) jobId: string,
        @Query() query: CompanyListingQueryDto,
    ): Promise<CompanyListingJobResponseDto> {
        return this.companyListingJobs.getJob(user.sub, jobId, query);
    }

    @Delete("account/primary-owner-companies/listing/:jobId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Delete cached data for a primary-owner companies listing job"})
    @ApiResponse({status: 200, description: "Job cache deleted"})
    async deletePrimaryOwnerCompaniesListingJob(
        @CurrentUser() user: any,
        @Param("jobId", new ParseUUIDPipe()) jobId: string,
    ) {
        await this.companyListingJobs.deleteJob(user.sub, jobId);
        return {success: true};
    }

    @Get("account/member-companies")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "List companies where user is a member (ADMIN or MEMBER) but not primary owner"})
    @ApiResponse({status: 200, description: "Member companies listed", type: MemberCompaniesResponseDto})
    async getMemberCompanies(@CurrentUser() user: any, @Query("page") page = "1", @Query("pageSize") pageSize = "10"):
        Promise<MemberCompaniesResponseDto> {
        const result = await this.listMemberCompanies.execute({
            userId: user.sub,
            page: parseInt(page, 10) || 1,
            pageSize: parseInt(pageSize, 10) || 10,
        });

        return {
            data: result.data.map(company => ({
                id: company.id,
                name: company.name,
                logoUrl: company.logoUrl ?? null,
                description: company.description ?? null,
                isPublic: company.isPublic,
                createdAt: company.createdAt.toISOString(),
                memberCount: company.memberCount,
                userRole: company.userRole,
                primaryOwnerName: company.primaryOwnerName,
                primaryOwnerEmail: company.primaryOwnerEmail,
            })),
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
        };
    }

    @Post("account/member-companies/listing")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Create asynchronous job for member companies listing"})
    @ApiResponse({status: 201, description: "Job created", type: CompanyListingJobResponseDto})
    async createMemberCompaniesListingJob(
        @CurrentUser() user: any,
        @Body() body: CompanyListingJobOptionsDto,
    ): Promise<CompanyListingJobResponseDto> {
        const meta = await this.companyListingJobs.createJob(user, {
            type: "member",
            chunkSize: body.chunkSize,
        } as CreateCompanyListingJobDto);
        return {
            jobId: meta.jobId,
            cursor: 0,
            status: meta.status,
            processed: meta.processed,
            total: meta.total ?? 0,
            items: [],
            nextCursor: 0,
            done: false,
        };
    }

    @Get("account/member-companies/listing/:jobId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Fetch member companies listing job status"})
    @ApiResponse({status: 200, description: "Job data returned", type: CompanyListingJobResponseDto})
    async getMemberCompaniesListingJob(
        @CurrentUser() user: any,
        @Param("jobId", new ParseUUIDPipe()) jobId: string,
        @Query() query: CompanyListingQueryDto,
    ): Promise<CompanyListingJobResponseDto> {
        return this.companyListingJobs.getJob(user.sub, jobId, query);
    }

    @Delete("account/member-companies/listing/:jobId")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Delete cached data for a member companies listing job"})
    @ApiResponse({status: 200, description: "Job cache deleted"})
    async deleteMemberCompaniesListingJob(
        @CurrentUser() user: any,
        @Param("jobId", new ParseUUIDPipe()) jobId: string,
    ) {
        await this.companyListingJobs.deleteJob(user.sub, jobId);
        return {success: true};
    }

    @Delete("account")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Permanently delete users account. Automatically deletes all companies where user is primary owner and removes user from all companies where they are ADMIN or MEMBER."})
    @ApiResponse({status: 200, description: "Account deleted successfully"})
    @ApiResponse({status: 400, description: "Cannot delete account (e.g., last owner of a company)", type: ErrorResponse})
    async deleteAccount(
        @CurrentUser() user: any,
        @Res({passthrough: true}) res: Response,
    ) {
        await this.deleteAccountUseCase.execute({
            userId: user.sub,
        });
        res.cookie(this.cookieName, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("app.nodeEnv") === "production",
            expires: new Date(0),
        });
        return {success: true};
    }

    @Post("logout")
    @UseGuards(JwtAuthGuard)
    @ApiOperation({summary: "Logout from current session"})
    @ApiResponse({status: 200, description: "Session ended"})
    @HttpCode(200)
    async logout(@Res({passthrough: true}) res: Response) {
        res.cookie(this.cookieName, "", {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("app.nodeEnv") === "production",
            expires: new Date(0),
        });
        return {success: true};
    }

    private attachCookie(res: Response, token: string) {
        res.cookie(this.cookieName, token, {
            httpOnly: true,
            sameSite: "lax",
            secure: this.configService.get("app.nodeEnv") === "production",
        });
    }
}

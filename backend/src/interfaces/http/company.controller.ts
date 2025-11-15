import {
    Body,
    Controller,
    Delete,
    ForbiddenException,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Query,
    UseGuards
} from "@nestjs/common";
import {ApiBody, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags} from "@nestjs/swagger";
import {ErrorResponse} from "../../application/dto/error.response.dto";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";
import {JwtAuthGuard} from "@common/guards/jwt.guard";
import {TenantGuard} from "@common/guards/tenant.guard";
import {CurrentUser} from "@common/decorators/current-user.decorator";
import {CreateCompanyDto} from "@application/dto/create-company.dto";
import {UpdateCompanyDto} from "@application/dto/update-company.dto";
import {CreateCompanyUseCase} from "@application/use-cases/create-company.usecase";
import {ListCompaniesUseCase} from "@application/use-cases/list-companies.usecase";
import {SelectCompanyUseCase} from "@application/use-cases/select-company.usecase";
import {GetCompanyUseCase} from "@application/use-cases/get-company.usecase";
import {UpdateCompanyUseCase} from "@application/use-cases/update-company.usecase";
import {DeleteCompanyUseCase} from "@application/use-cases/delete-company.usecase";
import {LeaveCompanyUseCase} from "@application/use-cases/leave-company.usecase";
import {RolesGuard} from "@common/guards/roles.guard";
import {Roles} from "@common/decorators/roles.decorator";
import {Role} from "@domain/enums/role.enum";
import {Inject, SetMetadata} from "@nestjs/common";
import {MEMBERSHIP_REPOSITORY, MembershipRepository} from "@domain/repositories/membership.repository";
import {USER_REPOSITORY, UserRepository} from "@domain/repositories/user.repository";
import {COMPANY_REPOSITORY, CompanyRepository} from "@domain/repositories/company.repository";
import {IS_PUBLIC_KEY} from "@common/guards/jwt.guard";

@ApiTags("company")
@ApiCookieAuth()
@Controller("company")
@UseGuards(JwtAuthGuard)
export class CompanyController {
    constructor(
        private readonly createCompanyUseCase: CreateCompanyUseCase,
        private readonly listCompaniesUseCase: ListCompaniesUseCase,
        private readonly selectCompanyUseCase: SelectCompanyUseCase,
        private readonly getCompanyUseCase: GetCompanyUseCase,
        private readonly updateCompanyUseCase: UpdateCompanyUseCase,
        private readonly deleteCompanyUseCase: DeleteCompanyUseCase,
        private readonly leaveCompanyUseCase: LeaveCompanyUseCase,
        @Inject(MEMBERSHIP_REPOSITORY)
        private readonly membershipRepository: MembershipRepository,
        @Inject(USER_REPOSITORY)
        private readonly userRepository: UserRepository,
        @Inject(COMPANY_REPOSITORY)
        private readonly companyRepository: CompanyRepository,
    ) {
    }

    @Post()
    @ApiOperation({summary: "Create a new company"})
    @ApiResponse({status: 201, description: "Company created"})
    @ApiResponse({status: 400, description: "Invalid data", type: ErrorResponse})
    @ApiBody({
        schema: {
            properties: {
                name: {example: "Acme Corp"}, logoUrl:
                    {example: "https://example.com/logo.png"}, description: {example: "Company description"},
                is_public: {example: true}
            }
        }
    })
    async create(@CurrentUser() user: any, @Body() body: CreateCompanyDto) {
        const {company} = await this.createCompanyUseCase.execute({
            ownerId: user.sub,
            name: body.name,
            logoUrl: body.logoUrl,
            description: body.description,
            is_public: body.is_public,
        });
        return company.toJSON();
    }

    @Get()
    @ApiOperation({summary: "List companies user belongs to"})
    @ApiResponse({status: 200, description: "Companies listed"})
    @ApiResponse({status: 400, description: "Invalid pagination params", type: ErrorResponse})
    async list(
        @CurrentUser() user: any,
        @Query("page") page = 1,
        @Query("pageSize") pageSize = 10,
    ) {
        return this.listCompaniesUseCase.execute({
            userId: user.sub,
            page: Number(page),
            pageSize: Number(pageSize),
        });
    }

    @Post(":id/select")
    @ApiOperation({summary: "Select active company"})
    @ApiResponse({status: 200, description: "Company selected"})
    @ApiResponse({status: 403, description: "User is not a member of company", type: ErrorResponse})
    async select(@CurrentUser() user: any, @Param("id") companyId: string) {
        return this.selectCompanyUseCase.execute({
            userId: user.sub,
            companyId,
        });
    }

    @Get(":id")
    @ApiOperation({summary: "Get company details by id (public or active company)"})
    @ApiResponse({status: 200, description: "Company returned"})
    @ApiResponse({status: 403, description: "Access denied", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Company not found", type: ErrorResponse})
    async getById(@CurrentUser() user: any, @Param("id") companyId: string) {
        const {company} = await this.getCompanyUseCase.execute({
            userId: user.sub,
            companyId,
            activeCompanyId: user.activeCompanyId,
        });
        return company.toJSON();
    }

    @Get(":id/public-info")
    @SetMetadata(IS_PUBLIC_KEY, true)
    @ApiOperation({summary: "Get public company information (no auth required for public companies)"})
    @ApiResponse({status: 200, description: "Public company info returned"})
    @ApiResponse({status: 403, description: "Company is private", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Company not found", type: ErrorResponse})
    async getPublicInfo(@Param("id") companyId: string) {
        // Buscar empresa diretamente do repositório
        const company = await this.companyRepository.findById(companyId);
        if (!company) {
            throw new ApplicationError(ErrorCode.COMPANY_NOT_FOUND);
        }
        
        if (!company.isPublic) {
            throw new ApplicationError(ErrorCode.NOT_A_MEMBER);
        }

        // Buscar informações do primary owner e número de membros
        const members = await this.membershipRepository.listByCompany(companyId);
        const ownerMemberships = members.filter(m => m.role === Role.OWNER);
        
        let primaryOwnerName = 'N/A';
        let primaryOwnerEmail = 'N/A';
        
        if (ownerMemberships.length > 0) {
            ownerMemberships.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            const primaryOwner = ownerMemberships[0];
            const primaryOwnerUser = await this.userRepository.findById(primaryOwner.userId);
            
            if (primaryOwnerUser) {
                primaryOwnerName = primaryOwnerUser.name;
                primaryOwnerEmail = primaryOwnerUser.email.toString();
            }
        }

        return {
            id: company.id,
            name: company.name,
            logoUrl: company.logoUrl,
            description: company.description,
            is_public: company.isPublic,
            createdAt: company.createdAt.toISOString(),
            memberCount: members.length,
            primaryOwnerName,
            primaryOwnerEmail,
        };
    }

    @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
    @Patch(":id")
    @Roles(Role.OWNER, Role.ADMIN)
    @ApiOperation({summary: "Update company (name/logo/description/is_public)"})
    @ApiResponse({status: 200, description: "Company updated"})
    @ApiResponse({status: 400, description: "Invalid update data", type: ErrorResponse})
    @ApiResponse({status: 403, description: "Insufficient role", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Company not found", type: ErrorResponse})
    async update(
        @CurrentUser() user: any,
        @Param("id") companyId: string,
        @Body() body: UpdateCompanyDto,
    ) {
        const {company} = await this.updateCompanyUseCase.execute({
            requesterId: user.sub,
            companyId,
            name: body.name,
            logoUrl: body.logoUrl,
            description: body.description,
            isPublic: body.is_public,
        });
        return company.toJSON();
    }

    @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
    @Delete(":id")
    @Roles(Role.OWNER)
    @HttpCode(200)
    @ApiOperation({summary: "Delete company (OWNER only)"})
    @ApiResponse({status: 200, description: "Company deleted"})
    @ApiResponse({status: 403, description: "Insufficient role", type: ErrorResponse})
    @ApiResponse({status: 404, description: "Company not found", type: ErrorResponse})
    async remove(
        @CurrentUser() user: any,
        @Param("id") companyId: string,
    ) {
        return this.deleteCompanyUseCase.execute({requesterId: user.sub, companyId});
    }

    @Post(":id/members/:userId/leave")
    @ApiOperation({summary: "Leave company (notify admins)"})
    @ApiResponse({status: 200, description: "Left company"})
    @ApiResponse({status: 403, description: "Cannot leave as owner", type: ErrorResponse})
    async leave(
        @CurrentUser() user: any,
        @Param("id") companyId: string,
        @Param("userId") userId: string,
    ) {
        if (user.sub !== userId) {
            throw new ForbiddenException("CANNOT_LEAVE_FOR_OTHERS");
        }
        return this.leaveCompanyUseCase.execute({userId, companyId});
    }
}

import {
  Body,
  Controller,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { ErrorResponse } from "@application/dto/errors/error.response.dto";
import { JwtAuthGuard } from "@common/guards/jwt.guard";
import { TenantGuard } from "@common/guards/tenant.guard";
import { RolesGuard } from "@common/guards/roles.guard";
import { Roles } from "@common/decorators/roles.decorator";
import { CurrentUser } from "@common/decorators/current-user.decorator";
import { Role } from "@domain/enums/role.enum";
import {
  InviteCreatedResponse,
  InviteDto,
} from "@application/dto/invites/invite.dto";
import { InviteUserUseCase } from "@application/use-cases/memberships/invite-user.usecase";
import { SuccessCode } from "@application/success/success-code";
import { ConfigService } from "@nestjs/config";
import { RabbitMQService } from "@infrastructure/messaging/services/rabbitmq.service";
import { EventPayloadBuilderService } from "@application/services/event-payload-builder.service";

@ApiTags("invite")
@ApiCookieAuth()
@Controller("companys/:companyId/invites")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InviteController {
  constructor(
    private readonly inviteUserUseCase: InviteUserUseCase,
    private readonly configService: ConfigService,
    private readonly rabbit: RabbitMQService,
    @Inject("EventPayloadBuilderService")
    private readonly eventBuilder: EventPayloadBuilderService,
  ) {}

  @Post()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Invite a users to companys" })
  @ApiResponse({
    status: 201,
    description: "Invite created",
    type: InviteCreatedResponse,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid invites data",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: "Not a member or insufficient role",
    type: ErrorResponse,
  })
  @ApiResponse({
    status: 404,
    description: "Company not found",
    type: ErrorResponse,
  })
  @ApiBody({
    schema: {
      properties: {
        email: { example: "member@example.com" },
        role: { example: "MEMBER" },
      },
    },
  })
  async invite(
    @CurrentUser() user: any,
    @Param("companyId") companyId: string,
    @Body() body: InviteDto,
  ) {
    const appCfg = this.configService.get<any>("app");
    const expiresDays = appCfg?.invite?.expiresDays ?? 7;
    const { invite } = await this.inviteUserUseCase.execute({
      inviterUserId: user.sub,
      companyId,
      email: body.email,
      role: body.role,
      expiresInDays: expiresDays,
    });

    const frontendBase = appCfg?.frontendBaseUrl || "http://localhost:3000";
    const inviteUrl = `${frontendBase}/invite/${invite.token}`;

    const eventPayload = await this.eventBuilder.build({
      eventId: SuccessCode.INVITE_CREATED,
      senderId: user.sub,
      receiverEmail: invite.email.toString(),
      companyId: invite.companyId,
      additionalData: {
        inviteId: invite.id,
        inviterId: user.sub,
        invitedEmail: invite.email.toString(),
        role: invite.role,
        token: invite.token,
        inviteUrl,
      },
    });

    await this.rabbit.assertEventQueue("events.invites", "dlq.events.invites");
    await this.rabbit.sendToQueue(
      "events.invites",
      Buffer.from(JSON.stringify(eventPayload)),
    );

    return {
      id: invite.id,
      email: invite.email.toString(),
      role: invite.role,
      token: invite.token,
      expiresAt: invite.expiresAt,
      inviteUrl,
      message: SuccessCode.INVITE_CREATED,
    };
  }
}

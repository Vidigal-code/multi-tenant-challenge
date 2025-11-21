import {INestApplication} from "@nestjs/common";
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {InviteCreatedResponse, InviteInfoResponse, SuccessResponse} from "@application/dto/invites/invite.dto";
import {
    NotificationReadPayloadDto,
    RealtimeEventCatalogDto,
    RealtimeRoomsResponseDto
} from '@application/dto/realtimes/realtime.dto';
import {
    CreateNotificationListJobDto,
    NotificationListJobResponseDto
} from "@application/dto/notifications/notification-listing.dto";
import {
    CreateFriendBroadcastJobDto,
    NotificationFriendBroadcastJobResponseDto
} from "@application/dto/notifications/notification-friend-broadcast.dto";

export function swaggerSetup(app: INestApplication) {
    const cfg = new DocumentBuilder()
        .setTitle("Multi-Tenant API")
        .setDescription(
            [
                "Multi-tenant SaaS platform with OWNER / ADMIN / MEMBER roles and strict RBAC enforcement.",
                "Authentication & onboarding: signup, login, active-company selection, invitation lifecycle (create, fetch by token, accept, reject).",
                "Company privacy model: public companies expose metadata and allow join requests; private companies block anonymous access.",
                "Membership management: list members, transfer ownership, change roles, remove members, or leave companies with all invariants enforced.",
                "Notifications API: broadcast messages to a company, deliver direct friend messages, reply to notifications, track read status, and paginate huge feeds through async jobs.",
                "Friendships: search users, send/accept/reject requests, remove friendships, and send targeted friend notifications.",
                "Realtime stack: WebSocket namespace /rt plus RabbitMQ workers that confirm delivery before persisting notifications. Friend/global broadcasts run as jobs (`POST /notifications/friend-broadcast-jobs` + `GET /notifications/friend-broadcast-jobs/{jobId}`).",
                "Request-to-join workflow uses POST /notifications (onlyOwnersAndAdmins flag) to fan out join requests to privileged users.",
                "Profile management: update personal data, tweak notification preferences (company invitations, friend requests, company messages, membership/role changes, realtime popups).",
                "Account deletion enforces primary-owner safeguards and exposes listing endpoints for companies you created or joined.",
                "Observability endpoints expose worker/queue status, while centralized ErrorCode and SuccessCode enums standardize API responses.",
                "All timestamps are UTC ISO strings; clients localize them as needed. DTO models for invites, notifications, and realtime events are bundled in this schema.",
            ].join("\n"),
        )
        .setVersion("1.5")
        .addServer("http://localhost:4000", "Local")
        .addCookieAuth(process.env.COOKIE_NAME || "mt_session")
        .addBearerAuth(
            {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Worker JWT or JWE token used to access /workers endpoints",
            },
            "worker-jwt",
        )
        .build();
    const docs = SwaggerModule.createDocument(app, cfg, {
        extraModels: [
            ErrorResponse,
            InviteCreatedResponse,
            InviteInfoResponse,
            SuccessResponse,
            NotificationReadPayloadDto,
            RealtimeRoomsResponseDto,
            RealtimeEventCatalogDto,
            CreateNotificationListJobDto,
            NotificationListJobResponseDto,
            CreateFriendBroadcastJobDto,
            NotificationFriendBroadcastJobResponseDto,
        ],
    });
    SwaggerModule.setup("doc", app, docs, {
        swaggerOptions: {
            persistAuthorization: true,
        },
        customSiteTitle: "Multi-Tenant API Docs",
    });
}

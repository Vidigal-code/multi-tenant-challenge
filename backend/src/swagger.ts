import {INestApplication} from "@nestjs/common";
import {DocumentBuilder, SwaggerModule} from "@nestjs/swagger";
import {ErrorResponse} from "@application/dto/errors/error.response.dto";
import {InviteCreatedResponse, InviteInfoResponse, SuccessResponse} from "@application/dto/invites/invite.dto";
import {
    NotificationReadPayloadDto,
    RealtimeEventCatalogDto,
    RealtimeRoomsResponseDto
} from '@application/dto/realtimes/realtime.dto';

export function swaggerSetup(app: INestApplication) {
    const cfg = new DocumentBuilder()
        .setTitle("Multi-Tenant API")
        .setDescription(
            [
                "SaaS multi-tenant platform with RBAC (OWNER / ADMIN / MEMBER).",
                "Flows: signup, login, active companys selection, invites (creation, fetch by code, accept, reject), memberships governance and metrics.",
                "Simplified invites system: only Created and Received tabs (rejected invites are hidden from recipients but visible to senders).",
                "Company privacy: public companies (isPublic: true) show info to non-members with 'Request to Join' button; private companies show 'Access Denied'.",
                "Public companys info endpoint: GET /companys/:id/public-info returns basic companys details (member count, primary owner info) without authentication for public companies.",
                "Request to Join: POST /notifications with onlyOwnersAndAdmins=true sends join requests to all owners/admins or specific emails (validates roles at request time).",
                "User profile: email displayed without mask, notifications preferences (companyInvitations, friendRequests, companyMessages, membershipChanges, roleChanges, realtimePopups).",
                "Realtime notifications popups: respect users privacy settings, appear on any route when enabled, redirect to /notifications on click.",
                "Centralized errors and success codes: backend uses ErrorCode enum and SuccessCode enum for type-safe responses.",
                "Frontend translates codes to users-friendly Portuguese messages (separation of concerns).",
                "Company metadata: description (String?) & isPublic (Boolean) - can be updated via PATCH /companys/:id.",
                "Company update (PATCH) and deletion (DELETE) endpoints included.",
                "Membership role change (PATCH /companys/{id}/members/{userId}/role).",
                "Notifications (POST /notifications, GET /notifications) to broadcast internal messages (title/body/meta).",
                "Account deletion (DELETE /invites/account) with primary owner protection: users who are primary owners (creators) must delete all their companies before account deletion.",
                "Primary owner companies listing (GET /invites/account/primary-owner-companies) returns paginated list of companies where users is the original creator.",
                "Friendships: search users, send/accept/reject friend requests (GET /friendships/search, POST /friendships/request, POST /friendships/:id/accept, DELETE /friendships/:id).",
                "Global and selective friend messaging: send messages to all friends or specific friends with throttling.",
                "Realtime WebSocket namespace /rt with events: companys.updated, member.joined, member.left, notifications.created, notifications.read, invites.rejected, invites.accepted, friend.request.sent, friend.request.accepted, friend.request.rejected.",
                "Realtime handshake endpoint GET /realtimes/rooms returns users/companys rooms and event catalog.",
                "Generic event messages (RabbitMQ) emitting memberships.removed, memberships.role.updated, invites.created, invites.accepted, invites.rejected + bridged to WebSocket.",
                "Frontend translates eventId into localized Portuguese messages while backend remains generic.",
                "Date formatting: backend returns UTC timestamps, frontend formats to users's local timezone (pt-BR locale).",
                "Frontend features: Dark mode (GitHub-style), responsive mobile menu (hamburger), commercial home page, Portuguese interface, reusable Footer component.",
                "Modules: Auth, Company, Membership, Invite, Notifications, Friendships, Observability.",
                "All 4xx/5xx errors return a JSON body { statusCode, code, message, timestamp, path } where 'code' is from ErrorCode enum.",
                "Success responses may include 'code' field from SuccessCode enum for frontend translation.",
            ].join("\n"),
        )
        .setVersion("1.4")
        .addServer("http://localhost:4000", "Local")
        .addCookieAuth(process.env.COOKIE_NAME || "mt_session")
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
        ],
    });
    SwaggerModule.setup("doc", app, docs, {
        swaggerOptions: {
            persistAuthorization: true,
        },
        customSiteTitle: "Multi-Tenant API Docs",
    });
}

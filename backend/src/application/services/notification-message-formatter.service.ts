import { Injectable } from "@nestjs/common";

export interface NotificationMessageConfig {
  eventCode: string;
  senderName?: string;
  senderEmail?: string;
  companyName?: string;
  companyId?: string;
  companyDescription?: string;
  companyLogoUrl?: string;
  companyCreatedAt?: string;
  companyMemberCount?: number;
  companyOwnerName?: string;
  companyOwnerEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  friendEmail?: string;
  role?: string;
  previousRole?: string;
  oldRole?: string;
  newRole?: string;
  inviteId?: string;
  inviteUrl?: string;
  inviteEmail?: string;
  additionalData?: Record<string, any>;
}

@Injectable()
export class NotificationMessageFormatterService {
  formatTitle(config: NotificationMessageConfig): string {
    const { eventCode, additionalData } = config;

    if (additionalData?.title && eventCode === "NOTIFICATION_SENT") {
      return `${additionalData.title} [NOTIFICATION_SENT]`;
    }

    return `[${eventCode}]`;
  }

  formatBody(config: NotificationMessageConfig): string {
    const {
      eventCode,
      senderName,
      senderEmail,
      companyName,
      companyId,
      companyDescription,
      companyLogoUrl,
      companyCreatedAt,
      companyMemberCount,
      companyOwnerName,
      companyOwnerEmail,
      recipientName,
      recipientEmail,
      friendEmail,
      role,
      previousRole,
      oldRole,
      newRole,
      inviteId,
      inviteUrl,
      inviteEmail,
      additionalData,
    } = config;

    const genericMessage = this.getGenericMessage(eventCode);

    const bodyParts: string[] = [genericMessage];

    if (additionalData?.body) {
      bodyParts.push(`\n\nMessage: ${additionalData.body}`);
    }

    if (additionalData?.title && eventCode === "NOTIFICATION_SENT") {
      bodyParts.push(`\nTitle: ${additionalData.title}`);
    }

    if (senderName) {
      bodyParts.push(
        `\n\nSender: ${senderName}${senderEmail ? ` (${senderEmail})` : ""}`,
      );
    }

    if (recipientName) {
      bodyParts.push(
        `Recipient: ${recipientName}${recipientEmail ? ` (${recipientEmail})` : ""}`,
      );
    }

    if (friendEmail) {
      bodyParts.push(`Friend Email: ${friendEmail}`);
    }

    if (companyName) {
      bodyParts.push(`\nCompany: ${companyName}`);
      if (companyId) {
        bodyParts.push(`Company ID: ${companyId}`);
      }
      if (companyDescription) {
        bodyParts.push(`Description: ${companyDescription}`);
      }
      if (companyOwnerName) {
        bodyParts.push(
          `Primary Owner: ${companyOwnerName}${companyOwnerEmail ? ` (${companyOwnerEmail})` : ""}`,
        );
      }
      if (companyCreatedAt) {
        bodyParts.push(
          `Created At: ${new Date(companyCreatedAt).toISOString()}`,
        );
      }
      if (companyMemberCount !== undefined) {
        bodyParts.push(`Members: ${companyMemberCount}`);
      }
      if (companyLogoUrl) {
        bodyParts.push(`Logo URL: ${companyLogoUrl}`);
      }
    }

    if (inviteId) {
      bodyParts.push(`\nInvite ID: ${inviteId}`);
    }

    if (inviteEmail) {
      bodyParts.push(`Invite Email: ${inviteEmail}`);
    }

    if (inviteUrl) {
      bodyParts.push(`Invite URL: ${inviteUrl}`);
    }

    const finalRole = newRole || role;
    const finalPreviousRole = oldRole || previousRole;

    if (finalRole) {
      bodyParts.push(`\nRole: ${finalRole}`);
    }

    if (finalPreviousRole && finalRole) {
      bodyParts.push(`Previous Role: ${finalPreviousRole}`);
    }

    return bodyParts.join("\n");
  }

  private getGenericMessage(eventCode: string): string {
    switch (eventCode) {
      case "FRIEND_REQUEST_SENT": // A friend request has been sent to you.
        return "FRIEND_REQUEST_SENT:[a_friend_request_has_been_sent_to_you.]";
      case "FRIEND_REQUEST_ACCEPTED":
      case "ACCEPTED_FRIEND": // Your friend request has been accepted.
        return "ACCEPTED_FRIEND:[your_friend_request_has_been_accepted.]";
      case "FRIEND_REQUEST_REJECTED":
      case "REJECTED_FRIEND": // Your friend request has been rejected.
        return "REJECTED_FRIEND:[your_friend_request_has_been_rejected.]";
      case "FRIEND_REMOVED": // You have been removed as a friend.
        return "FRIEND_REMOVED:[you_have_been_removed_as_a_friend.]";
      case "INVITE_CREATED": // You have received an invitation to join a company.
        return "INVITE_CREATED:[you_have_received_an_invitation_to_join_a_company.]";
      case "INVITE_ACCEPTED": // Your company invitation has been accepted.
        return "INVITE_ACCEPTED:[your_company_invitation_has_been_accepted.]";
      case "INVITE_REJECTED":
      case "REJECT_COMPANY_INVITE": // Your company invitation has been rejected.
        return "REJECT_COMPANY_INVITE:[your_company_invitation_has_been_rejected.]";
      case "MEMBER_ADDED":
      case "USER_JOINED": // You have joined a company.
        return "MEMBER_ADDED:[you_have_joined_a_company.]";
      case "MEMBER_REMOVED":
      case "USER_REMOVED": // You have been removed from a company.
        return "MEMBER_REMOVED:[you_have_been_removed_from_a_company.]";
      case "ROLE_CHANGED":
      case "USER_STATUS_UPDATED": // Your role in the company has been changed.
        return "ROLE_CHANGED:[your_role_in_the_company_has_been_changed.]";
      case "COMPANY_CREATED": // A company has been created.
        return "COMPANY_CREATED:[a_company_has_been_created.]";
      case "NOTIFICATION_SENT": // You have received a new notification.
        return "NOTIFICATION_SENT:[you_have_received_a_new_notification.]";
      default:
        return `${eventCode.toLowerCase()}:[a_new_notification_has_been_created.]`;
    }
  }
}

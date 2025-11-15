export enum SuccessCode {
    // Notifications
    NOTIFICATION_SENT = "NOTIFICATION_SENT",
    NOTIFICATION_SENT_TO_ALL_MEMBERS = "NOTIFICATION_SENT_TO_ALL_MEMBERS",

    // Friendships
    FRIEND_REQUEST_SENT = "FRIEND_REQUEST_SENT",
    FRIEND_REQUEST_ACCEPTED = "FRIEND_REQUEST_ACCEPTED",
    FRIEND_REMOVED = "FRIEND_REMOVED",

    // Invitations
    INVITATION_ACCEPTED = "INVITATION_ACCEPTED",
    INVITE_CREATED = "INVITE_CREATED",
    INVITE_ACCEPTED = "INVITE_ACCEPTED",

    // User
    USER_STATUS_UPDATED = "USER_STATUS_UPDATED",
    PROFILE_UPDATED = "PROFILE_UPDATED",
    ACCOUNT_DELETED = "ACCOUNT_DELETED",

    // Company
    COMPANY_CREATED = "COMPANY_CREATED",
    COMPANY_UPDATED = "COMPANY_UPDATED",
    COMPANY_DELETED = "COMPANY_DELETED",
    COMPANY_SELECTED = "COMPANY_SELECTED",

    // Members
    MEMBER_ADDED = "MEMBER_ADDED",
    MEMBER_REMOVED = "MEMBER_REMOVED",
    MEMBER_LEFT = "MEMBER_LEFT",
    ROLE_UPDATED = "ROLE_UPDATED",
    OWNERSHIP_TRANSFERRED = "OWNERSHIP_TRANSFERRED",

    // Notifications (read/reply)
    NOTIFICATION_READ = "NOTIFICATION_READ",
    NOTIFICATION_REPLIED = "NOTIFICATION_REPLIED",
    NOTIFICATION_DELETED = "NOTIFICATION_DELETED",
}

/**
 * @deprecated Use SuccessMessage instead
 * Success result wrapper for use cases
 * Contains the success code and optional data
 */
export class SuccessResult<T = any> {
    constructor(
        public readonly code: SuccessCode,
        public readonly data?: T,
    ) {}

    toJSON() {
        return {
            success: true,
            code: this.code,
            ...(this.data && { data: this.data }),
        };
    }
}


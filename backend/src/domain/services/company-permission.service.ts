import { Role } from "@domain/enums/role.enum";

export type CompanyAction =
  | "create-company"
  | "edit-company"
  | "delete-company"
  | "remove-member"
  | "change-role"
  | "invite-member"
  | "send-global-message"
  | "leave-company"
  | "view-company";

export class CompanyPermissionService {
  static canModify(
    requesterRole: Role,
    targetRole: Role | null,
    action: CompanyAction,
    isSelf: boolean = false,
  ): boolean {
    if (isSelf && ["remove-member", "change-role"].includes(action)) {
      return false;
    }

    switch (action) {
      case "create-company":
        return true;

      case "edit-company":
        return requesterRole === Role.OWNER || requesterRole === Role.ADMIN;

      case "delete-company":
        return requesterRole === Role.OWNER;

      case "invite-member":
        return requesterRole === Role.OWNER || requesterRole === Role.ADMIN;

      case "remove-member":
        if (requesterRole === Role.ADMIN) {
          return targetRole === Role.MEMBER;
        }
        if (requesterRole === Role.OWNER) {
          return targetRole !== Role.OWNER;
        }
        return false;

      case "change-role":
        if (requesterRole === Role.ADMIN) {
          return false;
        }
        if (requesterRole === Role.OWNER) {
          if (isSelf) return false;
          if (targetRole === Role.OWNER) return true;
          return true;
        }
        return false;

      case "send-global-message":
        return requesterRole === Role.OWNER || requesterRole === Role.ADMIN;

      case "leave-company":
        return requesterRole !== Role.OWNER || !isSelf;

      case "view-company":
        return true;

      default:
        return false;
    }
  }

  static canPromoteToOwner(requesterRole: Role): boolean {
    return requesterRole === Role.OWNER;
  }

  static canRemoveLastOwner(
    requesterRole: Role,
    targetRole: Role,
    ownerCount: number,
  ): boolean {
    if (targetRole !== Role.OWNER) return true;
    if (ownerCount <= 1) return false;
    return requesterRole === Role.OWNER;
  }
}

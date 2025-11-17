export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.OWNER]: 3,
  [Role.ADMIN]: 2,
  [Role.MEMBER]: 1,
};

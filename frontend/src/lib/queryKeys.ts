export const queryKeys = {
  companies: (page: number, pageSize: number) => ['companies', page, pageSize] as const,
  invites: (page: number, pageSize: number) => ['invites', page, pageSize] as const,
  companyMembers: (id: string) => ['companys-members', id] as const,
  profile: () => ['profile'] as const,
  friendships: () => ['friendships'] as const,
  notifications: () => ['notifications'] as const,
} as const;

export const queryKeys = {
  companies: (page: number, pageSize: number) => ['companies', page, pageSize] as const,
  company: (id: string) => ['company', id] as const,
  companyPublicInfo: (id: string) => ['company-public-info', id] as const,
  companyRole: (id: string) => ['company-role', id] as const,
  companyPrimaryOwner: (id: string) => ['company-primary-owner', id] as const,
  invitesListing: (type: 'created' | 'received') => ['invites-listing', type] as const,
  invitesCreated: () => ['invites-listing', 'created'] as const,
  invitesReceived: () => ['invites-listing', 'received'] as const,
  invite: (code: string) => ['invite', code] as const,
  companyMembers: (id: string) => ['company-members', id] as const,
  profile: () => ['profile'] as const,
  friendships: (status?: string) => status ? ['friendships', status] as const : ['friendships'] as const,
  friendRequests: () => ['friend-requests'] as const,
  notifications: (page?: number, pageSize?: number) => {
    if (page !== undefined && pageSize !== undefined) {
      return ['notifications', page, pageSize] as const;
    }
    return ['notifications'] as const;
  },
  primaryOwnerCompanies: () => ['primary-owner-companies'] as const,
  memberCompanies: () => ['member-companies'] as const,
} as const;

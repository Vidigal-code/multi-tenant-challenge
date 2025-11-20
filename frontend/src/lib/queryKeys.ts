export const queryKeys = {
  companies: (page: number, pageSize: number) => ['companies', page, pageSize] as const,
  company: (id: string) => ['company', id] as const,
  companyPublicInfo: (id: string) => ['company-public-info', id] as const,
  companyRole: (id: string) => ['company-role', id] as const,
  companyPrimaryOwner: (id: string) => ['company-primary-owner', id] as const,
  invitesListing: (type: 'created' | 'received') => ['invites-listing', type] as const,
  companyListingPrimaryOwner: () => ['company-listing', 'primary-owner'] as const,
  companyListingMember: () => ['company-listing', 'member'] as const,
  notificationListing: (type: string, page: number, pageSize: number) => ['notification-listing', type, page, pageSize] as const,
  friendshipListing: (status: string) => ['friendship-listing', status] as const,
  userSearch: (query: string) => ['user-search', query] as const,
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

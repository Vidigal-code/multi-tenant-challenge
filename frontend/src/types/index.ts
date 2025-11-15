export type CompanyDTO = { id: string; name: string };
export type MemberDTO = { id: string; userId: string; role: string };
export type InviteDTO = {
    id: string;
    companyId: string;
    email: string;
    role: string;
    status: string;
    token: string;
    createdAt: string;
    expiresAt: string
};
export type FriendshipDTO = {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
    createdAt: string;
    updatedAt: string;
    requester: { id: string; name: string; email: string };
    addressee: { id: string; name: string; email: string };
};
export type UserSearchDTO = {
    id: string;
    name: string;
    email: string;
};

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

export const DEFAULT_COMPANY_LOGO = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_LOGO || 
    'https://dynamic.design.com/preview/logodraft/673b48a6-8177-4a84-9785-9f74d395a258/image/large.png';
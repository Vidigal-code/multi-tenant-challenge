import {Invite} from "../entities/invite.entity";
import {Role} from "../enums/role.enum";
import {InviteStatus} from "../enums/invite-status.enum";

export interface CreateInviteInput {
    companyId: string;
    email: string;
    token: string;
    role: Role;
    expiresAt: Date;
    inviterId: string;
}

export interface InviteRepository {
    createOrReuse(data: CreateInviteInput): Promise<Invite>;

    findById(id: string): Promise<Invite | null>;

    findByToken(token: string): Promise<Invite | null>;

    markAccepted(inviteId: string, userId: string): Promise<void>;

    markExpired(inviteId: string): Promise<void>;

    updateStatus(inviteId: string, status: InviteStatus): Promise<void>;

    expireInvitesForEmail(companyId: string, email: string): Promise<void>;

    listByEmail(email: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }>;

    listByInviter(inviterId: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }>;

    delete(inviteId: string): Promise<void>;
}

export const INVITE_REPOSITORY = Symbol("INVITE_REPOSITORY");

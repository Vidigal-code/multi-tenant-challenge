import {CreateUserInput, UpdateUserInput, UserRepository,} from "@domain/repositories/users/user.repository";
import {
    CompanyRepository,
    CreateCompanyInput,
    ListCompaniesFilters,
    ListPublicCompaniesFilters,
    PaginatedCompanies,
} from "@domain/repositories/companys/company.repository";
import {CreateMembershipInput, MembershipRepository,} from "@domain/repositories/memberships/membership.repository";
import {CreateInviteInput, InviteRepository,} from "@domain/repositories/invites/invite.repository";
import {FriendshipRepository, CreateFriendshipInput, FriendshipFilters, FriendshipListResult} from "@domain/repositories/friendships/friendship.repository";
import {User} from "@domain/entities/users/user.entity";
import {Company} from "@domain/entities/companys/company.entity";
import {Membership} from "@domain/entities/memberships/membership.entity";
import {Invite} from "@domain/entities/invites/invite.entity";
import {Friendship, FriendshipStatus} from "@domain/entities/friendships/friendship.entity";
import {Role} from "@domain/enums/role.enum";
import {InviteStatus} from "@domain/enums/invite-status.enum";
import {Email} from "@domain/value-objects/email.vo";
import {EmailValidationService} from "@application/ports/email-validation.service";

function randomId() {
    return Math.random().toString(36).slice(2);
}

export class InMemoryUserRepository implements UserRepository {
    items: User[] = [];

    async create(data: CreateUserInput): Promise<User> {
        const now = new Date();
        const user = User.create({
            id: randomId(),
            email: Email.create(data.email),
            name: data.name,
            passwordHash: data.passwordHash,
            activeCompanyId: null,
            createdAt: now,
            updatedAt: now,
        });
        this.items.push(user);
        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.items.find((u) => u.email.toString() === email) || null;
    }

    async findById(id: string): Promise<User | null> {
        return this.items.find((u) => u.id === id) || null;
    }

    async update(data: UpdateUserInput): Promise<User> {
        const user = await this.findById(data.id);
        if (!user) throw new Error("NOT_FOUND");
        if (data.activeCompanyId !== undefined) {
            data.activeCompanyId
                ? user.setActiveCompany(data.activeCompanyId)
                : user.clearActiveCompany();
        }
        return user;
    }

    async deleteById(id: string): Promise<void> {
        this.items = this.items.filter((u) => u.id !== id);
    }

    async searchByNameOrEmail(query: string, excludeUserId: string): Promise<User[]> {
        const normalizedQuery = query.toLowerCase();
        return this.items
            .filter(user =>
                user.id !== excludeUserId &&
                (user.name.toLowerCase().includes(normalizedQuery) ||
                    user.email.toString().toLowerCase().includes(normalizedQuery))
            )
            .slice(0, 20); // Limit results
    }
}

export class InMemoryCompanyRepository implements CompanyRepository {
    items: Company[] = [];
    memberships: Membership[] = [];
    private membershipRepo?: InMemoryMembershipRepository;

    async create(data: CreateCompanyInput): Promise<Company> {
        const now = new Date();
        const companyId = randomId();
        const membership = Membership.create({
            id: randomId(),
            userId: data.ownerId,
            companyId,
            role: Role.OWNER,
            createdAt: now,
        });
        const company = Company.create({
            id: companyId,
            name: data.name,
            logoUrl: data.logoUrl,
            memberships: [membership],
            createdAt: now,
            updatedAt: now,
        });
        this.items.push(company);
        this.memberships.push(membership);
        return company;
    }

    async findById(id: string): Promise<Company | null> {
        return this.items.find((c) => c.id === id) || null;
    }

    setMembershipRepo(repo: InMemoryMembershipRepository) {
        this.membershipRepo = repo;
    }

    async listByUser(filters: ListCompaniesFilters): Promise<PaginatedCompanies> {

        const membershipsToUse = this.membershipRepo?.items || this.memberships;
        const userCompanyIds = new Set(
            membershipsToUse
                .filter((m) => m.userId === filters.userId)
                .map((m) => m.companyId)
        );
        const userCompanies = this.items.filter((c) => userCompanyIds.has(c.id));
        const total = userCompanies.length;
        const start = (filters.page - 1) * filters.pageSize;
        const data = userCompanies.slice(start, start + filters.pageSize);
        return {data, total, page: filters.page, pageSize: filters.pageSize};
    }

    async listPublic(filters: ListPublicCompaniesFilters): Promise<PaginatedCompanies> {
        const publicCompanies = this.items.filter((c) => c.isPublic);
        const total = publicCompanies.length;
        const start = (filters.page - 1) * filters.pageSize;
        const data = publicCompanies.slice(start, start + filters.pageSize);
        return {data, total, page: filters.page, pageSize: filters.pageSize};
    }

    async update(data: { id: string; name?: string; logoUrl?: string | null }): Promise<Company> {
        const company = await this.findById(data.id);
        if (!company) throw new Error("NOT_FOUND");
        const props = (company as any).props as any;
        if (typeof data.name !== 'undefined') {
            props.name = data.name;
        }
        if (typeof data.logoUrl !== 'undefined') {
            props.logoUrl = data.logoUrl ?? null;
        }
        props.updatedAt = new Date();
        return company;
    }

    async delete(id: string): Promise<void> {
        const company = await this.findById(id);
        if (!company) return;
        this.items = this.items.filter((c) => c.id !== id);
        this.memberships = this.memberships.filter((m) => m.companyId !== id);
    }
}

export class InMemoryMembershipRepository implements MembershipRepository {
    items: Membership[] = [];

    async create(data: CreateMembershipInput): Promise<Membership> {
        const membership = Membership.create({
            id: randomId(),
            userId: data.userId,
            companyId: data.companyId,
            role: data.role,
            createdAt: new Date(),
        });
        this.items.push(membership);
        return membership;
    }

    async findByUserAndCompany(
        userId: string,
        companyId: string,
    ): Promise<Membership | null> {
        return (
            this.items.find(
                (m) => m.userId === userId && m.companyId === companyId,
            ) || null
        );
    }

    async listByCompany(companyId: string): Promise<Membership[]> {
        return this.items.filter((m) => m.companyId === companyId);
    }

    async listByUser(userId: string): Promise<Membership[]> {
        return this.items.filter((m) => m.userId === userId);
    }

    async countByCompanyAndRole(companyId: string, role: Role): Promise<number> {
        return this.items.filter(
            (m) => m.companyId === companyId && m.role === role,
        ).length;
    }

    async updateRole(id: string, role: Role): Promise<void> {
        const m = this.items.find((mm) => mm.id === id);
        if (m) (m as any).props.role = role;
    }

    async remove(id: string): Promise<void> {
        this.items = this.items.filter((m) => m.id !== id);
    }
}

export class InMemoryInviteRepository implements InviteRepository {
    items: Invite[] = [];

    async createOrReuse(data: CreateInviteInput): Promise<Invite> {
        const existing = this.items.find(
            (i) =>
                i.companyId === data.companyId &&
                i.email.toString() === data.email &&
                i.status === InviteStatus.PENDING &&
                !i.isExpired(),
        );
        if (existing) return existing;
        this.items
            .filter(
                (i) =>
                    i.companyId === data.companyId &&
                    i.email.toString() === data.email &&
                    i.status === InviteStatus.PENDING,
            )
            .forEach((i) => i.cancel());
        const invite = Invite.create({
            id: randomId(),
            companyId: data.companyId,
            email: Email.create(data.email),
            token: data.token,
            role: data.role,
            status: InviteStatus.PENDING,
            expiresAt: data.expiresAt,
            createdAt: new Date(),
            acceptedById: null,
            inviterId: data.inviterId,
        });
        this.items.push(invite);
        return invite;
    }

    async findByToken(token: string): Promise<Invite | null> {
        return this.items.find((i) => i.token === token) || null;
    }

    async markAccepted(inviteId: string, userId: string): Promise<void> {
        const inv = this.items.find((i) => i.id === inviteId);
        if (inv) inv.markAccepted(userId);
    }

    async markExpired(inviteId: string): Promise<void> {
        const inv = this.items.find((i) => i.id === inviteId);
        if (inv) inv.markExpired();
    }

    async expireInvitesForEmail(companyId: string, email: string): Promise<void> {
        this.items
            .filter(
                (i) =>
                    i.companyId === companyId &&
                    i.email.toString() === email &&
                    i.status === InviteStatus.PENDING,
            )
            .forEach((i) => i.markExpired());
    }

    async listByEmail(email: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }> {
        const filtered = this.items.filter((i) => i.email.toString() === email);
        const total = filtered.length;
        const start = (Math.max(1, page) - 1) * Math.max(1, pageSize);
        const data = filtered.slice(start, start + Math.max(1, pageSize));
        return {data, total};
    }

    async listByInviter(inviterId: string, page: number, pageSize: number): Promise<{ data: Invite[]; total: number }> {
        const filtered = this.items.filter((i) => i.inviterId === inviterId);
        const total = filtered.length;
        const start = (Math.max(1, page) - 1) * Math.max(1, pageSize);
        const data = filtered.slice(start, start + Math.max(1, pageSize));
        return {data, total};
    }

    async updateStatus(inviteId: string, status: InviteStatus): Promise<void> {
        const inv = this.items.find(i => i.id === inviteId);
        if (!inv) return;
        switch (status) {
            case InviteStatus.REJECTED:
                (inv as any).props.status = InviteStatus.REJECTED;
                break;
            case InviteStatus.EXPIRED:
                inv.markExpired();
                break;
            case InviteStatus.ACCEPTED:
                (inv as any).props.status = InviteStatus.ACCEPTED;
                break;
            default:
                (inv as any).props.status = status;
        }
    }

    async findById(id: string): Promise<Invite | null> {
        return this.items.find((i) => i.id === id) || null;
    }

    async delete(inviteId: string): Promise<void> {
        this.items = this.items.filter(i => i.id !== inviteId);
    }
}

export class FakeHashingService {
    async hash(raw: string): Promise<string> {
        return `hashed:${raw}`;
    }

    async compare(raw: string, hash: string): Promise<boolean> {
        return hash === `hashed:${raw}`;
    }
}

export class FixedInviteTokenService {
    generate(): string {
        return "fixed-token";
    }
}

export class FakeDomainEventsService {
    async publish(_: any): Promise<void> {
    }
}

export class AlwaysTrueEmailValidationService
    implements EmailValidationService {
    async exists(_email: string): Promise<boolean> {
        return true;
    }
}

export class InMemoryFriendshipRepository implements FriendshipRepository {
    items: Friendship[] = [];

    async create(input: CreateFriendshipInput): Promise<Friendship> {
        const friendship = Friendship.create({
            id: randomId(),
            requesterId: input.requesterId,
            addresseeId: input.addresseeId,
            status: FriendshipStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        this.items.push(friendship);
        return friendship;
    }

    async findById(id: string): Promise<Friendship | null> {
        return this.items.find((f) => f.id === id) || null;
    }

    async findByUsers(requesterId: string, addresseeId: string): Promise<Friendship | null> {
        return this.items.find(
            (f) =>
                (f.requesterId === requesterId && f.addresseeId === addresseeId) ||
                (f.requesterId === addresseeId && f.addresseeId === requesterId)
        ) || null;
    }

    async listByUser(filters: FriendshipFilters): Promise<FriendshipListResult> {
        let filtered = this.items.filter(
            (f) => f.requesterId === filters.userId || f.addresseeId === filters.userId
        );

        if (filters.status) {
            filtered = filtered.filter((f) => f.status === filters.status);
        }

        const total = filtered.length;
        const start = (filters.page - 1) * filters.pageSize;
        const data = filtered.slice(start, start + filters.pageSize);

        return {
            data,
            total,
            page: filters.page,
            pageSize: filters.pageSize,
        };
    }

    async updateStatus(id: string, status: FriendshipStatus): Promise<Friendship> {
        const friendship = await this.findById(id);
        if (!friendship) throw new Error("NOT_FOUND");
        (friendship as any).props.status = status;
        return friendship;
    }

    async delete(id: string): Promise<void> {
        this.items = this.items.filter((f) => f.id !== id);
    }

    async areFriends(userId1: string, userId2: string): Promise<boolean> {
        const friendship = await this.findByUsers(userId1, userId2);
        return friendship?.status === FriendshipStatus.ACCEPTED || false;
    }
}
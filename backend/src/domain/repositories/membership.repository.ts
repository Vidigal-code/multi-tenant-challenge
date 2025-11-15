import {Membership} from "../entities/membership.entity";
import {Role} from "../enums/role.enum";

export interface CreateMembershipInput {
    userId: string;
    companyId: string;
    role: Role;
}

export interface MembershipRepository {
    create(data: CreateMembershipInput): Promise<Membership>;

    findByUserAndCompany(
        userId: string,
        companyId: string,
    ): Promise<Membership | null>;

    listByCompany(companyId: string): Promise<Membership[]>;

    listByUser(userId: string): Promise<Membership[]>;

    countByCompanyAndRole(companyId: string, role: Role): Promise<number>;

    updateRole(id: string, role: Role): Promise<void>;

    remove(id: string): Promise<void>;
}

export const MEMBERSHIP_REPOSITORY = Symbol("MEMBERSHIP_REPOSITORY");

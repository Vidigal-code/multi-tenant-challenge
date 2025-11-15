import {Role} from "../enums/role.enum";
import {InviteStatus} from "../enums/invite-status.enum";
import {Email} from "../value-objects/email.vo";

export interface InviteProps {
    id: string;
    companyId: string;
    email: Email;
    token: string;
    role: Role;
    status: InviteStatus;
    expiresAt: Date;
    createdAt: Date;
    acceptedById?: string | null;
    inviterId: string;
}

export class Invite {
    private constructor(private props: InviteProps) {
    }

    get id(): string {
        return this.props.id;
    }

    get companyId(): string {
        return this.props.companyId;
    }

    get email(): Email {
        return this.props.email;
    }

    get token(): string {
        return this.props.token;
    }

    get role(): Role {
        return this.props.role;
    }

    get status(): InviteStatus {
        return this.props.status;
    }

    get expiresAt(): Date {
        return this.props.expiresAt;
    }

    get createdAt(): Date {
        return this.props.createdAt;
    }

    get inviterId(): string {
        return this.props.inviterId;
    }

    static create(props: InviteProps): Invite {
        return new Invite(props);
    }

    isExpired(reference: Date = new Date()): boolean {
        return reference > this.props.expiresAt;
    }

    isPending(): boolean {
        return this.props.status === InviteStatus.PENDING;
    }

    markAccepted(userId: string): void {
        this.props.status = InviteStatus.ACCEPTED;
        this.props.acceptedById = userId;
    }

    markExpired(): void {
        this.props.status = InviteStatus.EXPIRED;
    }

    cancel(): void {
        this.props.status = InviteStatus.CANCELED;
    }
}

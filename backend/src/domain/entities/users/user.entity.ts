import {Email} from "../../value-objects/email.vo";

export interface UserProps {
    id: string;
    email: Email;
    name: string;
    passwordHash: string;
    activeCompanyId?: string | null;
    notificationPreferences?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}

export class User {
    private constructor(private props: UserProps) {
    }

    get id(): string {
        return this.props.id;
    }

    get email(): Email {
        return this.props.email;
    }

    get name(): string {
        return this.props.name;
    }

    get passwordHash(): string {
        return this.props.passwordHash;
    }

    get activeCompanyId(): string | null | undefined {
        return this.props.activeCompanyId;
    }

    get createdAt(): Date {
        return this.props.createdAt;
    }

    get updatedAt(): Date {
        return this.props.updatedAt;
    }

    get notificationPreferences(): Record<string, any> {
        return this.props.notificationPreferences ?? {};
    }

    static create(props: UserProps): User {
        return new User(props);
    }

    setActiveCompany(companyId: string): void {
        this.props.activeCompanyId = companyId;
    }

    clearActiveCompany(): void {
        this.props.activeCompanyId = null;
    }

    toJSON() {
        return {
            id: this.id,
            email: this.email.toString(),
            name: this.name,
            activeCompanyId: this.activeCompanyId,
            notificationPreferences: this.notificationPreferences,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}

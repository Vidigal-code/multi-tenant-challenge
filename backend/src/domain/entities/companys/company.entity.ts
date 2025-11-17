import { Membership } from "@domain/entities/memberships/membership.entity";
import { Role } from "../../enums/role.enum";

export interface CompanyProps {
  id: string;
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  isPublic?: boolean;
  memberships: Membership[];
  createdAt: Date;
  updatedAt: Date;
}

export class Company {
  private constructor(private props: CompanyProps) {}

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get logoUrl(): string | null | undefined {
    return this.props.logoUrl;
  }

  get memberships(): Membership[] {
    return this.props.memberships;
  }

  get description(): string | null | undefined {
    return this.props.description ?? null;
  }

  get isPublic(): boolean {
    return !!this.props.isPublic;
  }

  static create(props: CompanyProps): Company {
    return new Company(props);
  }

  hasOwner(): boolean {
    return this.props.memberships.some(
      (membership) => membership.role === Role.OWNER,
    );
  }

  owners(): Membership[] {
    return this.props.memberships.filter(
      (membership) => membership.role === Role.OWNER,
    );
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      logoUrl: this.logoUrl,
      description: this.description,
      is_public: this.isPublic,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString(),
    };
  }
}

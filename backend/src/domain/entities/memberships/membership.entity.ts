import { Role } from "../../enums/role.enum";

export interface MembershipProps {
  id: string;
  userId: string;
  companyId: string;
  role: Role;
  createdAt: Date;
}

export class Membership {
  private constructor(private props: MembershipProps) {}

  get id(): string {
    return this.props.id;
  }

  get userId(): string {
    return this.props.userId;
  }

  get companyId(): string {
    return this.props.companyId;
  }

  get role(): Role {
    return this.props.role;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  static create(props: MembershipProps): Membership {
    return new Membership(props);
  }
}

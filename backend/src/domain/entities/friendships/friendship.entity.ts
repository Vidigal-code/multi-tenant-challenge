export enum FriendshipStatus {
    PENDING = 'PENDING',
    ACCEPTED = 'ACCEPTED',
    BLOCKED = 'BLOCKED',
}

export interface FriendshipProps {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: FriendshipStatus;
    createdAt: Date;
    updatedAt: Date;
}

export class Friendship {
    private constructor(private props: FriendshipProps) {
    }

    get id() {
        return this.props.id;
    }

    get requesterId() {
        return this.props.requesterId;
    }

    get addresseeId() {
        return this.props.addresseeId;
    }

    get status() {
        return this.props.status;
    }

    get createdAt() {
        return this.props.createdAt;
    }

    get updatedAt() {
        return this.props.updatedAt;
    }

    static create(props: FriendshipProps): Friendship {
        return new Friendship(props);
    }

    accept() {
        (this.props as any).status = FriendshipStatus.ACCEPTED;
        (this.props as any).updatedAt = new Date();
    }

    block() {
        (this.props as any).status = FriendshipStatus.BLOCKED;
        (this.props as any).updatedAt = new Date();
    }

    toJSON() {
        return {
            id: this.id,
            requesterId: this.requesterId,
            addresseeId: this.addresseeId,
            status: this.status,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }
}
import {
  Friendship,
  FriendshipStatus,
} from "@domain/entities/friendships/friendship.entity";

export interface CreateFriendshipInput {
  requesterId: string;
  addresseeId: string;
}

export interface FriendshipFilters {
  userId: string;
  status?: FriendshipStatus;
  page: number;
  pageSize: number;
}

export interface FriendshipListResult {
  data: Friendship[];
  total: number;
  page: number;
  pageSize: number;
  recordsWithUsers?: any[];
}

export const FRIENDSHIP_REPOSITORY = Symbol("FRIENDSHIP_REPOSITORY");

export interface FriendshipRepository {
  create(input: CreateFriendshipInput): Promise<Friendship>;

  findById(id: string): Promise<Friendship | null>;

  findByUsers(
    requesterId: string,
    addresseeId: string,
  ): Promise<Friendship | null>;

  listByUser(filters: FriendshipFilters): Promise<FriendshipListResult>;

  updateStatus(id: string, status: FriendshipStatus): Promise<Friendship>;

  delete(id: string): Promise<void>;

  areFriends(userId1: string, userId2: string): Promise<boolean>;
}

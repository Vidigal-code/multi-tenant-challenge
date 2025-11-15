import {FriendshipFilters, FriendshipRepository} from "@domain/repositories/friendship.repository";

export class ListFriendshipsUseCase {
    constructor(private readonly friendships: FriendshipRepository) {
    }

    async execute(filters: FriendshipFilters) {
        return this.friendships.listByUser(filters);
    }
}
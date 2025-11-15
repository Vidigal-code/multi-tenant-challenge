export interface InviteTokenService {
    generate(): string;
}

export const INVITE_TOKEN_SERVICE = Symbol("INVITE_TOKEN_SERVICE");

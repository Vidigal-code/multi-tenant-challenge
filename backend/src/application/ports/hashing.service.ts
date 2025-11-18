export interface HashingService {
    hash(value: string): Promise<string>;

    compare(value: string, hash: string): Promise<boolean>;
}

export const HASHING_SERVICE = Symbol("HASHING_SERVICE");

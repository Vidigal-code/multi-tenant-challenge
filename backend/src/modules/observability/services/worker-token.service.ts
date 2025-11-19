import {Injectable, UnauthorizedException} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {Request} from "express";
import {createSecretKey, KeyObject, webcrypto} from "crypto";
import {TextDecoder} from "util";
import type {JWTPayload} from "jose";

const textDecoder = new TextDecoder();

interface JwtConfig {
    secret?: string;
    privateKey?: string;
    publicKey?: string;
    algorithm?: string;
    cookieName?: string;
}

type JoseKey = KeyObject | Uint8Array | webcrypto.CryptoKey;

export interface WorkerTokenPayload extends JWTPayload {
    [key: string]: any;
}

@Injectable()
export class WorkerTokenService {
    private readonly algorithm: string;
    private readonly secret?: string;
    private readonly privateKey?: string;
    private readonly publicKey?: string;
    private readonly cookieName: string;

    constructor(private readonly configService: ConfigService) {
        const workerJwt = this.configService.get<JwtConfig>("app.workerJwt") ?? {};
        const defaultJwt = this.configService.get<JwtConfig>("app.jwt") ?? {};

        this.algorithm = (workerJwt.algorithm ?? defaultJwt.algorithm ?? "HS256").toUpperCase();
        this.secret = workerJwt.secret ?? defaultJwt.secret;
        this.privateKey = workerJwt.privateKey ?? defaultJwt.privateKey;
        this.publicKey = workerJwt.publicKey ?? defaultJwt.publicKey;
        this.cookieName = workerJwt.cookieName ?? "worker_session";
    }

    async verifyRequest(request: Request): Promise<WorkerTokenPayload> {
        const token = this.extractToken(request);
        if (!token) {
            throw new UnauthorizedException("WORKER_TOKEN_MISSING");
        }

        if (this.looksLikeJwe(token)) {
            const decrypted = await this.decryptJwe(token);
            if (this.looksLikeJwt(decrypted)) {
                return this.verifyJwt(decrypted);
            }
            return this.parseJsonPayload(decrypted);
        }

        if (this.looksLikeJwt(token)) {
            return this.verifyJwt(token);
        }

        throw new UnauthorizedException("WORKER_TOKEN_INVALID_FORMAT");
    }

    private extractToken(request: Request): string | null {
        const header = request.headers["authorization"] ?? request.headers["Authorization"];
        if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
            const value = header.slice(7).trim();
            if (value.length > 0) {
                return value;
            }
        }

        if (Array.isArray(header)) {
            const bearerHeader = header.find((item) =>
                typeof item === "string" && item.toLowerCase().startsWith("bearer "),
            );
            if (bearerHeader) {
                return bearerHeader.slice(7).trim();
            }
        }

        const cookieToken = (request as any).cookies?.[this.cookieName];
        if (cookieToken && typeof cookieToken === "string") {
            return cookieToken;
        }

        return null;
    }

    private looksLikeJwt(token: string): boolean {
        return token.split(".").length === 3;
    }

    private looksLikeJwe(token: string): boolean {
        return token.split(".").length === 5;
    }

    private async verifyJwt(token: string): Promise<WorkerTokenPayload> {
        const {jwtVerify} = await import("jose");

        try {
            const key = await this.getVerificationKey();
            const {payload} = await jwtVerify(token, key, {
                algorithms: [this.algorithm],
            });

            if (!payload.sub) {
                throw new UnauthorizedException("WORKER_TOKEN_SUBJECT_REQUIRED");
            }

            return payload as WorkerTokenPayload;
        } catch (error) {
            throw new UnauthorizedException("WORKER_TOKEN_INVALID", {
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private async decryptJwe(token: string): Promise<string> {
        const {compactDecrypt} = await import("jose");
        try {
            const key = await this.getDecryptionKey(token);
            const {plaintext} = await compactDecrypt(token, key);
            return textDecoder.decode(plaintext);
        } catch (error) {
            throw new UnauthorizedException("WORKER_TOKEN_DECRYPT_FAILED", {
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private parseJsonPayload(payload: string): WorkerTokenPayload {
        try {
            const parsed = JSON.parse(payload);
            if (!parsed || typeof parsed !== "object") {
                throw new Error("Invalid payload");
            }
            if (!parsed.sub) {
                throw new UnauthorizedException("WORKER_TOKEN_SUBJECT_REQUIRED");
            }
            return parsed;
        } catch (error) {
            throw new UnauthorizedException("WORKER_TOKEN_PAYLOAD_INVALID", {
                cause: error instanceof Error ? error : undefined,
            });
        }
    }

    private async getVerificationKey(): Promise<JoseKey> {
        if (this.isSymmetricAlgorithm()) {
            return createSecretKey(Buffer.from(this.requireSecret(), "utf-8"));
        }

        const keyMaterial = this.publicKey ?? this.privateKey;
        if (!keyMaterial) {
            throw new UnauthorizedException("WORKER_TOKEN_KEY_NOT_CONFIGURED");
        }

        const {importSPKI, importPKCS8} = await import("jose");

        if (this.publicKey) {
            return importSPKI(this.publicKey, this.algorithm);
        }

        return importPKCS8(this.privateKey!, this.algorithm);
    }

    private async getDecryptionKey(token: string): Promise<JoseKey> {
        if (this.isSymmetricAlgorithm()) {
            return createSecretKey(Buffer.from(this.requireSecret(), "utf-8"));
        }

        const algFromHeader = this.extractJweAlg(token);
        const jweAlg = algFromHeader ?? "ECDH-ES+A256KW";

        const privateKey = this.privateKey;
        if (!privateKey) {
            throw new UnauthorizedException("WORKER_TOKEN_PRIVATE_KEY_REQUIRED");
        }

        const {importPKCS8} = await import("jose");
        return importPKCS8(privateKey, jweAlg);
    }

    private extractJweAlg(token: string): string | undefined {
        try {
            const headerSegment = token.split(".")[0];
            const json = this.decodeBase64Url(headerSegment);
            const header = JSON.parse(json);
            if (header && typeof header.alg === "string") {
                return header.alg;
            }
        } catch {
            // ignore header parsing errors and fall back to default
        }
        return undefined;
    }

    private decodeBase64Url(segment: string): string {
        let normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
        const padding = normalized.length % 4;
        if (padding) {
            normalized += "=".repeat(4 - padding);
        }
        return Buffer.from(normalized, "base64").toString("utf-8");
    }

    private isSymmetricAlgorithm(): boolean {
        return this.algorithm.startsWith("HS");
    }

    private requireSecret(): string {
        if (!this.secret) {
            throw new UnauthorizedException("WORKER_TOKEN_SECRET_REQUIRED");
        }
        return this.secret;
    }
}


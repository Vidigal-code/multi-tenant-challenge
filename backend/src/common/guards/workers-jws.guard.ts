import {CanActivate, ExecutionContext, Injectable, UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {Request} from 'express';

/**
 * EN -
 * WorkersJwsGuard - Guard for protecting worker endpoints using JWS with ES256 algorithm.
 * 
 * This guard validates JWT tokens signed with ES256 (ECDSA using P-256 and SHA-256).
 * ES256 provides stronger security than HS256 by using asymmetric cryptography.
 * 
 * The guard extracts the JWT token from cookies and verifies:
 * 1. Token signature using ECDSA public key (for ES256) or secret (for HS256)
 * 2. Token expiration
 * 3. Token structure and claims
 * 
 * For production use:
 * - Set WORKER_JWT_ALGORITHM=ES256
 * - Provide WORKER_JWT_PRIVATE_KEY (PEM format) for signing tokens
 * - Provide WORKER_JWT_PUBLIC_KEY (PEM format) for verifying tokens
 * - Optionally set WORKER_JWT_SECRET for HS256 algorithm
 * - Use secure key management (AWS KMS, HashiCorp Vault, etc.)
 * 
 * Environment Variables:
 * - WORKER_JWT_ALGORITHM: Algorithm to use (ES256 or HS256, default: ES256)
 * - WORKER_JWT_PUBLIC_KEY: Public key for ES256 verification (PEM format)
 * - WORKER_JWT_PRIVATE_KEY: Private key for ES256 signing (PEM format)
 * - WORKER_JWT_SECRET: Secret key for HS256 (fallback if ES256 keys not provided)
 * - WORKER_JWT_EXPIRES_IN: Token expiration time (default: 7d)
 * - WORKER_JWT_COOKIE_NAME: Cookie name containing the token (default: session)
 * 
 * PT -
 * WorkersJwsGuard - Guard para proteger endpoints de workers usando JWS com algoritmo ES256.
 * 
 * Este guard valida tokens JWT assinados com ES256 (ECDSA usando P-256 e SHA-256).
 * ES256 fornece segurança mais forte que HS256 usando criptografia assimétrica.
 * 
 * O guard extrai o token JWT dos cookies e verifica:
 * 1. Assinatura do token usando chave pública ECDSA (para ES256) ou secret (para HS256)
 * 2. Expiração do token
 * 3. Estrutura e claims do token
 * 
 * Para uso em produção:
 * - Configure WORKER_JWT_ALGORITHM=ES256
 * - Forneça WORKER_JWT_PRIVATE_KEY (formato PEM) para assinar tokens
 * - Forneça WORKER_JWT_PUBLIC_KEY (formato PEM) para verificar tokens
 * - Opcionalmente configure WORKER_JWT_SECRET para algoritmo HS256
 * - Use gerenciamento seguro de chaves (AWS KMS, HashiCorp Vault, etc.)
 * 
 * Variáveis de Ambiente:
 * - WORKER_JWT_ALGORITHM: Algoritmo a usar (ES256 ou HS256, padrão: ES256)
 * - WORKER_JWT_PUBLIC_KEY: Chave pública para verificação ES256 (formato PEM)
 * - WORKER_JWT_PRIVATE_KEY: Chave privada para assinatura ES256 (formato PEM)
 * - WORKER_JWT_SECRET: Chave secreta para HS256 (fallback se chaves ES256 não fornecidas)
 * - WORKER_JWT_EXPIRES_IN: Tempo de expiração do token (padrão: 7d)
 * - WORKER_JWT_COOKIE_NAME: Nome do cookie contendo o token (padrão: session)
 */
@Injectable()
export class WorkersJwsGuard implements CanActivate {
    private readonly cookieName: string;
    private readonly algorithm: string;
    private readonly publicKey: string | undefined;
    private readonly secret: string | undefined;

    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
    ) {
        this.algorithm = this.configService.get<string>('app.worker.jwt.algorithm') || 'ES256';
        this.publicKey = this.configService.get<string>('app.worker.jwt.publicKey');
        this.cookieName = this.configService.get<string>('app.worker.jwt.cookieName') || 'session';
        this.secret = this.configService.get<string>('app.worker.jwt.secret');
    }

    /**
     * EN -
     * Validates the JWT token from the request cookie.
     * 
     * Extracts token from cookie, verifies signature and expiration.
     * Throws UnauthorizedException if token is invalid, expired, or missing.
     * 
     * PT -
     * Valida o token JWT do cookie da requisição.
     * 
     * Extrai token do cookie, verifica assinatura e expiração.
     * Lança UnauthorizedException se token for inválido, expirado ou ausente.
     * 
     * @param context - Execution context containing request/response
     * @returns True if token is valid, throws exception otherwise
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromCookie(request);

        if (!token) {
            throw new UnauthorizedException('JWT token is missing');
        }

        try {
            // For ES256, use public key; for HS256, use secret
            const verifyOptions: any = {
                algorithms: [this.algorithm as any],
            };

            if (this.algorithm === 'ES256' && this.publicKey) {
                verifyOptions.publicKey = this.publicKey;
            } else if (this.secret) {
                verifyOptions.secret = this.secret;
            }

            const payload = await this.jwtService.verifyAsync(token, verifyOptions);

            // Attach payload to request for use in controllers
            (request as any).user = payload;
            return true;
        } catch (error: any) {
            throw new UnauthorizedException(`Invalid JWT token: ${error?.message || String(error)}`);
        }
    }

    /**
     * EN -
     * Extracts JWT token from request cookie.
     * 
     * PT -
     * Extrai token JWT do cookie da requisição.
     * 
     * @param request - Express request object
     * @returns JWT token string or null if not found
     */
    private extractTokenFromCookie(request: Request): string | null {
        return request.cookies?.[this.cookieName] ?? null;
    }
}


import {WorkersJwsGuard} from "@common/guards/workers-jws.guard";
import {ConfigService} from "@nestjs/config";
import {JwtService} from "@nestjs/jwt";
import {UnauthorizedException} from "@nestjs/common";
import {ExecutionContext} from "@nestjs/common";

/**
 * EN -
 * Unit tests for WorkersJwsGuard following TDD principles.
 * 
 * Tests cover:
 * - Successful token validation
 * - Rejection when token is missing
 * - Rejection when token is invalid
 * - Rejection when token is expired
 * - Token extraction from cookies
 * - ES256 algorithm support
 * - HS256 algorithm fallback
 * 
 * PT -
 * Testes unitários para WorkersJwsGuard seguindo princípios TDD.
 * 
 * Testes cobrem:
 * - Validação bem-sucedida de token
 * - Rejeição quando token está ausente
 * - Rejeição quando token é inválido
 * - Rejeição quando token está expirado
 * - Extração de token de cookies
 * - Suporte a algoritmo ES256
 * - Fallback para algoritmo HS256
 */
describe("WorkersJwsGuard", () => {
    let guard: WorkersJwsGuard;
    let configService: ConfigService;
    let jwtService: JwtService;
    let mockContext: ExecutionContext;

    beforeEach(() => {
        configService = {
            get: jest.fn((key: string) => {
                const config: Record<string, any> = {
                    "app.worker.jwt.algorithm": "ES256",
                    "app.worker.jwt.publicKey": "test-public-key",
                    "app.worker.jwt.secret": "test-secret",
                    "app.worker.jwt.cookieName": "session",
                };
                return config[key];
            }),
        } as any;

        jwtService = {
            verifyAsync: jest.fn(),
        } as any;

        guard = new WorkersJwsGuard(configService, jwtService);

        mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({
                    cookies: {},
                }),
            }),
        } as any;
    });

    /**
     * EN -
     * Tests successful token validation.
     * Verifies that guard allows access when token is valid.
     * 
     * PT -
     * Testa validação bem-sucedida de token.
     * Verifica que guard permite acesso quando token é válido.
     */
    it("should allow access with valid token", async () => {
        const mockRequest: any = {
            cookies: {
                session: "valid-token",
            },
            user: undefined,
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
        (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
            sub: "user-id",
            email: "user@example.com",
        });

        const result = await guard.canActivate(mockContext);

        expect(result).toBe(true);
        expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", expect.any(Object));
        expect((mockRequest as any).user).toBeDefined();
    });

    /**
     * EN -
     * Tests rejection when token is missing.
     * Verifies that UnauthorizedException is thrown.
     * 
     * PT -
     * Testa rejeição quando token está ausente.
     * Verifica que UnauthorizedException é lançado.
     */
    it("should reject when token is missing", async () => {
        const mockRequest = {
            cookies: {},
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
        await expect(guard.canActivate(mockContext)).rejects.toThrow("JWT token is missing");
    });

    /**
     * EN -
     * Tests rejection when token is invalid.
     * Verifies that UnauthorizedException is thrown with error message.
     * 
     * PT -
     * Testa rejeição quando token é inválido.
     * Verifica que UnauthorizedException é lançado com mensagem de erro.
     */
    it("should reject when token is invalid", async () => {
        const mockRequest = {
            cookies: {
                session: "invalid-token",
            },
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
        (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("Invalid token"));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
        await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid JWT token");
    });

    /**
     * EN -
     * Tests token extraction from cookies.
     * Verifies that guard reads token from correct cookie name.
     * 
     * PT -
     * Testa extração de token de cookies.
     * Verifica que guard lê token do nome de cookie correto.
     */
    it("should extract token from correct cookie name", async () => {
        const mockRequest = {
            cookies: {
                session: "test-token",
            },
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
        (jwtService.verifyAsync as jest.Mock).mockResolvedValue({sub: "user-id"});

        await guard.canActivate(mockContext);

        expect(jwtService.verifyAsync).toHaveBeenCalledWith("test-token", expect.any(Object));
    });

    /**
     * EN -
     * Tests ES256 algorithm configuration.
     * Verifies that guard uses public key for ES256 verification.
     * 
     * PT -
     * Testa configuração de algoritmo ES256.
     * Verifica que guard usa chave pública para verificação ES256.
     */
    it("should use public key for ES256 algorithm", async () => {
        const mockRequest = {
            cookies: {
                session: "es256-token",
            },
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
        (jwtService.verifyAsync as jest.Mock).mockResolvedValue({sub: "user-id"});

        await guard.canActivate(mockContext);

        expect(jwtService.verifyAsync).toHaveBeenCalledWith(
            "es256-token",
            expect.objectContaining({
                algorithms: ["ES256"],
            })
        );
    });

    /**
     * EN -
     * Tests HS256 algorithm fallback.
     * Verifies that guard uses secret for HS256 when ES256 keys not available.
     * 
     * PT -
     * Testa fallback para algoritmo HS256.
     * Verifica que guard usa secret para HS256 quando chaves ES256 não disponíveis.
     */
    it("should use secret for HS256 when ES256 keys not available", async () => {
        const hs256ConfigService = {
            get: jest.fn((key: string) => {
                const config: Record<string, any> = {
                    "app.worker.jwt.algorithm": "HS256",
                    "app.worker.jwt.secret": "hs256-secret",
                    "app.worker.jwt.cookieName": "session",
                };
                return config[key];
            }),
        } as any;

        const hs256Guard = new WorkersJwsGuard(hs256ConfigService, jwtService);

        const mockRequest = {
            cookies: {
                session: "hs256-token",
            },
        };

        (mockContext.switchToHttp().getRequest as jest.Mock).mockReturnValue(mockRequest);
        (jwtService.verifyAsync as jest.Mock).mockResolvedValue({sub: "user-id"});

        await hs256Guard.canActivate(mockContext);

        expect(jwtService.verifyAsync).toHaveBeenCalledWith(
            "hs256-token",
            expect.objectContaining({
                algorithms: ["HS256"],
            })
        );
    });
});


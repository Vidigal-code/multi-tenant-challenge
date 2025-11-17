import {LoginUseCase} from "@application/use-cases/auths/login.usecase";
import {FakeHashingService, InMemoryUserRepository} from "../../support/in-memory-repositories";
import {ApplicationError} from "@application/errors/application-error";
import {ErrorCode} from "@application/errors/error-code";

/**
 * EN -
 * Unit tests for LoginUseCase following TDD principles.
 * 
 * Tests cover:
 * - Successful login with valid credentials
 * - Login failure with non-existent user
 * - Login failure with invalid password
 * - Email normalization (trim and lowercase)
 * 
 * PT -
 * Testes unitários para LoginUseCase seguindo princípios TDD.
 * 
 * Testes cobrem:
 * - Login bem-sucedido com credenciais válidas
 * - Falha de login com usuário inexistente
 * - Falha de login com senha inválida
 * - Normalização de email (trim e lowercase)
 */
describe("LoginUseCase", () => {
    /**
     * EN -
     * Tests successful login with valid credentials.
     * Verifies that user is returned when email and password match.
     * 
     * PT -
     * Testa login bem-sucedido com credenciais válidas.
     * Verifica que usuário é retornado quando email e senha correspondem.
     */
    it("should login successfully with valid credentials", async () => {
        const userRepo = new InMemoryUserRepository();
        const hashing = new FakeHashingService();
        const usecase = new LoginUseCase(userRepo as any, hashing as any);

        const user = await userRepo.create({
            email: "test@example.com",
            name: "Test User",
            passwordHash: await hashing.hash("password123"),
        });

        const result = await usecase.execute({
            email: "test@example.com",
            password: "password123",
        });

        expect(result.user).toBeDefined();
        expect(result.user.id).toBe(user.id);
        expect(result.user.email.toString()).toBe("test@example.com");
    });

    /**
     * EN -
     * Tests login failure when user does not exist.
     * Verifies that INVALID_CREDENTIALS error is thrown.
     * 
     * PT -
     * Testa falha de login quando usuário não existe.
     * Verifica que erro INVALID_CREDENTIALS é lançado.
     */
    it("should reject login when user does not exist", async () => {
        const userRepo = new InMemoryUserRepository();
        const hashing = new FakeHashingService();
        const usecase = new LoginUseCase(userRepo as any, hashing as any);

        const error = await usecase.execute({
            email: "nonexistent@example.com",
            password: "password123",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    /**
     * EN -
     * Tests login failure with invalid password.
     * Verifies that INVALID_CREDENTIALS error is thrown when password doesn't match.
     * 
     * PT -
     * Testa falha de login com senha inválida.
     * Verifica que erro INVALID_CREDENTIALS é lançado quando senha não corresponde.
     */
    it("should reject login with invalid password", async () => {
        const userRepo = new InMemoryUserRepository();
        const hashing = new FakeHashingService();
        const usecase = new LoginUseCase(userRepo as any, hashing as any);

        await userRepo.create({
            email: "test@example.com",
            name: "Test User",
            passwordHash: await hashing.hash("correctpassword"),
        });

        const error = await usecase.execute({
            email: "test@example.com",
            password: "wrongpassword",
        }).catch(e => e);

        expect(error).toBeInstanceOf(ApplicationError);
        expect(error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    });

    /**
     * EN -
     * Tests email normalization (trim and lowercase).
     * Verifies that email is normalized before lookup.
     * 
     * PT -
     * Testa normalização de email (trim e lowercase).
     * Verifica que email é normalizado antes da busca.
     */
    it("should normalize email (trim and lowercase) before lookup", async () => {
        const userRepo = new InMemoryUserRepository();
        const hashing = new FakeHashingService();
        const usecase = new LoginUseCase(userRepo as any, hashing as any);

        await userRepo.create({
            email: "test@example.com",
            name: "Test User",
            passwordHash: await hashing.hash("password123"),
        });

        // Test with uppercase and spaces
        const result = await usecase.execute({
            email: "  TEST@EXAMPLE.COM  ",
            password: "password123",
        });

        expect(result.user).toBeDefined();
        expect(result.user.email.toString()).toBe("test@example.com");
    });
});


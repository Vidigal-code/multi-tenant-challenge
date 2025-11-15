import {AuthController} from "@interfaces/http/auth.controller";
import {AcceptInviteUseCase} from "@application/use-cases/accept-invite.usecase";
import {SignupUseCase} from "@application/use-cases/signup.usecase";
import {LoginUseCase} from "@application/use-cases/login.usecase";
import {DeleteAccountUseCase} from "@application/use-cases/delete-account.usecase";
import {ListPrimaryOwnerCompaniesUseCase} from "@application/use-cases/list-primary-owner-companies.usecase";
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import {UserRepository} from "@domain/repositories/user.repository";
import {HashingService} from "@application/ports/hashing.service";

function resStub() {
    const cookies: Record<string, any> = {};
    return {
        cookie: (name: string, value: string, opts: any) => {
            cookies[name] = {value, opts};
        },
        _cookies: cookies,
    } as any;
}

describe("AuthController extra endpoints", () => {

    const signup = {execute: jest.fn()} as any as SignupUseCase;
    const login = {execute: jest.fn()} as any as LoginUseCase;
    const accept = {execute: jest.fn()} as any as AcceptInviteUseCase;
    const jwt = {signAsync: jest.fn().mockResolvedValue("jwt-token")} as any as JwtService;
    const cfg = {get: jest.fn((k: string) => (k === "app.jwt.cookieName" ? "mt_session" : undefined))} as any as ConfigService;

    const userRepo: jest.Mocked<UserRepository> = {
        create: jest.fn(),
        findByEmail: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        deleteById: jest.fn() as any,
    } as any;
    const hashing: jest.Mocked<HashingService> = {
        hash: jest.fn(),
        compare: jest.fn(),
    } as any;
    const deleteAccount = {execute: jest.fn()} as any as DeleteAccountUseCase;
    const listPrimaryOwnerCompanies = {execute: jest.fn()} as any as ListPrimaryOwnerCompaniesUseCase;

    const controller = new AuthController(signup, login, accept, deleteAccount, listPrimaryOwnerCompanies, jwt, cfg, userRepo, hashing);
    const currentUser = {sub: "u1", email: "u@example.com", activeCompanyId: null};

    it("GET /auth/profile returns minimal user payload", async () => {
        const result = await (controller as any).profile(currentUser);
        expect(result).toEqual({id: "u1", email: "u@example.com", activeCompanyId: null});
    });

    it("POST /auth/profile rejects when no fields", async () => {
        await expect((controller as any).updateProfile(currentUser, {}, resStub())).rejects.toMatchObject(
            new Error('NO_FIELDS_TO_UPDATE')
        );
    });

    it("POST /auth/profile requires currentPassword for email/password changes", async () => {
        await expect(
            (controller as any).updateProfile(currentUser, {email: "new@example.com"}, resStub()),
        ).rejects.toMatchObject(new Error('CURRENT_PASSWORD_REQUIRED'));
    });

    it("POST /auth/profile rejects invalid current password", async () => {
        userRepo.findById.mockResolvedValue({id: "u1", passwordHash: "hashed:old"} as any);
        hashing.compare.mockResolvedValue(false);
        await expect(
            (controller as any).updateProfile(
                currentUser,
                {newPassword: "newPass123", currentPassword: "wrong"},
                resStub(),
            ),
        ).rejects.toMatchObject(new Error('INVALID_CURRENT_PASSWORD'));
    });

    it("POST /auth/profile updates and refreshes cookie", async () => {
        userRepo.findById.mockResolvedValue({id: "u1", passwordHash: "hashed:old"} as any);
        hashing.compare.mockResolvedValue(true);
        hashing.hash.mockResolvedValue("hashed:newPass123");
        userRepo.findByEmail.mockResolvedValue(null);
        userRepo.update.mockResolvedValue({
            id: "u1", email: {toString: () => "u@example.com"},
            activeCompanyId: null, toJSON: () => ({id: "u1", email: "u@example.com"})
        } as any);
        const res = resStub();
        const payload = {newPassword: "newPass123", currentPassword: "oldPass123"};
        const out = await (controller as any).updateProfile(currentUser, payload, res);
        expect(out).toEqual({id: "u1", email: "u@example.com"});
        expect(res._cookies["mt_session"]).toBeTruthy();
    });

    it("POST /auth/logout clears cookie", async () => {
        const res = resStub();
        const out = await (controller as any).logout(res);
        expect(out).toEqual({success: true});
        expect(res._cookies["mt_session"].value).toBe("");
        expect(res._cookies["mt_session"].opts.expires instanceof Date).toBe(true);
    });

    it("DELETE /auth/account calls use case and clears cookie", async () => {
        const res = resStub();
        const out = await (controller as any).deleteAccount(currentUser, {}, res);
        expect(deleteAccount.execute).toHaveBeenCalledWith({userId: "u1", deleteCompanyIds: undefined});
        expect(out).toEqual({success: true});
        expect(res._cookies["mt_session"].value).toBe("");
    });
});

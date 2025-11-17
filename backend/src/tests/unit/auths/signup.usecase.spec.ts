import { SignupUseCase } from "@application/use-cases/auths/signup.usecase";
import {
  FakeHashingService,
  InMemoryUserRepository,
} from "../../support/in-memory-repositories";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";

describe("SignupUseCase", () => {
  it("creates a new users with hashed password", async () => {
    const userRepo = new InMemoryUserRepository();
    const hashing = new FakeHashingService();
    const usecase = new SignupUseCase(userRepo as any, hashing as any);
    const { user } = await usecase.execute({
      email: "a@a.com",
      name: "User A",
      password: "secret",
    });
    expect(user.id).toBeDefined();
    expect(user.email.toString()).toBe("a@a.com");
    const stored = await userRepo.findByEmail("a@a.com");
    expect(stored?.passwordHash).toBe("hashed:secret");
  });

  it("rejects duplicate email", async () => {
    const userRepo = new InMemoryUserRepository();
    const hashing = new FakeHashingService();
    const usecase = new SignupUseCase(userRepo as any, hashing as any);
    await usecase.execute({ email: "a@a.com", name: "User A", password: "x" });
    const error = await usecase
      .execute({ email: "a@a.com", name: "User B", password: "y" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.code).toBe(ErrorCode.EMAIL_ALREADY_USED);
  });
});

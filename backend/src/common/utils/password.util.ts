import * as bcrypt from "bcryptjs";

export class PasswordUtil {
  static async hash(password: string, saltRounds: number): Promise<string> {
    return bcrypt.hash(password, saltRounds);
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

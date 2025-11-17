export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string): Email {
    const trimmed = raw.trim().toLowerCase();
    if (!Email.isValid(trimmed)) {
      throw new Error("INVALID_EMAIL");
    }
    return new Email(trimmed);
  }

  static isValid(value: string): boolean {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(value);
  }

  toString(): string {
    return this.value;
  }
}

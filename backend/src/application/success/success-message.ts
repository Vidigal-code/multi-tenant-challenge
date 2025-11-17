import { SuccessCode } from "./success-code";

export class SuccessMessage<T = any> {
  constructor(
    public readonly code: SuccessCode,
    public readonly data?: T,
  ) {}

  getCode(): string {
    return this.code;
  }

  toJSON() {
    return {
      success: true,
      code: this.code,
      ...(this.data && { data: this.data }),
    };
  }

  static create(code: SuccessCode): SuccessMessage {
    return new SuccessMessage(code);
  }

  static createWithData<T>(code: SuccessCode, data: T): SuccessMessage<T> {
    return new SuccessMessage(code, data);
  }
}

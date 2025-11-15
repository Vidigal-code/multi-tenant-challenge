import { ErrorCode } from './error-code';


export class ApplicationError extends Error {
    constructor(
        public readonly code: ErrorCode | string,
        message?: string,
    ) {
        super(message ?? code);
        this.name = 'ApplicationError';
        Object.setPrototypeOf(this, ApplicationError.prototype);
    }

    getCode(): string {
        return typeof this.code === 'string' ? this.code : this.code;
    }

    static fromCode(code: ErrorCode, message?: string): ApplicationError {
        return new ApplicationError(code, message);
    }
}

export interface EmailValidationService {
  exists(email: string): Promise<boolean>;
}

export const EMAIL_VALIDATION_SERVICE = Symbol("EMAIL_VALIDATION_SERVICE");

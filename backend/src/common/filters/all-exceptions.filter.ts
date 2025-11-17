import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Response } from "express";
import { ApplicationError } from "@application/errors/application-error";
import { ErrorCode } from "@application/errors/error-code";
import { LoggerService } from "@infrastructure/logging/logger.service";
import { ConfigService } from "@nestjs/config";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: LoggerService;

  constructor(private readonly configService?: ConfigService) {
    this.logger = new LoggerService(AllExceptionsFilter.name, configService);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server errors";
    let code = "INTERNAL_ERROR";

    if (exception instanceof ApplicationError) {
      status = this.mapApplicationErrorToStatus(exception.code);
      message = exception.message;
      code = exception.code;
      this.logger.default(
        `ApplicationError: ${code} - ${message} - Path: ${request.method} ${request.url}`,
      );
      this.logger.default(
        `ApplicationError: ${code} - ${message} - Path: ${request.method} ${request.url}`,
      );
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === "string"
          ? exceptionResponse
          : (exceptionResponse as any).message;
      code =
        typeof exceptionResponse === "object" &&
        (exceptionResponse as any).error
          ? (exceptionResponse as any).error
          : "HTTP_ERROR";
      this.logger.default(
        `HttpException: ${status} - ${message} - Path: ${request.method} ${request.url}`,
      );
      this.logger.default(
        `HttpException: ${status} - ${message} - Path: ${request.method} ${request.url}`,
      );
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Erro não tratado: ${exception.message} - Path: ${request.method} ${request.url} - Stack: ${exception.stack?.substring(0, 200)}`,
      );
      this.logger.error(
        `Unhandled error: ${exception.message} - Path: ${request.method} ${request.url} - Stack: ${exception.stack?.substring(0, 200)}`,
      );
    } else {
      this.logger.error(
        `Erro desconhecido: ${String(exception)} - Path: ${request.method} ${request.url}`,
      );
      this.logger.error(
        `Unknown error: ${String(exception)} - Path: ${request.method} ${request.url}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      code,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private mapApplicationErrorToStatus(code: string): number {
    const errorMap: Record<string, number> = {
      // Validation errors
      [ErrorCode.NO_FIELDS_TO_UPDATE]: HttpStatus.BAD_REQUEST,
      [ErrorCode.CURRENT_PASSWORD_REQUIRED]: HttpStatus.BAD_REQUEST,
      [ErrorCode.INVALID_EMAIL]: HttpStatus.BAD_REQUEST,
      [ErrorCode.MISSING_USER_DATA]: HttpStatus.BAD_REQUEST,

      // Authentication & Authorization
      [ErrorCode.USER_NOT_AUTHENTICATED]: HttpStatus.UNAUTHORIZED,
      [ErrorCode.INVALID_CREDENTIALS]: HttpStatus.UNAUTHORIZED,
      [ErrorCode.INVALID_CURRENT_PASSWORD]: HttpStatus.UNAUTHORIZED,
      [ErrorCode.NOT_A_MEMBER]: HttpStatus.FORBIDDEN,
      [ErrorCode.INSUFFICIENT_ROLE]: HttpStatus.FORBIDDEN,
      [ErrorCode.FORBIDDEN_ACTION]: HttpStatus.FORBIDDEN,

      // User errors
      [ErrorCode.USER_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.EMAIL_ALREADY_IN_USE]: HttpStatus.CONFLICT,
      [ErrorCode.EMAIL_ALREADY_USED]: HttpStatus.CONFLICT,

      // Company errors
      [ErrorCode.COMPANY_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.OWNER_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.NO_ACTIVE_COMPANY]: HttpStatus.FORBIDDEN,
      [ErrorCode.NO_MEMBERSHIP_FOUND]: HttpStatus.FORBIDDEN,
      [ErrorCode.CANNOT_JOIN_OWN_COMPANY]: HttpStatus.BAD_REQUEST,
      [ErrorCode.JOIN_REQUEST_NOT_ALLOWED]: HttpStatus.FORBIDDEN,
      [ErrorCode.JOIN_REQUEST_ALREADY_EXISTS]: HttpStatus.CONFLICT,
      [ErrorCode.JOIN_REQUEST_NOT_FOUND]: HttpStatus.NOT_FOUND,

      // Invitation errors
      [ErrorCode.INVITE_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.INVITE_ALREADY_USED]: HttpStatus.BAD_REQUEST,
      [ErrorCode.INVITE_EXPIRED]: HttpStatus.BAD_REQUEST,
      [ErrorCode.INVITE_ALREADY_EXISTS]: HttpStatus.CONFLICT,
      [ErrorCode.CANNOT_INVITE_SELF]: HttpStatus.BAD_REQUEST,
      [ErrorCode.CANNOT_INVITE_MEMBER]: HttpStatus.BAD_REQUEST,
      [ErrorCode.INVITE_NOT_PENDING]: HttpStatus.BAD_REQUEST,
      [ErrorCode.ONLY_OWNER_CAN_INVITE_OWNER]: HttpStatus.FORBIDDEN,

      // Member errors
      [ErrorCode.REQUESTER_NOT_MEMBER]: HttpStatus.FORBIDDEN,
      [ErrorCode.TARGET_NOT_MEMBER]: HttpStatus.NOT_FOUND,
      [ErrorCode.CANNOT_REMOVE_OWNER]: HttpStatus.FORBIDDEN,
      [ErrorCode.LAST_OWNER_CANNOT_BE_REMOVED]: HttpStatus.FORBIDDEN,
      [ErrorCode.CANNOT_MODIFY_OWNER]: HttpStatus.FORBIDDEN,
      [ErrorCode.CANNOT_ASSIGN_OWNER]: HttpStatus.FORBIDDEN,
      [ErrorCode.OWNER_MUST_TRANSFER_BEFORE_LEAVE]: HttpStatus.FORBIDDEN,
      [ErrorCode.ONLY_OWNER_CAN_TRANSFER]: HttpStatus.FORBIDDEN,
      [ErrorCode.NEW_OWNER_NOT_MEMBER]: HttpStatus.NOT_FOUND,
      [ErrorCode.CANNOT_TRANSFER_TO_SELF]: HttpStatus.BAD_REQUEST,

      // Notification errors
      [ErrorCode.NO_COMPANY_MEMBERS_AVAILABLE]: HttpStatus.BAD_REQUEST,
      [ErrorCode.CANNOT_SEND_TO_SELF]: HttpStatus.BAD_REQUEST,
      [ErrorCode.USER_MUST_BE_MEMBER_OR_FRIEND]: HttpStatus.FORBIDDEN,
      [ErrorCode.NOTIFICATION_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.NOT_AUTHORIZED]: HttpStatus.FORBIDDEN,
      [ErrorCode.CANNOT_REPLY_TO_NOTIFICATION]: HttpStatus.FORBIDDEN,
      [ErrorCode.FORBIDDEN_NOTIFICATION]: HttpStatus.FORBIDDEN,

      // Friendship errors
      [ErrorCode.CANNOT_ADD_YOURSELF]: HttpStatus.BAD_REQUEST,
      [ErrorCode.ALREADY_FRIENDS]: HttpStatus.CONFLICT,
      [ErrorCode.FRIEND_REQUEST_ALREADY_SENT]: HttpStatus.CONFLICT,
      [ErrorCode.USER_BLOCKED]: HttpStatus.FORBIDDEN,
      [ErrorCode.FRIENDSHIP_NOT_FOUND]: HttpStatus.NOT_FOUND,
      [ErrorCode.CANNOT_ACCEPT_OTHERS_REQUEST]: HttpStatus.FORBIDDEN,
      [ErrorCode.FRIENDSHIP_NOT_PENDING]: HttpStatus.BAD_REQUEST,
      [ErrorCode.CANNOT_REJECT_OTHERS_REQUEST]: HttpStatus.FORBIDDEN,

      // Account Deletion
      [ErrorCode.CANNOT_DELETE_ACCOUNT_WITH_PRIMARY_OWNER_COMPANIES]:
        HttpStatus.BAD_REQUEST,
      [ErrorCode.CANNOT_DELETE_LAST_OWNER]: HttpStatus.BAD_REQUEST,
    };

    return errorMap[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
  }
}

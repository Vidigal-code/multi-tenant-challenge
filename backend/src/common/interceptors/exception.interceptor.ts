import {CallHandler, ExecutionContext, Injectable, NestInterceptor,} from "@nestjs/common";
import {Observable, throwError} from "rxjs";
import {catchError} from "rxjs/operators";

@Injectable()
export class ExceptionInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            catchError((error: unknown) => {
                if (error instanceof Error && !(error as any).status) {
                    (error as any).status = 500;
                    (error as any).message = error.message ?? "Internal Server Error";
                }
                return throwError(() => error);
            }),
        );
    }
}

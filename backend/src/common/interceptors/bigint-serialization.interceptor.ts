import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

@Injectable()
export class BigIntSerializationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serializeBigInts(data)));
  }

  private serializeBigInts(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === "bigint") {
      return data.toString();
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.serializeBigInts(item));
    }

    if (typeof data === "object") {
      const serialized = { ...data };
      for (const key in serialized) {
        if (Object.prototype.hasOwnProperty.call(serialized, key)) {
          serialized[key] = this.serializeBigInts(serialized[key]);
        }
      }
      return serialized;
    }

    return data;
  }
}

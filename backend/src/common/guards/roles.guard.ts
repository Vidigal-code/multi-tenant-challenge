import {CanActivate, ExecutionContext, ForbiddenException, Injectable,} from "@nestjs/common";
import {Reflector} from "@nestjs/core";
import {ROLES_KEY} from "@common/decorators/roles.decorator";
import {Role} from "@domain/enums/role.enum";

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {
    }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const membership = request.membership;
        if (!membership) {
            throw new ForbiddenException("NO_MEMBERSHIP_FOUND");
        }

        if (requiredRoles.includes(membership.role)) {
            return true;
        }

        throw new ForbiddenException("INSUFFICIENT_ROLE");
    }
}

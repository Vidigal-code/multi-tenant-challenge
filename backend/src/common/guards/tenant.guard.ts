import {CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable,} from "@nestjs/common";
import {MEMBERSHIP_REPOSITORY, MembershipRepository,} from "@domain/repositories/membership.repository";

@Injectable()
export class TenantGuard implements CanActivate {
    constructor(
        @Inject(MEMBERSHIP_REPOSITORY)
        private readonly membershipRepository: MembershipRepository,
    ) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user || !user.sub) {
            throw new ForbiddenException("USER_NOT_AUTHENTICATED");
        }

        const activeCompanyId = user.activeCompanyId;
        if (!activeCompanyId) {
            throw new ForbiddenException("NO_ACTIVE_COMPANY");
        }

        const membership = await this.membershipRepository.findByUserAndCompany(
            user.sub,
            activeCompanyId,
        );
        if (!membership) {
            throw new ForbiddenException("NOT_A_MEMBER");
        }

        request.membership = membership;
        return true;
    }
}

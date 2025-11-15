import {Inject, Injectable, UnauthorizedException} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";
import {PassportStrategy} from "@nestjs/passport";
import {ExtractJwt, Strategy} from "passport-jwt";
import {Request} from "express";
import {USER_REPOSITORY, UserRepository,} from "@domain/repositories/users/user.repository";

export interface JwtPayload {
    sub: string;
    email: string;
    activeCompanyId?: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly configService: ConfigService,
        @Inject(USER_REPOSITORY)
        private readonly userRepository: UserRepository,
    ) {
        const secret = configService.get<string>("app.jwt.secret");
        if (!secret) {
            throw new Error("JWT secret is not configured");
        }
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: Request) => {
                    const cookieName =
                        configService.get<string>("app.jwt.cookieName") ?? "session";
                    return request.cookies?.[cookieName] ?? null;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: secret,
            passReqToCallback: false,
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.userRepository.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException("USER_NOT_FOUND");
        }

        return {
            sub: user.id,
            email: user.email.toString(),
            activeCompanyId: user.activeCompanyId,
        };
    }
}

import {Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {InfrastructureModule} from "../../infrastructure.module";
import {JwtStrategy} from "../jwtconfig/jwt.strategy";
import {JwtModule, JwtModuleOptions} from "@nestjs/jwt";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {BcryptHashingService} from "../services/bcrypt-hashing.service";
import {RandomInviteTokenService} from "../services/random-invite-token.service";
import {HASHING_SERVICE} from "@application/ports/hashing.service";
import {INVITE_TOKEN_SERVICE} from "@application/ports/invite-token.service";

@Module({
    imports: [
        PassportModule.register({defaultStrategy: "jwt"}),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService): JwtModuleOptions => ({
                secret: configService.get<string>("app.jwt.secret") || "default-secret",
                signOptions: {
                    expiresIn: (configService.get<string>("app.jwt.expiresIn") || "7d") as any,
                },
            }),
        }),
        InfrastructureModule,
    ],
    providers: [
        JwtStrategy,
        {
            provide: HASHING_SERVICE,
            useClass: BcryptHashingService,
        },
        {
            provide: INVITE_TOKEN_SERVICE,
            useClass: RandomInviteTokenService,
        },
    ],
    exports: [JwtModule, PassportModule, HASHING_SERVICE, INVITE_TOKEN_SERVICE],
})
export class AuthInfraModule {
}

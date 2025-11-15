import {Module} from "@nestjs/common";
import {PassportModule} from "@nestjs/passport";
import {InfrastructureModule} from "../infrastructure.module";
import {JwtStrategy} from "./jwt.strategy";
import {JwtModule} from "@nestjs/jwt";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {BcryptHashingService} from "./bcrypt-hashing.service";
import {RandomInviteTokenService} from "./random-invite-token.service";
import {HASHING_SERVICE} from "@application/ports/hashing.service";
import {INVITE_TOKEN_SERVICE} from "@application/ports/invite-token.service";

@Module({
    imports: [
        PassportModule.register({defaultStrategy: "jwt"}),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get<string>("app.jwt.secret"),
                signOptions: {
                    expiresIn: configService.get<string>("app.jwt.expiresIn"),
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

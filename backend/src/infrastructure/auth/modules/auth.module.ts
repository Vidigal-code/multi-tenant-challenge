import {Module} from "@nestjs/common";
import {JwtModule, JwtModuleOptions} from "@nestjs/jwt";
import {ConfigModule, ConfigService} from "@nestjs/config";
import {JwtStrategy} from "../jwtconfig/jwt.strategy";

@Module({
    imports: [
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
                secret: configService.get<string>("app.jwt.secret") || "default-secret",
                signOptions: {
                    expiresIn: (configService.get<string>("app.jwt.expiresIn") || "7d") as any,
                },
            }),
        }),
    ],
    providers: [JwtStrategy],
    exports: [JwtModule],
})
export class AuthModule {
}

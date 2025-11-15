import {Inject, Injectable} from "@nestjs/common";
import {ConfigType} from "@nestjs/config";
import crypto from "crypto";
import {appConfig} from "@config/app.config";
import {InviteTokenService} from "@application/ports/invite-token.service";

@Injectable()
export class RandomInviteTokenService implements InviteTokenService {
    constructor(
        @Inject(appConfig.KEY)
        private readonly config: ConfigType<typeof appConfig>,
    ) {
    }

    generate(): string {
        const bytes = this.config.invite.tokenBytes;
        return crypto.randomBytes(bytes).toString("hex");
    }
}

import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { appConfig } from "@config/app.config";
import { HashingService } from "@application/ports/hashing.service";
import { PasswordUtil } from "@common/utils/password.util";

@Injectable()
export class BcryptHashingService implements HashingService {
  constructor(
    @Inject(appConfig.KEY)
    private readonly config: ConfigType<typeof appConfig>,
  ) {}

  async hash(value: string): Promise<string> {
    return PasswordUtil.hash(value, this.config.bcryptCost);
  }

  async compare(value: string, hash: string): Promise<boolean> {
    return PasswordUtil.compare(value, hash);
  }
}

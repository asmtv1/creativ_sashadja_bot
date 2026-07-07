import { Body, Controller, Post } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelegramAuthRequestSchema } from "@course/shared";
import { UsersService } from "../users/users.service";
import { SessionService } from "./session.service";
import { TelegramInitDataService } from "./telegram-init-data.service";

@Controller("auth")
export class TelegramAuthController {
  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly sessions: SessionService
  ) {}

  @Post("telegram")
  async telegram(@Body() body: unknown) {
    const input = TelegramAuthRequestSchema.parse(body);
    const validator = new TelegramInitDataService(
      this.config.getOrThrow<string>("TELEGRAM_BOT_TOKEN"),
      this.config.get<number>("MINIAPP_SESSION_TTL_SECONDS") ?? 1800
    );
    const telegramUser = validator.validate(input.initData);
    const user = await this.users.upsertTelegramUser(telegramUser);

    return {
      token: this.sessions.sign({ userId: user.id, telegramId: user.telegramId }),
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        languageCode: user.languageCode
      }
    };
  }
}

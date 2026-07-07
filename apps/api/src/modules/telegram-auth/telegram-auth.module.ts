import { Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { MiniAppAuthGuard } from "./miniapp-auth.guard";
import { SessionService } from "./session.service";
import { TelegramAuthController } from "./telegram-auth.controller";

@Module({
  imports: [UsersModule],
  controllers: [TelegramAuthController],
  providers: [SessionService, MiniAppAuthGuard],
  exports: [SessionService, MiniAppAuthGuard]
})
export class TelegramAuthModule {}

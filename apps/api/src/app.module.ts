import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./modules/admin/admin.module";
import { BotInternalModule } from "./modules/bot-internal/bot-internal.module";
import { CoursesModule } from "./modules/courses/courses.module";
import { HealthModule } from "./modules/health/health.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { TelegramAuthModule } from "./modules/telegram-auth/telegram-auth.module";
import { UsersModule } from "./modules/users/users.module";
import { ChannelSubscriptionsModule } from "./modules/channel-subscriptions/channel-subscriptions.module";
import { NpdReceiptsModule } from "./modules/npd-receipts/npd-receipts.module";
import { validateEnv } from "./config/env.schema";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv
    }),
    PrismaModule,
    HealthModule,
    UsersModule,
    TelegramAuthModule,
    CoursesModule,
    OrdersModule,
    BotInternalModule,
    AdminModule,
    ChannelSubscriptionsModule,
    NpdReceiptsModule
  ]
})
export class AppModule {}

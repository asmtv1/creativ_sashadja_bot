import { Module } from "@nestjs/common";
import { CoursesModule } from "../courses/courses.module";
import { TelegramAuthModule } from "../telegram-auth/telegram-auth.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [CoursesModule, TelegramAuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}

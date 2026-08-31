import { Module } from "@nestjs/common";
import { CoursesModule } from "../courses/courses.module";
import { TelegramAuthModule } from "../telegram-auth/telegram-auth.module";
import { YooKassaModule } from "../yookassa/yookassa.module";
import { NpdReceiptsModule } from "../npd-receipts/npd-receipts.module";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  imports: [CoursesModule, TelegramAuthModule, YooKassaModule, NpdReceiptsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService]
})
export class OrdersModule {}

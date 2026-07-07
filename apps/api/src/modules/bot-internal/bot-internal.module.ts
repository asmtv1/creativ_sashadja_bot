import { Module } from "@nestjs/common";
import { InternalTokenGuard } from "../../common/guards/internal-token.guard";
import { CoursesModule } from "../courses/courses.module";
import { OrdersModule } from "../orders/orders.module";
import { UsersModule } from "../users/users.module";
import { BotInternalController } from "./bot-internal.controller";

@Module({
  imports: [CoursesModule, OrdersModule, UsersModule],
  controllers: [BotInternalController],
  providers: [InternalTokenGuard]
})
export class BotInternalModule {}

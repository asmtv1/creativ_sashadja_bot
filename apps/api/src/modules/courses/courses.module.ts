import { Module } from "@nestjs/common";
import { TelegramAuthModule } from "../telegram-auth/telegram-auth.module";
import { CoursesController } from "./courses.controller";
import { CoursesService } from "./courses.service";

@Module({
  imports: [TelegramAuthModule],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService]
})
export class CoursesModule {}

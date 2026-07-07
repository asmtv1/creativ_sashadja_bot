import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { MiniAppAuthGuard } from "../telegram-auth/miniapp-auth.guard";
import { CoursesService } from "./courses.service";

@Controller("me")
@UseGuards(MiniAppAuthGuard)
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get("course")
  getCourse(@Req() request: any) {
    return this.courses.getCourseForUser(request.session.userId);
  }

  @Get("lessons/:lessonSlug")
  getLesson(@Req() request: any, @Param("lessonSlug") lessonSlug: string) {
    return this.courses.getLessonForUser(request.session.userId, lessonSlug);
  }
}

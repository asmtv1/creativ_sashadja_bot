import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { buildCourseAccessResponse, withKinescopeWatermark } from "./course.presenter";

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultCourse() {
    const course = await this.prisma.course.findFirst({
      where: { isPublished: true },
      orderBy: { createdAt: "asc" }
    });
    if (!course) {
      throw new NotFoundException("Published course not found");
    }
    return course;
  }

  async hasAccess(userId: string, courseId: string): Promise<boolean> {
    const access = await this.prisma.courseAccess.findUnique({
      where: { userId_courseId: { userId, courseId } }
    });
    return Boolean(access && !access.revokedAt);
  }

  async getCourseForUser(userId: string) {
    const course = await this.getDefaultCourse();
    const hasAccess = await this.hasAccess(userId, course.id);
    const lessons = await this.prisma.lesson.findMany({
      where: { courseId: course.id, isPublished: true },
      orderBy: { sortOrder: "asc" }
    });

    const viewer = hasAccess
      ? await this.prisma.telegramUser.findUniqueOrThrow({
          where: { id: userId },
          select: { telegramId: true, username: true }
        })
      : undefined;

    return buildCourseAccessResponse({ hasAccess, course, lessons, viewer });
  }

  async getLessonForUser(userId: string, lessonSlug: string) {
    const course = await this.getDefaultCourse();
    const hasAccess = await this.hasAccess(userId, course.id);
    if (!hasAccess) {
      throw new ForbiddenException("Course access required");
    }

    const lesson = await this.prisma.lesson.findUnique({
      where: { courseId_slug: { courseId: course.id, slug: lessonSlug } }
    });
    if (!lesson || !lesson.isPublished) {
      throw new NotFoundException("Lesson not found");
    }

    const viewer = await this.prisma.telegramUser.findUniqueOrThrow({
      where: { id: userId },
      select: { telegramId: true, username: true }
    });

    return {
      ...lesson,
      kinescopeEmbedUrl: withKinescopeWatermark(lesson.kinescopeEmbedUrl, viewer)
    };
  }
}

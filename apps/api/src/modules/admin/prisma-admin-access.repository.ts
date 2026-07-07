import { Injectable } from "@nestjs/common";
import { Prisma } from "@course/db";
import { PrismaService } from "../prisma/prisma.service";
import { AdminAccessRepository } from "./admin-access.service";

@Injectable()
export class PrismaAdminAccessRepository implements AdminAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserAndCourse(telegramId: string, courseSlug: string) {
    const [user, course] = await Promise.all([
      this.prisma.telegramUser.findUnique({ where: { telegramId } }),
      this.prisma.course.findUnique({ where: { slug: courseSlug } })
    ]);
    if (!user || !course) {
      return null;
    }
    return { user, course };
  }

  async grantAccess(userId: string, courseId: string) {
    await this.prisma.courseAccess.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: { source: "ADMIN", revokedAt: null, grantedAt: new Date() },
      create: { userId, courseId, source: "ADMIN" }
    });
  }

  async revokeAccess(userId: string, courseId: string) {
    await this.prisma.courseAccess.updateMany({
      where: { userId, courseId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async auditLog(
    action: string,
    actor: string,
    targetUserId?: string,
    targetCourseId?: string,
    metadata?: Record<string, unknown>
  ) {
    await this.prisma.adminAuditLog.create({
      data: {
        action,
        actor,
        targetUserId,
        targetCourseId,
        metadata: metadata as Prisma.InputJsonValue | undefined
      }
    });
  }
}

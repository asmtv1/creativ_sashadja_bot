export type AdminAccessRepository = {
  findUserAndCourse(
    telegramId: string,
    courseSlug: string
  ): Promise<{
    user: { id: string; telegramId: string };
    course: { id: string; slug: string };
  } | null>;
  grantAccess(userId: string, courseId: string): Promise<void>;
  revokeAccess(userId: string, courseId: string): Promise<void>;
  auditLog(
    action: string,
    actor: string,
    targetUserId?: string,
    targetCourseId?: string,
    metadata?: Record<string, unknown>
  ): Promise<void>;
};

export class AdminAccessService {
  constructor(private readonly repository: AdminAccessRepository) {}

  async grant(input: { telegramId: string; courseSlug: string; actor: string }) {
    const pair = await this.repository.findUserAndCourse(input.telegramId, input.courseSlug);
    if (!pair) {
      throw new Error("User or course not found");
    }
    await this.repository.grantAccess(pair.user.id, pair.course.id);
    await this.repository.auditLog("ACCESS_GRANT", input.actor, pair.user.id, pair.course.id);
  }

  async revoke(input: { telegramId: string; courseSlug: string; actor: string }) {
    const pair = await this.repository.findUserAndCourse(input.telegramId, input.courseSlug);
    if (!pair) {
      throw new Error("User or course not found");
    }
    await this.repository.revokeAccess(pair.user.id, pair.course.id);
    await this.repository.auditLog("ACCESS_REVOKE", input.actor, pair.user.id, pair.course.id);
  }
}

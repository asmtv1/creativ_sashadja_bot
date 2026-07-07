import { describe, expect, it } from "vitest";
import { AdminAccessRepository, AdminAccessService } from "./admin-access.service";

function createAdminRepo(): AdminAccessRepository & {
  access: Set<string>;
  audit: Array<{ action: string; actor: string }>;
} {
  return {
    access: new Set<string>(),
    audit: [],
    async findUserAndCourse(telegramId: string, courseSlug: string) {
      return {
        user: { id: `user_${telegramId}`, telegramId },
        course: { id: `course_${courseSlug}`, slug: courseSlug }
      };
    },
    async grantAccess(userId: string, courseId: string) {
      this.access.add(`${userId}:${courseId}`);
    },
    async revokeAccess(userId: string, courseId: string) {
      this.access.delete(`${userId}:${courseId}`);
    },
    async auditLog(action: string, actor: string) {
      this.audit.push({ action, actor });
    }
  };
}

describe("AdminAccessService", () => {
  it("grants and revokes access with audit log entries", async () => {
    const repo = createAdminRepo();
    const service = new AdminAccessService(repo);

    await service.grant({ telegramId: "42", courseSlug: "basic", actor: "admin" });
    expect(repo.access.has("user_42:course_basic")).toBe(true);

    await service.revoke({ telegramId: "42", courseSlug: "basic", actor: "admin" });
    expect(repo.access.has("user_42:course_basic")).toBe(false);
    expect(repo.audit.map((entry) => entry.action)).toEqual(["ACCESS_GRANT", "ACCESS_REVOKE"]);
  });
});

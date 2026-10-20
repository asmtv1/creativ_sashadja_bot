import { describe, expect, it, vi } from "vitest";
import { AdminChannelMembershipAuditService } from "./admin-channel-membership-audit.service";

describe("AdminChannelMembershipAuditService", () => {
  it("reads the authoritative Telegram channel count and verifies removed members without mutations", async () => {
    const prisma = {
      channelProduct: { findUniqueOrThrow: vi.fn(async () => ({ id: "product", title: "Creative Ideas", telegramChatId: "-10042" })) },
      channelSubscription: { count: vi.fn().mockResolvedValueOnce(150).mockResolvedValueOnce(80).mockResolvedValueOnce(3) },
      channelRemovalTask: {
        count: vi.fn(async () => 3),
        findMany: vi.fn(async () => ["1", "2", "3"].map((telegramId) => ({ subscription: { user: { telegramId } } }))),
      },
    };
    const telegram = {
      getMemberCount: vi.fn(async () => 139),
      getMember: vi.fn(async (_chatId: string, id: string) => {
        if (id === "3") throw new Error("Telegram rate limited");
        return { status: id === "1" ? "left" : "member" };
      }),
      removeAndConfirm: vi.fn(),
    };
    const result = await new AdminChannelMembershipAuditService(prisma as any, telegram as any).report();
    expect(result).toMatchObject({
      telegramMemberCount: 139,
      trackedSubscriptions: 150,
      activeSubscriptions: 80,
      exemptSubscriptions: 3,
      confirmedRemovals: 3,
      verifiedRemoved: { absent: 1, stillPresent: 1, checkFailed: 1 },
      verifiedRemovedCoversAll: true,
    });
    expect(telegram.getMemberCount).toHaveBeenCalledWith("-10042");
    expect(telegram.getMember).toHaveBeenCalledTimes(3);
    expect(telegram.removeAndConfirm).not.toHaveBeenCalled();
  });
  it("refuses to assert a complete audit when truncated", async () => {
    const prisma = {
      channelProduct: { findUniqueOrThrow: vi.fn(async () => ({ id: "product", title: "Creative Ideas", telegramChatId: "-10042" })) },
      channelSubscription: { count: vi.fn(async () => 0) },
      channelRemovalTask: { count: vi.fn(async () => 501), findMany: vi.fn(async () => []) },
    };
    const telegram = { getMemberCount: vi.fn(async () => 0), getMember: vi.fn() };
    const result = await new AdminChannelMembershipAuditService(prisma as any, telegram as any).report();
    expect(result.verifiedRemovedCoversAll).toBe(false);
    expect(telegram.getMember).not.toHaveBeenCalled();
  });
});

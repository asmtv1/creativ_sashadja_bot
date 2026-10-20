import { describe, expect, it, vi } from "vitest";
import { AdminChannelReconciliationService, entitlementCategory, isPresent } from "./admin-channel-reconciliation.service";

const now = new Date("2026-10-20T15:00:00Z");
const future = new Date("2026-11-20T15:00:00Z");
const old = new Date("2026-09-20T15:00:00Z");
const sub = (id: string, source: string | null, paid: boolean, periodEnd: Date | null = future) => ({
  status: "ACTIVE", periodEnd,
  membership: source ? { source, removedAt: null } : null,
  payments: paid ? [{ status: "SUCCEEDED" }] : [],
  user: { telegramId: id, username: null, firstName: `Name ${id}`, lastName: null },
  removalTask: null,
});

describe("admin read-only channel reconciliation", () => {
  it("reports overlapping manual and paid entitlements and separate untracked administrators", async () => {
    const subscriptions = [
      sub("1", "MANAGED", true),
      sub("2", "MANUAL", true),
      sub("3", "MANUAL", false),
      sub("4", "MANAGED", true, old),
      sub("5", "MANAGED", false),
    ];
    const prisma = {
      channelProduct: { findUniqueOrThrow: vi.fn(async () => ({ id: "p", title: "Креатив идеи", telegramChatId: "-100", gracePeriodMinutes: 1440 })) },
      channelSubscription: { findMany: vi.fn(async () => subscriptions) },
    };
    const telegram = {
      getMemberCount: vi.fn(async () => 10),
      getAdministrators: vi.fn(async () => [
        { status: "creator", user: { id: 99 } }, { status: "administrator", user: { id: 1 } },
      ]),
      getMember: vi.fn(async (_: string, id: string) => ({ status: id === "1" ? "administrator" : id === "5" ? "left" : "member" })),
      removeAndConfirm: vi.fn(),
    };
    const r = await new AdminChannelReconciliationService(prisma as any, telegram as any).report();
    expect(r).toMatchObject({
      telegramMemberCount: 10, subscriptionRecords: 5,
      activeRecordBreakdown: { totalActive: 4, manual: 2, everPaid: 2, bothManualAndPaid: 1, neitherManualNorPaid: 1 },
      telegramAdministrators: 2, administratorsWithoutSubscription: 1,
      trackedPresent: 4, trackedAbsent: 1,
      membersByEntitlement: { CHANNEL_ADMIN: 1, MANUAL: 2, EXPIRED_PAID: 1 },
      unexplainedMembers: { minimum: 5, maximum: 5, exact: true },
      telegramCheckErrors: 0, readOnly: true,
    });
    expect(r.flaggedTrackedMembers).toHaveLength(1);
    expect(telegram.removeAndConfirm).not.toHaveBeenCalled();
  });

  it("reports uncertainty rather than inventing identities when Telegram checks fail", async () => {
    const prisma = {
      channelProduct: { findUniqueOrThrow: vi.fn(async () => ({ id: "p", title: "Креатив идеи", telegramChatId: "-100", gracePeriodMinutes: 1440 })) },
      channelSubscription: { findMany: vi.fn(async () => [sub("1", null, true), sub("2", null, true)]) },
    };
    const telegram = {
      getMemberCount: vi.fn(async () => 5), getAdministrators: vi.fn(async () => []),
      getMember: vi.fn(async (_: string, id: string) => { if (id === "2") throw new Error("429"); return { status: "member" }; }),
    };
    const r = await new AdminChannelReconciliationService(prisma as any, telegram as any).report();
    expect(r.unexplainedMembers).toEqual({ minimum: 3, maximum: 4, exact: false });
  });

  it("keeps valid grace, pending payments, and exempt members protected", () => {
    const telegramMember = { status: "member" as const };
    expect(isPresent({ status: "kicked" })).toBe(false);
    expect(isPresent({ status: "restricted", is_member: false })).toBe(false);
    expect(entitlementCategory({ ...sub("1", "EXEMPT", false, null) }, now, telegramMember)).toBe("EXEMPT");
    expect(entitlementCategory({ ...sub("1", null, true, new Date(now.getTime() - 60_000)), product: { gracePeriodMinutes: 1440 } }, now, telegramMember)).toBe("GRACE_PERIOD");
    expect(entitlementCategory({ ...sub("1", null, false, old), payments: [{ status: "PENDING" }] }, now, telegramMember)).toBe("PAYMENT_PENDING");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelExpiryService, assessExpiry } from "./channel-expiry.service";

const now = new Date("2026-10-20T12:00:00.000Z");
const old = new Date("2026-10-01T00:00:00.000Z");
function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "subscription-1", userId: "user-1", productId: "product-1", status: "ACTIVE", autoRenew: true,
    periodEnd: old, product: { telegramChatId: "-100123", gracePeriodMinutes: 1440 },
    user: { telegramId: "42", username: "paying", firstName: "Мария", lastName: null },
    membership: null, removalTask: null, invites: [], payments: [{ status: "SUCCEEDED", kind: "INITIAL" }],
    ...overrides,
  } as any;
}
const telegram = () => ({
  getMember: vi.fn(async () => ({ status: "member" as const })),
  removeAndConfirm: vi.fn(async () => "REMOVED" as const),
});

afterEach(() => { delete process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED; vi.restoreAllMocks(); });

describe("expiry assessment safety", () => {
  it("respects paid grace and treats manual access by its own expiry", () => {
    const recentlyEnded = new Date("2026-10-20T11:30:00.000Z");
    expect(assessExpiry(candidate({ periodEnd: recentlyEnded }), now).reason).toBe("GRACE_PERIOD");
    const manual = candidate({ periodEnd: recentlyEnded, membership: { source: "MANUAL", removedAt: null }, payments: [] });
    expect(assessExpiry(manual, now).decision).toBe("REMOVE");
  });
  it("does not delete EXEMPT, renewed, removed, unpaid, pending, or invite holders", () => {
    const examples: Array<[any, string]> = [
      [{ membership: { source: "EXEMPT" } }, "EXEMPT"],
      [{ periodEnd: new Date("2026-11-20T00:00:00Z") }, "ACCESS_ACTIVE"],
      [{ removalTask: { status: "REMOVED" } }, "ALREADY_REMOVED"],
      [{ membership: { source: "MANAGED", removedAt: now } }, "MEMBERSHIP_ALREADY_REMOVED"],
      [{ payments: [] }, "NO_CONFIRMED_PAYMENT"],
      [{ payments: [{ kind: "INITIAL", status: "SUCCEEDED" }, { kind: "RENEWAL", status: "PENDING" }] }, "PAYMENT_PENDING"],
      [{ invites: [{ expiresAt: new Date("2026-10-21T00:00:00Z") }] }, "INVITE_STILL_ACTIVE"],
    ];
    for (const [change, reason] of examples) {
      const result = assessExpiry(candidate(change), now);
      expect(result.reason).toBe(reason);
      expect(result.decision).toBe("SKIP");
    }
  });
});

describe("preview / worker", () => {
  it("is a strictly read-only preview and identifies protected channel roles", async () => {
    const prisma = {
      channelSubscription: {
        count: vi.fn(async () => 2),
        findMany: vi.fn(async () => [candidate(), candidate({ id: "sub-2", user: { telegramId: "43", username: null, firstName: null, lastName: null }, membership: { source: "EXEMPT" } })]),
      },
    };
    const tg = telegram();
    tg.getMember.mockResolvedValue({ status: "administrator" as any });
    const result = await new ChannelExpiryService(prisma as any, tg as any).preview({ limit: 50 }, now);
    expect(result.mode).toBe("DRY_RUN");
    expect(result.enabled).toBe(false);
    expect(result.rows.map((row) => row.reason)).toEqual(["CHANNEL_ADMIN", "EXEMPT"]);
    expect(result.counts).toEqual({ remove: 0, skip: 2 });
    expect(tg.removeAndConfirm).not.toHaveBeenCalled();
    expect(tg.getMember).toHaveBeenCalledTimes(1);
    expect(prisma.channelSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { periodEnd: { lte: now } }, take: 50 }));
  });

  it("refuses any automated removal until explicitly enabled", async () => {
    const prisma = { channelSubscription: { findMany: vi.fn() } };
    const tg = telegram();
    const result = await new ChannelExpiryService(prisma as any, tg as any).runOnce(now);
    expect(result).toEqual({ scanned: 0, disabled: true });
    expect(prisma.channelSubscription.findMany).not.toHaveBeenCalled();
    expect(tg.removeAndConfirm).not.toHaveBeenCalled();
  });

  it("re-reads the subscription under the same lock as confirmed payment and skips newly extended access", async () => {
    process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED = "true";
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      channelSubscription: { findUnique: vi.fn(async () => candidate({ periodEnd: new Date("2026-11-20T00:00:00Z") })) },
      channelRemovalTask: { upsert: vi.fn(async () => ({})) },
    };
    const prisma = { $transaction: vi.fn(async (fn: any) => fn(tx)) };
    const tg = telegram();
    const result = await new ChannelExpiryService(prisma as any, tg as any).processOne("subscription-1");
    expect(result).toBe("SKIPPED");
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.channelRemovalTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ lastReason: "ACCESS_ACTIVE" }) }));
    expect(tg.getMember).not.toHaveBeenCalled();
    expect(tg.removeAndConfirm).not.toHaveBeenCalled();
  });

  it("does not act when another worker or webhook owns the payment lock", async () => {
    process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED = "true";
    const tx = { $queryRaw: vi.fn(async () => [{ locked: false }]), channelSubscription: { findUnique: vi.fn() } };
    const service = new ChannelExpiryService({ $transaction: async (fn: any) => fn(tx) } as any, telegram() as any);
    expect(await service.processOne("subscription-1")).toBe("BUSY");
    expect(tx.channelSubscription.findUnique).not.toHaveBeenCalled();
  });

  it("records REMOVED and marks membership only after Telegram confirms", async () => {
    process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED = "true";
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      channelSubscription: { findUnique: vi.fn(async () => candidate()) },
      channelRemovalTask: { upsert: vi.fn(async () => ({})) },
      channelMembership: { upsert: vi.fn(async () => ({})) },
    };
    const tg = telegram();
    const service = new ChannelExpiryService({ $transaction: async (fn: any) => fn(tx) } as any, tg as any);
    expect(await service.processOne("subscription-1")).toBe("REMOVED");
    expect(tg.removeAndConfirm).toHaveBeenCalledTimes(1);
    expect(tx.channelMembership.upsert).toHaveBeenCalledTimes(1);
    expect(tx.channelRemovalTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "REMOVED", lastReason: "TELEGRAM_CONFIRMED" }) }));
  });

  it("saves Telegram errors for backoff and never claims removal when Telegram fails", async () => {
    process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED = "true";
    const tx = {
      $queryRaw: vi.fn(async () => [{ locked: true }]),
      channelSubscription: { findUnique: vi.fn(async () => candidate()) },
      channelRemovalTask: { findUnique: vi.fn(async () => null), upsert: vi.fn(async () => ({})) },
      channelMembership: { upsert: vi.fn() },
    };
    const tg = telegram();
    tg.getMember.mockRejectedValue(new Error("Telegram getChatMember failed (429)"));
    const service = new ChannelExpiryService({ $transaction: async (fn: any) => fn(tx) } as any, tg as any);
    await expect(service.processOne("subscription-1")).rejects.toThrow("429");
    expect(tx.channelRemovalTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ status: "RETRY", attempts: 1, lastReason: "TELEGRAM_FAILURE" }) }));
    expect(tx.channelMembership.upsert).not.toHaveBeenCalled();
    expect(tg.removeAndConfirm).not.toHaveBeenCalled();
  });

  it("only scans a bounded batch after enablement", async () => {
    process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED = "true";
    const prisma = { channelSubscription: { findMany: vi.fn(async () => []) } };
    const result = await new ChannelExpiryService(prisma as any, telegram() as any).runOnce(now);
    expect(result).toEqual({ scanned: 0, disabled: false });
    expect(prisma.channelSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 25 }));
  });
});

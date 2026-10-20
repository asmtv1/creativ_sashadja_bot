import { describe, expect, it, vi } from "vitest";
import { AdminChannelRenewalsService, presentChannelRenewal } from "./admin-channel-renewals.service";

const now = new Date("2026-10-20T12:00:00.000Z");
const before = new Date("2026-10-01T12:00:00.000Z");
const after = new Date("2026-10-31T12:00:00.000Z");

function payment(kind: "INITIAL" | "RENEWAL" | "MANUAL_RENEWAL", status: "SUCCEEDED" | "FAILED" | "REFUNDED", createdAt: Date) {
  return { id: `${kind}-${createdAt.toISOString()}`, kind, status, amountKopecks: 39000, currency: "RUB", createdAt, paidAt: status === "FAILED" ? null : createdAt };
}
function subscription(overrides: Record<string, unknown> = {}) {
  return {
    status: "ACTIVE",
    autoRenew: true,
    periodEnd: after,
    nextChargeAt: after,
    nextAttemptAt: null,
    user: { telegramId: "42", username: "buyer", firstName: "Иван", lastName: null },
    payments: [payment("INITIAL", "SUCCEEDED", before)],
    ...overrides,
  } as Parameters<typeof presentChannelRenewal>[0];
}

describe("channel renewal report", () => {
  it("distinguishes first paid period from a successful renewal", () => {
    const first = presentChannelRenewal(subscription(), now);
    expect(first.state).toBe("AWAITING");
    expect(first.successfulRenewals).toBe(0);
    expect(first.periodEnd).toBe(after.toISOString());

    const renewed = presentChannelRenewal(subscription({ payments: [
      payment("INITIAL", "SUCCEEDED", before),
      payment("RENEWAL", "SUCCEEDED", new Date("2026-10-19T12:00:00.000Z")),
    ] }), now);
    expect(renewed.state).toBe("RENEWED");
    expect(renewed.successfulRenewals).toBe(1);
    expect(renewed.lastPaidAt).toBe("2026-10-19T12:00:00.000Z");
  });

  it("counts a second successful checkout as renewal even when both payments are INITIAL", () => {
    const row = presentChannelRenewal(subscription({ payments: [
      payment("INITIAL", "SUCCEEDED", before),
      payment("INITIAL", "SUCCEEDED", now),
    ] }), now);
    expect(row.successfulRenewals).toBe(1);
    expect(row.state).toBe("RENEWED");
  });

  it("marks an expired current period as not renewed even with older successful renewals", () => {
    const row = presentChannelRenewal(subscription({ status: "EXPIRED", periodEnd: before, payments: [
      payment("INITIAL", "SUCCEEDED", new Date("2026-08-01T12:00:00.000Z")),
      payment("RENEWAL", "SUCCEEDED", new Date("2026-09-01T12:00:00.000Z")),
      payment("RENEWAL", "FAILED", new Date("2026-10-03T12:00:00.000Z")),
    ] }), now);
    expect(row.state).toBe("NOT_RENEWED");
    expect(row.successfulRenewals).toBe(1);
    expect(row.successfulPayments).toBe(2);
    expect(row.payments[0]?.status).toBe("FAILED");
  });

  it("reports payment retries separately and does not count failed renewals", () => {
    const row = presentChannelRenewal(subscription({ status: "PAST_DUE", nextAttemptAt: after, payments: [
      payment("INITIAL", "SUCCEEDED", before),
      payment("RENEWAL", "FAILED", now),
    ] }), now);
    expect(row.state).toBe("PAYMENT_PROBLEM");
    expect(row.successfulRenewals).toBe(0);
    expect(row.nextAttemptAt).toBe(after.toISOString());
  });

  it("does not report an already revoked or expired status as active access", () => {
    const row = presentChannelRenewal(subscription({ status: "EXPIRED", periodEnd: after }), now);
    expect(row.active).toBe(false);
    expect(row.state).toBe("PAYMENT_PROBLEM");
  });

  it("distinguishes canceled auto renewal and refunded payment", () => {
    expect(presentChannelRenewal(subscription({ status: "CANCELED_AT_PERIOD_END", autoRenew: false }), now).state).toBe("AUTO_RENEW_OFF");
    const refunded = presentChannelRenewal(subscription({ status: "REFUNDED", payments: [payment("INITIAL", "REFUNDED", before)] }), now);
    expect(refunded.state).toBe("REFUNDED");
    expect(refunded.successfulPayments).toBe(0);
  });

  it("fetches only historically paid subscriptions and counts all users, not only the last 500", async () => {
    const prisma = {
      channelProduct: { findUniqueOrThrow: vi.fn(async () => ({ id: "product-1", title: "Креатив идеи" })) },
      channelSubscription: { findMany: vi.fn(async () => [
        subscription({ user: { telegramId: "42", username: "buyer", firstName: "Иван", lastName: null } }),
        subscription({ user: { telegramId: "43", username: "late", firstName: null, lastName: null }, status: "EXPIRED", periodEnd: before }),
        subscription({ user: { telegramId: "44", username: "renewed", firstName: null, lastName: null }, payments: [payment("INITIAL", "SUCCEEDED", before), payment("MANUAL_RENEWAL", "SUCCEEDED", now)] }),
      ]) },
    };
    const result = await new AdminChannelRenewalsService(prisma as any).getReport(now);
    expect(prisma.channelSubscription.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: "product-1", payments: { some: { status: { in: ["SUCCEEDED", "REFUNDED"] } } } },
    }));
    expect(result.metrics).toEqual({ total: 3, active: 2, renewedEver: 1, notRenewed: 1, paymentProblem: 0, autoRenewOff: 0 });
    expect(result.users.map((user) => user.telegramId)).toEqual(["43", "42", "44"]);
  });
});

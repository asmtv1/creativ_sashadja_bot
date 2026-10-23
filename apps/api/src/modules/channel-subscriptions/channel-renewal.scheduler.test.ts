import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelRenewalScheduler } from "./channel-renewal.scheduler";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("ChannelRenewalScheduler", () => {
  it("runs expiry cleanup on startup and at fifteen-minute intervals", async () => {
    vi.useFakeTimers();
    const subscriptions = {
      runRenewals: vi.fn(async () => undefined),
      reconcilePendingInitialPayments: vi.fn(async () => undefined),
    };
    const expiry = { runOnce: vi.fn(async () => ({ scanned: 9, disabled: false })) };
    const notifications = { queueDue: vi.fn(async () => ({ queued: 1 })) };
    const scheduler = new ChannelRenewalScheduler(subscriptions as any, expiry as any, notifications as any);
    scheduler.onModuleInit();
    expect(expiry.runOnce).toHaveBeenCalledTimes(1);
    expect(notifications.queueDue).toHaveBeenCalledTimes(1);
    expect(subscriptions.runRenewals).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(expiry.runOnce).toHaveBeenCalledTimes(2);
    expect(subscriptions.runRenewals).toHaveBeenCalledTimes(1);
    expect(subscriptions.reconcilePendingInitialPayments).toHaveBeenCalledTimes(1);
    expect(notifications.queueDue).toHaveBeenCalledTimes(2);
    scheduler.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(expiry.runOnce).toHaveBeenCalledTimes(2);
  });

  it("survives errors in the initial pass and retries on the scheduled tick", async () => {
    vi.useFakeTimers();
    const expiry = { runOnce: vi.fn().mockRejectedValueOnce(new Error("database temporarily unavailable")).mockResolvedValueOnce({ scanned: 0 }) };
    const subscriptions = { runRenewals: vi.fn(async () => undefined), reconcilePendingInitialPayments: vi.fn(async () => undefined) };
    const notifications = { queueDue: vi.fn(async () => ({ queued: 1 })) };
    const scheduler = new ChannelRenewalScheduler(subscriptions as any, expiry as any, notifications as any);
    scheduler.onModuleInit();
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(expiry.runOnce).toHaveBeenCalledTimes(2);
    scheduler.onModuleDestroy();
  });
});

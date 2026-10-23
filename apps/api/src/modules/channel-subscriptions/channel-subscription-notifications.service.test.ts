import { describe, expect, it, vi } from "vitest";
import { ChannelSubscriptionNotificationsService } from "./channel-subscription-notifications.service";

const now = new Date("2026-10-23T09:00:00.000Z");

describe("ChannelSubscriptionNotificationsService", () => {
  it("queues only canceled-subscription expiration notices and deduplicates repeated scheduler passes", async () => {
    const records = [
      { id: "expiring", periodEnd: new Date(now.getTime() + 60 * 60_000), user: { telegramId: "41" } },
      { id: "expired", periodEnd: new Date(now.getTime() - 60 * 60_000), user: { telegramId: "42" } },
    ];
    const ids = new Set<string>();
    const prisma = {
      channelSubscription: { findMany: vi.fn(async (_args: any) => records) },
      botOutbox: { createMany: vi.fn(async ({ data }: any) => {
        let count = 0;
        for (const row of data) if (!ids.has(row.id)) { ids.add(row.id); count++; }
        return { count };
      }) },
    };
    const service = new ChannelSubscriptionNotificationsService(prisma as any);
    expect(await service.queueDue(now)).toEqual({ queued: 2 });
    expect(await service.queueDue(now)).toEqual({ queued: 0 });
    const selected = prisma.channelSubscription.findMany.mock.calls[0]?.[0] as any;
    expect(selected.where.autoRenew).toBe(false);
    expect(selected.where.payments).toEqual({ none: { status: "PENDING" } });
    const items = (prisma.botOutbox.createMany.mock.calls[0]?.[0] as any).data;
    expect(items.map((x: any) => x.type)).toEqual(["CHANNEL_SUBSCRIPTION_EXPIRING", "CHANNEL_SUBSCRIPTION_EXPIRED"]);
    expect(items[0].id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
    expect(items[0].id).not.toBe(items[1].id);
    expect(items[1].payload.periodEnd).toBe(records[1]!.periodEnd.toISOString());
  });

  it("does not enqueue anything when there are no qualifying subscribers", async () => {
    const prisma = { channelSubscription: { findMany: vi.fn(async () => []) }, botOutbox: { createMany: vi.fn() } };
    const service = new ChannelSubscriptionNotificationsService(prisma as any);
    expect(await service.queueDue(now)).toEqual({ queued: 0 });
    expect(prisma.botOutbox.createMany).not.toHaveBeenCalled();
  });
});

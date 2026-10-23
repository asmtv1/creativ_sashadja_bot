import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const HOUR = 60 * 60_000;
const NOTICE_LOOKBACK = 48 * HOUR;
const NOTICE_LEAD = 24 * HOUR;

type NoticeKind = "CHANNEL_SUBSCRIPTION_EXPIRING" | "CHANNEL_SUBSCRIPTION_EXPIRED";

/** Stable UUID so concurrent schedulers and repeated runs enqueue each notice once. */
function noticeId(subscriptionId: string, periodEnd: string, kind: NoticeKind): string {
  const hash = createHash("sha256").update(`${subscriptionId}:${periodEnd}:${kind}`).digest();
  hash[6] = (hash[6]! & 0x0f) | 0x50;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

@Injectable()
export class ChannelSubscriptionNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async queueDue(now = new Date()) {
    const where = {
      autoRenew: false,
      status: { in: ["CANCELED_AT_PERIOD_END", "EXPIRED"] as const },
      periodEnd: { gte: new Date(now.getTime() - NOTICE_LOOKBACK), lte: new Date(now.getTime() + NOTICE_LEAD) },
      payments: { none: { status: "PENDING" as const } },
    };
    let cursor: string | undefined;
    let queued = 0;
    while (true) {
      const rows = await this.prisma.channelSubscription.findMany({
        where: { ...where, status: { in: [...where.status.in] } },
        select: { id: true, periodEnd: true, user: { select: { telegramId: true } } },
        orderBy: { id: "asc" },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      const data = rows.flatMap((sub) => {
        if (!sub.periodEnd) return [];
        const periodEnd = sub.periodEnd.toISOString();
        const kind: NoticeKind = sub.periodEnd > now ? "CHANNEL_SUBSCRIPTION_EXPIRING" : "CHANNEL_SUBSCRIPTION_EXPIRED";
        return [{ id: noticeId(sub.id, periodEnd, kind), telegramId: sub.user.telegramId, type: kind, payload: { subscriptionId: sub.id, periodEnd } }];
      });
      if (data.length) {
        const result = await this.prisma.botOutbox.createMany({ data, skipDuplicates: true });
        queued += result.count;
      }
      if (rows.length < 200) break;
      cursor = rows[rows.length - 1]!.id;
    }
    return { queued };
  }
}

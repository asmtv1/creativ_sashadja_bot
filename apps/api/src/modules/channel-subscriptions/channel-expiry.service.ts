import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelTelegramMembersService, type ChannelMember } from "./channel-telegram-members.service";

const details = {
  user: true,
  product: true,
  membership: true,
  removalTask: true,
  invites: { where: { revokedAt: null }, select: { expiresAt: true } },
  payments: { where: { status: { in: ["SUCCEEDED", "PENDING"] } }, select: { status: true, kind: true } },
} as const satisfies Prisma.ChannelSubscriptionInclude;
type Candidate = Prisma.ChannelSubscriptionGetPayload<{ include: typeof details }>;
type Decision = "REMOVE" | "SKIP";
type Finding = {
  telegramId: string;
  username: string | null;
  name: string | null;
  subscriptionId: string;
  source: string | null;
  periodEnd: string | null;
  graceUntil: string | null;
  decision: Decision;
  reason: string;
  telegramStatus: ChannelMember["status"] | null;
  lastError: string | null;
  removalStatus: string | null;
};
const RETRY_MS = 15 * 60_000;
const SKIP_MS = 24 * 60 * 60_000;

export function assessExpiry(sub: Candidate, now: Date): { decision: Decision; reason: string; graceUntil: Date | null; nextAttemptAt: Date } {
  const manual = sub.membership?.source === "MANUAL";
  const graceUntil = sub.periodEnd
    ? new Date(sub.periodEnd.getTime() + (manual ? 0 : Math.max(0, sub.product.gracePeriodMinutes)) * 60_000)
    : null;
  const skip = (reason: string, nextAttemptAt = new Date(now.getTime() + SKIP_MS)) => ({ decision: "SKIP" as const, reason, graceUntil, nextAttemptAt });
  if (sub.membership?.source === "EXEMPT") return skip("EXEMPT");
  if (sub.removalTask?.status === "REMOVED") return skip("ALREADY_REMOVED");
  if (sub.membership?.removedAt) return skip("MEMBERSHIP_ALREADY_REMOVED");
  if (!sub.product.telegramChatId) return skip("CHANNEL_NOT_BOUND");
  if (!sub.periodEnd || !graceUntil) return skip("NO_EXPIRY");
  if (sub.periodEnd > now) return skip("ACCESS_ACTIVE", sub.periodEnd);
  if (graceUntil > now) return skip("GRACE_PERIOD", graceUntil);
  if (!manual && !sub.payments.some((p) => p.status === "SUCCEEDED")) return skip("NO_CONFIRMED_PAYMENT");
  if (sub.payments.some((p) => p.status === "PENDING")) return skip("PAYMENT_PENDING", new Date(now.getTime() + RETRY_MS));
  // Do not remove while an unrevoked, unexpired invite could let the user back in.
  const liveInvites = sub.invites.filter((invite) => invite.expiresAt > now);
  if (liveInvites.length) return skip("INVITE_STILL_ACTIVE", new Date(Math.max(now.getTime() + RETRY_MS, Math.min(...liveInvites.map((invite) => invite.expiresAt.getTime())))));
  return { decision: "REMOVE", reason: "ACCESS_EXPIRED", graceUntil, nextAttemptAt: now };
}

@Injectable()
export class ChannelExpiryService {
  private readonly logger = new Logger(ChannelExpiryService.name);
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly telegram: ChannelTelegramMembersService) {}

  // Read-only preview; no mutation of tasks, membership, or Telegram state.
  async preview({ limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}, now = new Date()) {
    const take = Number.isFinite(limit) ? Math.min(Math.max(1, Math.trunc(limit)), 100) : 20;
    const skip = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
    const where: Prisma.ChannelSubscriptionWhereInput = { periodEnd: { lte: now } };
    const [total, subscriptions] = await Promise.all([
      this.prisma.channelSubscription.count({ where }),
      this.prisma.channelSubscription.findMany({ where, include: details, orderBy: [{ periodEnd: "asc" }, { id: "asc" }], skip, take }),
    ]);
    const renderFinding = async (subscription: Candidate): Promise<Finding> => {
      const assessed = assessExpiry(subscription, now);
      let decision = assessed.decision;
      let reason = assessed.reason;
      let telegramStatus: ChannelMember["status"] | null = null;
      if (decision === "REMOVE") {
        try {
          const member = await this.telegram.getMember(subscription.product.telegramChatId!, subscription.user.telegramId);
          telegramStatus = member.status;
          if (member.status === "creator" || member.status === "administrator") {
            decision = "SKIP"; reason = "CHANNEL_ADMIN";
          } else if (member.status === "left" || (member.status === "restricted" && member.is_member === false)) {
            decision = "SKIP"; reason = "NOT_A_MEMBER";
          }
        } catch {
          decision = "SKIP"; reason = "TELEGRAM_CHECK_FAILED";
        }
      }
      return {
        telegramId: subscription.user.telegramId,
        username: subscription.user.username,
        name: [subscription.user.firstName, subscription.user.lastName].filter(Boolean).join(" ") || null,
        subscriptionId: subscription.id,
        source: subscription.membership?.source ?? null,
        periodEnd: subscription.periodEnd?.toISOString() ?? null,
        graceUntil: assessed.graceUntil?.toISOString() ?? null,
        decision, reason, telegramStatus,
        lastError: subscription.removalTask?.lastError ?? null,
        removalStatus: subscription.removalTask?.status ?? null,
      };
    };
    // Bound Telegram lookups to avoid rate-limit spikes while keeping preview responsive.
    const rows: Finding[] = [];
    for (let i = 0; i < subscriptions.length; i += 5) {
      rows.push(...await Promise.all(subscriptions.slice(i, i + 5).map(renderFinding)));
    }
    return {
      mode: "DRY_RUN" as const,
      enabled: process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED === "true",
      generatedAt: now.toISOString(), total, offset: skip, returned: rows.length,
      hasMore: skip + rows.length < total,
      counts: { remove: rows.filter((row) => row.decision === "REMOVE").length, skip: rows.filter((row) => row.decision === "SKIP").length },
      rows,
    };
  }

  async runOnce(now = new Date()) {
    // Fail closed even if someone accidentally calls this directly.
    if (process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED !== "true" || this.running) return { scanned: 0, disabled: true };
    this.running = true;
    try {
      const subscriptions = await this.prisma.channelSubscription.findMany({
        where: {
          periodEnd: { lte: now },
          OR: [
            { removalTask: { is: null } },
            { removalTask: { is: { status: { not: "REMOVED" }, nextAttemptAt: { lte: now } } } },
          ],
        },
        orderBy: [{ periodEnd: "asc" }, { id: "asc" }],
        select: { id: true },
        take: 25,
      });
      for (const sub of subscriptions) {
        try { await this.processOne(sub.id); }
        catch (error) { this.logger.warn(`Channel expiry cleanup retry scheduled for ${sub.id}: ${error instanceof Error ? error.name : "unknown"}`); }
      }
      return { scanned: subscriptions.length, disabled: false };
    } finally { this.running = false; }
  }

  async processOne(subscriptionId: string): Promise<"REMOVED" | "SKIPPED" | "BUSY"> {
    if (process.env.CHANNEL_EXPIRY_ENFORCEMENT_ENABLED !== "true") return "SKIPPED";
    try {
      // The payment webhook uses the same channel-payment advisory lock.
      // Keep it for the second access check and the Telegram operation: a
      // concurrent confirmed renewal cannot change the expiry mid-removal.
      return await this.prisma.$transaction(async (tx) => {
        const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext(${`channel-payment:${subscriptionId}`})) AS locked`;
        if (!lock[0]?.locked) return "BUSY" as const;
        const sub = await tx.channelSubscription.findUnique({ where: { id: subscriptionId }, include: details });
        if (!sub) return "SKIPPED" as const;
        const now = new Date();
        const assessment = assessExpiry(sub, now);
        const save = async (status: "SKIPPED" | "REMOVED", reason: string, nextAttemptAt: Date) => {
          await tx.channelRemovalTask.upsert({
            where: { subscriptionId },
            create: { subscriptionId, status, lastCheckedAt: now, lastReason: reason, nextAttemptAt, removedAt: status === "REMOVED" ? now : null },
            update: { status, lastCheckedAt: now, lastReason: reason, lastError: null, nextAttemptAt, removedAt: status === "REMOVED" ? now : null },
          });
        };
        if (assessment.decision !== "REMOVE") {
          if (assessment.reason !== "ALREADY_REMOVED") await save("SKIPPED", assessment.reason, assessment.nextAttemptAt);
          return "SKIPPED" as const;
        }
        const chatId = sub.product.telegramChatId!;
        const telegramId = sub.user.telegramId;
        const member = await this.telegram.getMember(chatId, telegramId);
        if (member.status === "creator" || member.status === "administrator") {
          await save("SKIPPED", "CHANNEL_ADMIN", new Date(now.getTime() + SKIP_MS));
          return "SKIPPED" as const;
        }
        if (member.status === "left" || (member.status === "restricted" && member.is_member === false)) {
          await save("SKIPPED", "NOT_A_MEMBER", new Date(now.getTime() + SKIP_MS));
          return "SKIPPED" as const;
        }
        const result = await this.telegram.removeAndConfirm(chatId, telegramId, member);
        if (result === "ALREADY_LEFT") {
          await save("SKIPPED", "NOT_A_MEMBER", new Date(now.getTime() + SKIP_MS));
          return "SKIPPED" as const;
        }
        await tx.channelMembership.upsert({
          where: { subscriptionId },
          create: { subscriptionId, source: "MANAGED", removedAt: new Date() },
          update: { removedAt: new Date() },
        });
        await save("REMOVED", "TELEGRAM_CONFIRMED", now);
        return "REMOVED" as const;
      }, { timeout: 60_000, maxWait: 2_000 });
    } catch (error) {
      // The external outcome may be ambiguous (e.g. ban succeeded but unban
      // failed). Do not mark removed; next retry inspects Telegram again.
      await this.recordFailure(subscriptionId, error);
      throw error;
    }
  }

  private async recordFailure(subscriptionId: string, error: unknown) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtext(${`channel-payment:${subscriptionId}`})) AS locked`;
        if (!lock[0]?.locked) return;
        const existing = await tx.channelRemovalTask.findUnique({ where: { subscriptionId } });
        if (existing?.status === "REMOVED") return;
        const attempts = (existing?.attempts ?? 0) + 1;
        const now = new Date();
        const minutes = Math.min(15 * 2 ** Math.min(attempts - 1, 5), 480);
        const lastError = (error instanceof Error ? error.message : "Unknown Telegram cleanup error")
          .replace(/bot\d+:[^\s/]+/gi, "bot[redacted]").slice(0, 500);
        await tx.channelRemovalTask.upsert({
          where: { subscriptionId },
          create: { subscriptionId, status: "RETRY", attempts, lastReason: "TELEGRAM_FAILURE", lastError, lastCheckedAt: now, nextAttemptAt: new Date(now.getTime() + minutes * 60_000) },
          update: { status: "RETRY", attempts, lastReason: "TELEGRAM_FAILURE", lastError, lastCheckedAt: now, nextAttemptAt: new Date(now.getTime() + minutes * 60_000) },
        });
      });
    } catch { this.logger.error(`Unable to persist channel cleanup failure for ${subscriptionId}`); }
  }
}

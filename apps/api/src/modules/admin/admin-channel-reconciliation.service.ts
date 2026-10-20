import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelTelegramMembersService } from "../channel-subscriptions/channel-telegram-members.service";
import type { ChannelMember } from "../channel-subscriptions/channel-telegram-members.service";

const CHANNEL_PRODUCT_SLUG = "creative-ideas";
const currentStatuses = new Set(["ACTIVE", "PAST_DUE", "CANCELED_AT_PERIOD_END"]);

type Category =
  | "CHANNEL_ADMIN" | "EXEMPT" | "MANUAL" | "PAID"
  | "GRACE_PERIOD" | "PAYMENT_PENDING" | "ACTIVE_WITHOUT_PAYMENT"
  | "EXPIRED_MANUAL" | "EXPIRED_PAID" | "NO_TRACKED_ENTITLEMENT";

export function isPresent(member: ChannelMember) {
  return !(["left", "kicked"].includes(member.status) || (member.status === "restricted" && member.is_member === false));
}

export function entitlementCategory(sub: {
  status: string;
  periodEnd: Date | null;
  membership: { source: string; removedAt?: Date | null } | null;
  payments: Array<{ status: string }>;
  product?: { gracePeriodMinutes: number };
}, now: Date, member: ChannelMember): Category {
  if (member.status === "creator" || member.status === "administrator") return "CHANNEL_ADMIN";
  if (sub.membership?.source === "EXEMPT") return "EXEMPT";
  const manual = sub.membership?.source === "MANUAL";
  const active = Boolean(sub.periodEnd && sub.periodEnd > now && currentStatuses.has(sub.status));
  if (active) {
    if (manual) return "MANUAL";
    if (sub.payments.some((payment) => payment.status === "SUCCEEDED")) return "PAID";
    return "ACTIVE_WITHOUT_PAYMENT";
  }
  if (sub.periodEnd && sub.periodEnd <= now && !manual) {
    if (sub.payments.some((payment) => payment.status === "PENDING")) return "PAYMENT_PENDING";
    if (sub.payments.some((payment) => payment.status === "SUCCEEDED") &&
      sub.periodEnd.getTime() + (sub.product?.gracePeriodMinutes ?? 0) * 60_000 > now.getTime()) return "GRACE_PERIOD";
  }
  if (manual) return "EXPIRED_MANUAL";
  if (sub.payments.some((payment) => payment.status === "SUCCEEDED")) return "EXPIRED_PAID";
  return "NO_TRACKED_ENTITLEMENT";
}

@Injectable()
export class AdminChannelReconciliationService {
  constructor(private readonly prisma: PrismaService, private readonly telegram: ChannelTelegramMembersService) {}

  /** No Telegram mutations. Telegram Bot API cannot enumerate the channel's entire roster. */
  async report() {
    const product = await this.prisma.channelProduct.findUniqueOrThrow({ where: { slug: CHANNEL_PRODUCT_SLUG } });
    if (!product.telegramChatId) throw new Error("Channel is not bound to bot");
    const chatId = product.telegramChatId;
    const now = new Date();
    const [telegramMemberCount, administrators, subscriptions] = await Promise.all([
      this.telegram.getMemberCount(chatId),
      this.telegram.getAdministrators(chatId),
      this.prisma.channelSubscription.findMany({ where: { productId: product.id }, select: {
        status: true, periodEnd: true,
        user: { select: { telegramId: true, username: true, firstName: true, lastName: true } },
        membership: { select: { source: true, removedAt: true } },
        removalTask: { select: { status: true } },
        payments: { select: { status: true } },
      } }),
    ]);
    const admins = new Set(administrators.map((admin) => String(admin.user.id)));
    const trackedIds = new Set(subscriptions.map((sub) => sub.user.telegramId));
    const untrackedAdmins = [...admins].filter((id) => !trackedIds.has(id)).length;
    const categoryCounts: Record<Category, number> = {
      CHANNEL_ADMIN: 0, EXEMPT: 0, MANUAL: 0, PAID: 0,
      GRACE_PERIOD: 0, PAYMENT_PENDING: 0, ACTIVE_WITHOUT_PAYMENT: 0,
      EXPIRED_MANUAL: 0, EXPIRED_PAID: 0, NO_TRACKED_ENTITLEMENT: 0,
    };
    const flagged: Array<{ telegramId: string; username: string | null; name: string | null; reason: Category }> = [];
    let trackedPresent = 0;
    let trackedAbsent = 0;
    let telegramErrors = 0;
    let activeManualRecords = 0;
    let activePaidRecords = 0;
    let activeUnpaidRecords = 0;
    let activeManualAndPaidRecords = 0;
    let trackedPresentAdmin = 0;
    const classify = (sub: typeof subscriptions[number], member: ChannelMember) => {
      if (!isPresent(member)) { trackedAbsent++; return; }
      trackedPresent++;
      const category = entitlementCategory({ ...sub, product }, now, member);
      categoryCounts[category]++;
      if (category === "CHANNEL_ADMIN") trackedPresentAdmin++;
      if (["EXPIRED_MANUAL", "EXPIRED_PAID", "NO_TRACKED_ENTITLEMENT"].includes(category)) {
        flagged.push({
          telegramId: sub.user.telegramId, username: sub.user.username,
          name: [sub.user.firstName, sub.user.lastName].filter(Boolean).join(" ") || null,
          reason: category,
        });
      }
    };
    for (const sub of subscriptions) {
      const valid = Boolean(sub.periodEnd && sub.periodEnd > now && currentStatuses.has(sub.status));
      if (!valid) continue;
      const manual = sub.membership?.source === "MANUAL";
      const paid = sub.payments.some((payment) => payment.status === "SUCCEEDED");
      if (manual) activeManualRecords++;
      if (paid) activePaidRecords++;
      if (manual && paid) activeManualAndPaidRecords++;
      if (!manual && !paid) activeUnpaidRecords++;
    }
    // Limit concurrent Telegram API calls to avoid rate-limit spikes.
    for (let i = 0; i < subscriptions.length; i += 5) {
      await Promise.all(subscriptions.slice(i, i + 5).map(async (sub) => {
        try { classify(sub, await this.telegram.getMember(chatId, sub.user.telegramId)); }
        catch { telegramErrors++; }
      }));
    }
    const attributedMembers = trackedPresent + untrackedAdmins;
    const unknownMax = Math.max(0, telegramMemberCount - attributedMembers);
    const unknownMin = Math.max(0, unknownMax - telegramErrors);
    return {
      checkedAt: now.toISOString(), channel: product.title, telegramMemberCount,
      subscriptionRecords: subscriptions.length,
      activeRecordBreakdown: {
        totalActive: activeManualRecords + activePaidRecords - activeManualAndPaidRecords + activeUnpaidRecords,
        manual: activeManualRecords,
        everPaid: activePaidRecords,
        bothManualAndPaid: activeManualAndPaidRecords,
        neitherManualNorPaid: activeUnpaidRecords,
      },
      telegramAdministrators: admins.size,
      administratorsWithoutSubscription: untrackedAdmins,
      trackedPresent, trackedAbsent, trackedPresentAdmin, telegramCheckErrors: telegramErrors,
      membersByEntitlement: categoryCounts,
      unexplainedMembers: { minimum: unknownMin, maximum: unknownMax, exact: telegramErrors === 0 },
      flaggedTrackedMembers: flagged,
      readOnly: true,
      limitation: "Telegram Bot API does not provide a complete member list. Unexplained members may include manually invited people whose IDs were never recorded; no unidentified user has been removed.",
    };
  }
}

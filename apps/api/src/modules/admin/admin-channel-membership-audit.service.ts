import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelTelegramMembersService } from "../channel-subscriptions/channel-telegram-members.service";

const CHANNEL_PRODUCT_SLUG = "creative-ideas";

@Injectable()
export class AdminChannelMembershipAuditService {
  constructor(private readonly prisma: PrismaService, private readonly telegram: ChannelTelegramMembersService) {}

  // Read-only reconciliation. Telegram does not expose a complete roster of
  // private channel members via Bot API, so never guess unidentified members.
  async report() {
    const product = await this.prisma.channelProduct.findUniqueOrThrow({ where: { slug: CHANNEL_PRODUCT_SLUG } });
    if (!product.telegramChatId) throw new Error("Channel is not bound to bot");
    const now = new Date();
    const [telegramMemberCount, trackedSubscriptions, activeSubscriptions, exemptSubscriptions, confirmedRemovals, removed] = await Promise.all([
      this.telegram.getMemberCount(product.telegramChatId),
      this.prisma.channelSubscription.count({ where: { productId: product.id } }),
      this.prisma.channelSubscription.count({ where: {
        productId: product.id,
        periodEnd: { gt: now },
        status: { in: ["ACTIVE", "PAST_DUE", "CANCELED_AT_PERIOD_END"] },
      } }),
      this.prisma.channelSubscription.count({ where: { productId: product.id, membership: { is: { source: "EXEMPT" } } } }),
      this.prisma.channelRemovalTask.count({ where: { status: "REMOVED", subscription: { productId: product.id } } }),
      this.prisma.channelRemovalTask.findMany({
        where: { status: "REMOVED", subscription: { productId: product.id } },
        select: { subscription: { select: { user: { select: { telegramId: true } } } } },
        take: 500,
      }),
    ]);
    const verified = { absent: 0, stillPresent: 0, checkFailed: 0 };
    // Live checks, but no bans. A row previously marked REMOVED can be
    // cross-checked against Telegram independently of the local task state.
    for (let i = 0; i < removed.length; i += 5) {
      await Promise.all(removed.slice(i, i + 5).map(async (row) => {
        try {
          const member = await this.telegram.getMember(product.telegramChatId!, row.subscription.user.telegramId);
          if (["left", "kicked"].includes(member.status) || (member.status === "restricted" && member.is_member === false)) {
            verified.absent++;
          } else {
            verified.stillPresent++;
          }
        } catch {
          verified.checkFailed++;
        }
      }));
    }
    return {
      checkedAt: now.toISOString(),
      channel: product.title,
      telegramMemberCount,
      trackedSubscriptions,
      activeSubscriptions,
      exemptSubscriptions,
      confirmedRemovals,
      verifiedRemoved: verified,
      verifiedRemovedCoversAll: removed.length === confirmedRemovals,
      note: "Telegram count includes all channel members; subscriptions are not a complete membership roster. No action performed.",
    };
  }
}

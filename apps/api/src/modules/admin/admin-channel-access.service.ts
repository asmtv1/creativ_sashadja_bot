import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ChannelTelegramMembersService } from "../channel-subscriptions/channel-telegram-members.service";

const CHANNEL_PRODUCT_SLUG = "creative-ideas";

@Injectable()
export class AdminChannelAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegram: ChannelTelegramMembersService,
  ) {}

  async grant(telegramId: string, actor: string) {
    const [user, product] = await Promise.all([
      this.prisma.telegramUser.findUnique({ where: { telegramId } }),
      this.prisma.channelProduct.findUnique({
        where: { slug: CHANNEL_PRODUCT_SLUG },
      }),
    ]);
    if (!user) throw new NotFoundException("Telegram user not found");
    if (!product) throw new NotFoundException("Channel product not found");
    if (!product.telegramChatId) {
      throw new ServiceUnavailableException(
        "Channel is not bound to the bot yet",
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 86_400_000);
    const subscription = await this.prisma.$transaction(async (tx) => {
      // A manual extension must serialize with webhook payment and expiry removal.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel-payment:${user.id}:${product.id}`}))::text`;
      const subscription = await tx.channelSubscription.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } }, include: { membership: true } });
      if (subscription?.membership?.source === "EXEMPT") throw new ForbiddenException("EXEMPT channel member is protected");
      if (subscription) {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel-payment:${subscription.id}`}))::text`;
      }
      const updated = await tx.channelSubscription.upsert({
        where: { userId_productId: { userId: user.id, productId: product.id } },
        update: {
          status: "ACTIVE", autoRenew: false, paymentMethodId: null,
          periodStart: now, periodEnd: new Date(now.getTime() + product.periodDays * 86_400_000),
          nextChargeAt: null, nextAttemptAt: null, attemptCount: 0, cancelRequestedAt: null,
        },
        create: {
          userId: user.id, productId: product.id, status: "ACTIVE", autoRenew: false,
          periodStart: now, periodEnd: new Date(now.getTime() + product.periodDays * 86_400_000),
        },
      });
      await tx.channelRemovalTask.updateMany({ where: { subscriptionId: updated.id }, data: {
        status: "PENDING", attempts: 0, lastError: null, lastReason: "MANUAL_ACCESS_EXTENDED",
        removedAt: null, nextAttemptAt: new Date(now.getTime() + product.periodDays * 86_400_000),
      } });
      return updated;
    });

    const inviteLink = await this.createInviteLink(
      product.telegramChatId,
      expiresAt,
    );
    try {
      await this.sendInvite(telegramId, product.title, inviteLink);
    } catch (error) {
      await this.revokeInviteLink(product.telegramChatId, inviteLink).catch(
        () => undefined,
      );
      throw error;
    }

    await this.prisma.$transaction([
      this.prisma.channelInvite.create({
        data: { subscriptionId: subscription.id, inviteLink, expiresAt },
      }),
      this.prisma.channelMembership.upsert({
        where: { subscriptionId: subscription.id },
        update: { source: "MANUAL", removedAt: null },
        create: { subscriptionId: subscription.id, source: "MANUAL" },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          action: "CHANNEL_ACCESS_GRANT",
          actor,
          targetUserId: user.id,
          metadata: { telegramId, productSlug: product.slug },
        },
      }),
    ]);

    return { inviteLink, expiresAt: expiresAt.toISOString() };
  }

  async revoke(telegramId: string, actor: string) {
    const initial = await this.prisma.channelSubscription.findFirst({
      where: { user: { telegramId }, product: { slug: CHANNEL_PRODUCT_SLUG } },
      select: { id: true },
    });
    if (!initial) throw new NotFoundException("Channel subscription not found");

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel-payment:${initial.id}`}))::text`;
      const subscription = await tx.channelSubscription.findUniqueOrThrow({
        where: { id: initial.id },
        include: { user: true, product: true, membership: true, invites: { where: { revokedAt: null } } },
      });
      if (subscription.membership?.source === "EXEMPT") {
        throw new ForbiddenException("EXEMPT channel member is protected");
      }
      const chatId = subscription.product.telegramChatId;
      if (!chatId) throw new ServiceUnavailableException("Channel is not bound to the bot yet");
      const member = await this.telegram.getMember(chatId, subscription.user.telegramId);
      if (member.status === "creator" || member.status === "administrator") {
        throw new ForbiddenException("Cannot remove channel owner or administrator");
      }
      // Do not swallow Telegram errors or claim success before it was confirmed.
      for (const invite of subscription.invites) {
        await this.telegram.revokeInvite(chatId, invite.inviteLink);
      }
      await this.telegram.removeAndConfirm(chatId, subscription.user.telegramId, member);
      const now = new Date();
      await tx.channelSubscription.update({
        where: { id: subscription.id },
        data: {
          status: "EXPIRED", autoRenew: false, paymentMethodId: null,
          periodEnd: now, nextChargeAt: null, nextAttemptAt: null, cancelRequestedAt: now,
        },
      });
      await tx.channelInvite.updateMany({
        where: { subscriptionId: subscription.id, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.channelMembership.upsert({
        where: { subscriptionId: subscription.id },
        update: { removedAt: now },
        create: { subscriptionId: subscription.id, source: "MANUAL", removedAt: now },
      });
      await tx.channelRemovalTask.upsert({
        where: { subscriptionId: subscription.id },
        create: { subscriptionId: subscription.id, status: "REMOVED", removedAt: now, lastCheckedAt: now, lastReason: "MANUALLY_REVOKED" },
        update: { status: "REMOVED", removedAt: now, lastCheckedAt: now, lastReason: "MANUALLY_REVOKED", lastError: null },
      });
      await tx.adminAuditLog.create({
        data: { action: "CHANNEL_ACCESS_REVOKE", actor, targetUserId: subscription.userId,
          metadata: { telegramId, productSlug: subscription.product.slug } },
      });
    }, { timeout: 60_000 });
  }

  private async createInviteLink(chatId: string, expiresAt: Date) {
    const payload = await this.telegramRequest<{ invite_link?: string }>(
      "createChatInviteLink",
      {
        chat_id: chatId,
        expire_date: Math.floor(expiresAt.getTime() / 1000),
        member_limit: 1,
        name: "Ручной доступ",
      },
    );
    if (!payload.invite_link)
      throw new ServiceUnavailableException(
        "Telegram did not return an invite link",
      );
    return payload.invite_link;
  }

  private async sendInvite(
    telegramId: string,
    title: string,
    inviteLink: string,
  ) {
    await this.telegramRequest("sendMessage", {
      chat_id: telegramId,
      text: `Вам выдан доступ к каналу «${title}». Вступите по одноразовой ссылке: ${inviteLink}`,
      disable_web_page_preview: true,
    });
  }

  private async revokeInviteLink(chatId: string, inviteLink: string) {
    await this.telegramRequest("revokeChatInviteLink", {
      chat_id: chatId,
      invite_link: inviteLink,
    });
  }

  private async telegramRequest<T = unknown>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!token)
      throw new ServiceUnavailableException("Telegram bot is not configured");
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        "Telegram is temporarily unavailable",
      );
    }
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      description?: string;
    };
    if (!response.ok || !payload.ok) {
      throw new ServiceUnavailableException(
        payload.description ?? "Telegram access operation failed",
      );
    }
    return payload.result as T;
  }
}

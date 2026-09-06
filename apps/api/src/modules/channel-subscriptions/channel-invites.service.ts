import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ChannelInvitesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChannelInvitesService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.retryPending(), 60_000);
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async retryPending() {
    if (this.running) return;
    this.running = true;
    try {
      const payments = await this.prisma.channelPayment.findMany({
        where: {
          status: "SUCCEEDED", kind: "INITIAL",
          providerPaymentId: { not: null }, NOT: { providerPaymentId: { startsWith: "demo_" } },
          subscription: { status: { in: ["ACTIVE", "CANCELED_AT_PERIOD_END"] }, periodEnd: { gt: new Date() }, product: { telegramChatId: { not: null } } },
        },
        select: { id: true },
      });
      for (const payment of payments) {
        await this.queueInvite(payment.id).catch(() => this.logger.warn(`Invite retry failed for payment ${payment.id}`));
      }
    } catch { this.logger.error("Channel invite retry scan failed"); }
    finally { this.running = false; }
  }

  async queueInvite(paymentId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Serialize webhook and recovery workers; the outbox ID is also a unique payment key.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel-invite:${paymentId}`}))::text`;
      if (await tx.botOutbox.findUnique({ where: { id: paymentId } })) return;
      const payment = await tx.channelPayment.findUnique({ where: { id: paymentId }, include: { subscription: { include: { product: true, user: true } } } });
      if (!payment || payment.status !== "SUCCEEDED" || payment.kind !== "INITIAL") return;
      const sub = payment.subscription;
      if (!sub.periodEnd || sub.periodEnd <= new Date() || !["ACTIVE", "CANCELED_AT_PERIOD_END"].includes(sub.status)) return;
      if (!sub.product.telegramChatId) throw new ServiceUnavailableException("Channel is not bound to the bot yet");
      const expiresAt = new Date(Math.min(Date.now() + 7 * 86_400_000, sub.periodEnd.getTime()));
      const result = await this.telegramRequest("createChatInviteLink", {
        chat_id: sub.product.telegramChatId, member_limit: 1,
        expire_date: Math.floor(expiresAt.getTime() / 1000), name: "Оплаченная подписка",
      });
      const inviteLink = result.invite_link;
      if (typeof inviteLink !== "string") throw new ServiceUnavailableException("Telegram did not return an invite link");
      try {
        await tx.channelInvite.create({ data: { subscriptionId: sub.id, inviteLink, expiresAt } });
        await tx.botOutbox.create({ data: {
          id: payment.id, telegramId: sub.user.telegramId, type: "CHANNEL_INVITE",
          payload: { paymentId: payment.id, subscriptionId: sub.id, title: sub.product.title, inviteLink },
        } });
      } catch (error) {
        await this.telegramRequest("revokeChatInviteLink", { chat_id: sub.product.telegramChatId, invite_link: inviteLink }).catch(() => undefined);
        throw error;
      }
    }, { timeout: 30_000 });
  }

  private async telegramRequest(method: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new ServiceUnavailableException("Telegram bot is not configured");
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json() as { ok?: boolean; result?: Record<string, unknown> };
      if (!response.ok || !payload.ok || !payload.result) throw new Error("Telegram rejected invite operation");
      return payload.result;
    } catch { throw new ServiceUnavailableException("Telegram invite operation failed"); }
  }
}

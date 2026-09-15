import { ChannelInvitesService } from "./channel-invites.service";
import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { Prisma } from "@course/db";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { YooKassaClient, YooKassaPayment } from "../yookassa/yookassa.client";
import { NpdReceiptsService } from "../npd-receipts/npd-receipts.service";

const PRODUCT_SLUG = "creative-ideas";
const RETRY_OFFSETS_MINUTES = [0, 60, 240, 600, 1680]; // T-4h, T-3h, T, T+6h, T+24h

@Injectable()
export class ChannelSubscriptionsService {
  private readonly logger = new Logger(ChannelSubscriptionsService.name);
  constructor(private readonly prisma: PrismaService, private readonly users: UsersService, private readonly yookassa: YooKassaClient, private readonly npdReceipts: NpdReceiptsService, private readonly invites: ChannelInvitesService) {}

  async createCheckout(telegramId: string, termsAccepted: boolean) {
    if (!termsAccepted) throw new BadRequestException("Terms acceptance is required");
    const product = await this.productOrThrow();
    if (!product.telegramChatId) throw new ServiceUnavailableException("Channel is not bound to the bot yet");
    if (process.env.CHANNEL_SUBSCRIPTION_ENABLED !== "true" || !product.enabled) throw new ServiceUnavailableException("Channel subscription is not available yet");
    const user = await this.users.findByTelegramId(telegramId);
    if (!user) throw new NotFoundException("Telegram user not found");
    const subscription = await this.prisma.channelSubscription.upsert({
      where: { userId_productId: { userId: user.id, productId: product.id } },
      update: { termsVersion: process.env.CHANNEL_SUBSCRIPTION_TERMS_VERSION ?? "unpublished", termsAcceptedAt: new Date() },
      create: { userId: user.id, productId: product.id, termsVersion: process.env.CHANNEL_SUBSCRIPTION_TERMS_VERSION ?? "unpublished", termsAcceptedAt: new Date() }
    });
    const pending = await this.prisma.channelPayment.findFirst({ where: { subscriptionId: subscription.id, status: "PENDING", confirmationUrl: { not: null } }, orderBy: { createdAt: "desc" } });
    if (pending?.confirmationUrl) return this.status(subscription.id, pending.confirmationUrl);
    const payment = await this.prisma.channelPayment.create({ data: { subscriptionId: subscription.id, kind: "INITIAL", amountKopecks: product.priceKopecks, currency: product.currency, idempotenceKey: randomUUID() } });
    try {
      const remote = await this.yookassa.createSbpPayment({ idempotenceKey: payment.idempotenceKey, amountKopecks: payment.amountKopecks, currency: payment.currency, returnUrl: new URL("/start?channel_payment=checking", process.env.PUBLIC_BASE_URL).href, savePaymentMethod: true, metadata: { kind: "channel_subscription", paymentId: payment.id, subscriptionId: subscription.id, userId: user.id, productSlug: product.slug } });
      if (!remote.confirmation?.confirmation_url) throw new Error("Missing confirmation URL");
      await this.prisma.channelPayment.update({ where: { id: payment.id }, data: { providerPaymentId: remote.id, confirmationUrl: remote.confirmation.confirmation_url } });
      return this.status(subscription.id, remote.confirmation.confirmation_url);
    } catch (error) { await this.prisma.channelPayment.update({ where: { id: payment.id }, data: { status: "FAILED", failureCode: "PROVIDER_UNAVAILABLE" } }); throw error; }
  }

  async statusForTelegramId(telegramId: string) { const product = await this.productOrThrow(); const user = await this.users.findByTelegramId(telegramId); if (!user) return this.emptyStatus(product); const sub = await this.prisma.channelSubscription.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } }); return sub ? this.status(sub.id) : this.emptyStatus(product); }
  async stopAutoRenew(telegramId: string) {
    const sub = await this.subscriptionForTelegramId(telegramId);
    if (!sub.periodEnd || sub.status === "REFUNDED") {
      throw new BadRequestException("No active subscription");
    }
    const pendingRenewal = await this.prisma.channelPayment.findFirst({
      where: {
        subscriptionId: sub.id,
        kind: "RENEWAL",
        status: "PENDING",
        providerPaymentId: { not: null }
      },
      orderBy: { createdAt: "desc" }
    });

    await this.prisma.channelSubscription.update({
      where: { id: sub.id },
      data: {
        autoRenew: false,
        status: "CANCELED_AT_PERIOD_END",
        paymentMethodId: null,
        nextChargeAt: null,
        nextAttemptAt: null,
        cancelRequestedAt: new Date()
      }
    });

    if (pendingRenewal?.providerPaymentId) {
      try {
        const remote = await this.yookassa.cancelPayment(
          pendingRenewal.providerPaymentId,
          `cancel-renewal-${pendingRenewal.id}`
        );
        if (remote.status === "canceled") {
          await this.prisma.channelPayment.update({
            where: { id: pendingRenewal.id },
            data: {
              status: "CANCELED",
              failureCode: remote.cancellation_details?.reason ?? "CANCELED_BY_USER",
              providerPayload: remote as Prisma.InputJsonValue
            }
          });
        }
      } catch {
        // The subscription is already stopped locally. A later verified webhook
        // still honours a payment that YooKassa could not cancel in time.
      }
    }
    return this.status(sub.id);
  }
  async bindChannel(input: { secret: string; chatId: string; title?: string }) { if (!process.env.CHANNEL_BIND_SECRET || input.secret !== process.env.CHANNEL_BIND_SECRET) throw new ForbiddenException("Invalid channel binding"); const product = await this.productOrThrow(); if (product.telegramChatId && product.telegramChatId !== input.chatId) throw new ForbiddenException("Channel already bound"); return this.prisma.channelProduct.update({ where: { id: product.id }, data: { telegramChatId: input.chatId, telegramChatTitle: input.title ?? null } }); }

  async handleWebhook(providerPaymentId: string) {
    const payment = await this.prisma.channelPayment.findUnique({ where: { providerPaymentId }, include: { subscription: { include: { product: true } } } });
    if (!payment) return;
    const remote = await this.yookassa.getPayment(providerPaymentId); await this.applyRemotePayment(payment, remote);
  }

  async runRenewals(now = new Date()) {
    const due = await this.prisma.channelSubscription.findMany({ where: { autoRenew: true, status: { in: ["ACTIVE", "PAST_DUE"] }, OR: [{ nextChargeAt: { lte: now } }, { nextAttemptAt: { lte: now } }] }, include: { product: true } });
    for (const sub of due) await this.renewOne(sub.id, now);
  }

  async reconcilePendingInitialPayments(now = new Date()) {
    const payments = await this.prisma.channelPayment.findMany({
      where: {
        kind: "INITIAL",
        status: "PENDING",
        providerPaymentId: { not: null },
        updatedAt: { lte: new Date(now.getTime() - 5 * 60_000) },
      },
      include: { subscription: { include: { product: true } } },
      orderBy: { updatedAt: "asc" },
      take: 100,
    });
    for (const payment of payments) {
      try {
        await this.applyRemotePayment(
          payment,
          await this.yookassa.getPayment(payment.providerPaymentId!),
        );
      } catch (error) {
        this.logger.warn(
          `Unable to reconcile initial channel payment ${payment.id}: ${error instanceof Error ? error.name : "unknown"}`,
        );
      }
    }
  }

  private async renewOne(subscriptionId: string, now: Date) {
    const sub = await this.prisma.channelSubscription.findUnique({ where: { id: subscriptionId }, include: { product: true } });
    if (!sub?.autoRenew || !sub.paymentMethodId || !sub.periodEnd) return;
    const pending = await this.prisma.channelPayment.findFirst({ where: { subscriptionId, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    if (pending?.providerPaymentId) { await this.applyRemotePayment(pending as any, await this.yookassa.getPayment(pending.providerPaymentId)); return; }
    const payment = await this.prisma.channelPayment.create({ data: { subscriptionId, kind: "RENEWAL", amountKopecks: sub.product.priceKopecks, currency: sub.product.currency, idempotenceKey: randomUUID() } });
    try { const remote = await this.yookassa.createSavedMethodPayment({ idempotenceKey: payment.idempotenceKey, amountKopecks: payment.amountKopecks, currency: payment.currency, paymentMethodId: sub.paymentMethodId, metadata: { kind: "channel_subscription", paymentId: payment.id, subscriptionId, productSlug: sub.product.slug } }); await this.prisma.channelPayment.update({ where: { id: payment.id }, data: { providerPaymentId: remote.id } }); await this.applyRemotePayment({ ...payment, subscription: sub } as any, remote); }
    catch { await this.markAttemptFailed(sub, now, "PROVIDER_UNAVAILABLE"); }
  }

  private async applyRemotePayment(payment: any, remote: YooKassaPayment) {
    const sub = payment.subscription ?? await this.prisma.channelSubscription.findUniqueOrThrow({ where: { id: payment.subscriptionId }, include: { product: true } });
    if (remote.amount.value !== `${Math.floor(payment.amountKopecks / 100)}.${String(payment.amountKopecks % 100).padStart(2, "0")}` || remote.amount.currency !== payment.currency || remote.metadata?.kind !== "channel_subscription" || remote.metadata?.paymentId !== payment.id) throw new ForbiddenException("Payment verification failed");
    if (remote.status === "canceled") { await this.prisma.channelPayment.update({ where: { id: payment.id }, data: { status: "CANCELED", failureCode: remote.cancellation_details?.reason } }); if (sub.autoRenew) await this.markAttemptFailed(sub, new Date(), remote.cancellation_details?.reason ?? "CANCELED"); return; }
    if (remote.status !== "succeeded" || !remote.paid || remote.payment_method?.type !== "sbp" || !remote.payment_method?.id || !remote.payment_method.saved) return;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel-payment:${sub.id}`}))::text`;
      const currentPayment = await tx.channelPayment.findUniqueOrThrow({ where: { id: payment.id } });
      if (currentPayment.status === "SUCCEEDED" || currentPayment.status === "REFUNDED") return;
      const current = await tx.channelSubscription.findUniqueOrThrow({ where: { id: sub.id } });
      const start = payment.kind === "RENEWAL" && current.periodEnd && current.periodEnd > now ? current.periodEnd : now;
      const end = new Date(start.getTime() + sub.product.periodDays * 86_400_000);
      const retainAutoRenew = current.autoRenew && (payment.kind === "INITIAL" || Boolean(current.paymentMethodId));
      await tx.channelPayment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", paidAt: now, providerPayload: { status: remote.status } as Prisma.InputJsonValue } });
      await tx.channelSubscription.update({ where: { id: sub.id }, data: { status: retainAutoRenew ? "ACTIVE" : "CANCELED_AT_PERIOD_END", autoRenew: retainAutoRenew, paymentMethodId: retainAutoRenew ? remote.payment_method!.id : null, periodStart: start, periodEnd: end, nextChargeAt: retainAutoRenew ? new Date(end.getTime() - sub.product.renewalLeadMinutes * 60_000) : null, nextAttemptAt: null, attemptCount: 0 } });
    });
    // Delivery is recoverable independently of receipt processing and webhook retries.
    await this.invites.queueInvite(payment.id).catch(() => this.logger.warn(`Invite queued for retry: payment ${payment.id}`));
    const confirmed = await this.prisma.channelPayment.findUniqueOrThrow({ where: { id: payment.id } });
    if (confirmed.status !== "SUCCEEDED") return;
    const user = await this.prisma.telegramUser.findUnique({ where: { id: sub.userId }, select: { telegramId: true } });
    if (user) await this.npdReceipts.queueChannelReceipt({ paymentId: payment.id, userId: sub.userId, telegramId: user.telegramId, amountKopecks: payment.amountKopecks, currency: payment.currency, serviceName: sub.product.title, paidAt: confirmed.paidAt! });
  }

  private async markAttemptFailed(sub: any, now: Date, _failureCode: string) { const attempt = sub.attemptCount + 1; const end = sub.periodEnd ?? now; const final = attempt >= RETRY_OFFSETS_MINUTES.length || now >= new Date(end.getTime() + sub.product.gracePeriodMinutes * 60_000); const offset = RETRY_OFFSETS_MINUTES[Math.min(attempt, RETRY_OFFSETS_MINUTES.length - 1)] ?? 0; await this.prisma.channelSubscription.update({ where: { id: sub.id }, data: { status: final ? "EXPIRED" : "PAST_DUE", attemptCount: attempt, nextAttemptAt: final ? null : new Date(end.getTime() - sub.product.renewalLeadMinutes * 60_000 + offset * 60_000) } }); }
  private async productOrThrow() { const product = await this.prisma.channelProduct.findUnique({ where: { slug: process.env.CHANNEL_PRODUCT_SLUG ?? PRODUCT_SLUG } }); if (!product) throw new NotFoundException("Channel product not found"); return product; }
  private async subscriptionForTelegramId(telegramId: string) { const product = await this.productOrThrow(); const user = await this.users.findByTelegramId(telegramId); const sub = user ? await this.prisma.channelSubscription.findUnique({ where: { userId_productId: { userId: user.id, productId: product.id } } }) : null; if (!sub) throw new NotFoundException("Subscription not found"); return sub; }
  private async status(id: string, confirmationUrl?: string) { const sub = await this.prisma.channelSubscription.findUniqueOrThrow({ where: { id }, include: { product: true } }); return { status: sub.status, activeUntil: sub.periodEnd?.toISOString() ?? null, nextChargeAt: sub.nextChargeAt?.toISOString() ?? null, autoRenew: sub.autoRenew, amountKopecks: sub.product.priceKopecks, currency: sub.product.currency, ...(confirmationUrl ? { confirmationUrl } : {}) }; }
  private emptyStatus(product: { priceKopecks: number; currency: string }) { return { activeUntil: null, nextChargeAt: null, autoRenew: false, amountKopecks: product.priceKopecks, currency: product.currency }; }
}

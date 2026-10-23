import { describe, expect, it, vi } from "vitest";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

describe("ChannelSubscriptionsService stopAutoRenew", () => {
  it("creates checkout independently of receipt processing", async () => {
    const previousEnabled = process.env.CHANNEL_SUBSCRIPTION_ENABLED;
    const previousPublicBaseUrl = process.env.PUBLIC_BASE_URL;
    process.env.CHANNEL_SUBSCRIPTION_ENABLED = "true";
    process.env.PUBLIC_BASE_URL = "https://sasha.gafus.ru";
    const product = {
      id: "product_1",
      slug: "creative-ideas",
      title: "Креатив идеи",
      priceKopecks: 39000,
      currency: "RUB",
      periodDays: 30,
      renewalLeadMinutes: 240,
      telegramChatId: "-100123",
      enabled: true
    };
    const subscription = {
      id: "sub_1",
      productId: product.id,
      status: "PENDING",
      autoRenew: true,
      periodEnd: null,
      nextChargeAt: null,
      product
    };
    const prisma = {
      $queryRaw: vi.fn(async () => []),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      channelProduct: { findUnique: vi.fn(async () => product) },
      channelSubscription: {
        upsert: vi.fn(async () => subscription),
        findUniqueOrThrow: vi.fn(async () => subscription)
      },
      channelPayment: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: "payment_1",
          subscriptionId: subscription.id,
          amountKopecks: product.priceKopecks,
          currency: product.currency,
          idempotenceKey: "idempotence_1"
        })),
        update: vi.fn(async () => undefined)
      }
    };
    const service = new ChannelSubscriptionsService(
      prisma as any,
      { findByTelegramId: vi.fn(async () => ({ id: "user_1", telegramId: "42" })) } as any,
      {
        createSbpPayment: vi.fn(async () => ({
          id: "yookassa_payment_1",
          status: "pending",
          paid: false,
          amount: { value: "390.00", currency: "RUB" },
          confirmation: { confirmation_url: "https://yookassa.example/checkout" }
        }))
      } as any,
      { queueChannelReceipt: vi.fn() } as any,
      { queueInvite: vi.fn() } as any
    );

    try {
      const result = await service.createCheckout("42", true);
      expect(result).toMatchObject({ confirmationUrl: "https://yookassa.example/checkout" });
    } finally {
      if (previousEnabled === undefined) delete process.env.CHANNEL_SUBSCRIPTION_ENABLED;
      else process.env.CHANNEL_SUBSCRIPTION_ENABLED = previousEnabled;
      if (previousPublicBaseUrl === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = previousPublicBaseUrl;
    }
  });

  it("clears the saved payment method and cancels a pending renewal", async () => {
    const subscription = {
      id: "sub_1",
      productId: "product_1",
      periodEnd: new Date("2026-09-30T09:00:00.000Z"),
      status: "ACTIVE",
      autoRenew: true,
      paymentMethodId: "sbp_method_1"
    };
    const product = { id: "product_1", slug: "creative-ideas", priceKopecks: 39000, currency: "RUB" };
    const prisma = {
      channelProduct: { findUnique: vi.fn(async () => product) },
      channelSubscription: {
        findUnique: vi.fn(async () => subscription),
        findUniqueOrThrow: vi.fn(async () => ({ ...subscription, product })),
        update: vi.fn(async () => subscription)
      },
      channelPayment: {
        findFirst: vi.fn(async () => ({ id: "payment_1", providerPaymentId: "yookassa_payment_1" })),
        update: vi.fn(async () => undefined)
      }
    };
    const service = new ChannelSubscriptionsService(
      prisma as any,
      { findByTelegramId: vi.fn(async () => ({ id: "user_1" })) } as any,
      {
        cancelPayment: vi.fn(async () => ({
          id: "yookassa_payment_1",
          status: "canceled",
          paid: false,
          amount: { value: "390.00", currency: "RUB" },
          cancellation_details: { reason: "canceled_by_merchant" }
        }))
      } as any,
      { queueChannelReceipt: vi.fn() } as any,
      { queueInvite: vi.fn() } as any
    );

    await service.stopAutoRenew("42");

    expect(prisma.channelSubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          autoRenew: false,
          paymentMethodId: null,
          nextChargeAt: null,
          nextAttemptAt: null,
          status: "CANCELED_AT_PERIOD_END"
        })
      })
    );
    expect(prisma.channelPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELED" })
      })
    );
  });
});

describe("Channel payment callbacks", () => {
  it.each(["INITIAL", "RENEWAL"])("handles repeated %s cancellations once without corrupting paid access", async (kind) => {
    const subscription = {
      id: "sub", status: "ACTIVE", autoRenew: true, attemptCount: 0,
      periodEnd: new Date(Date.now() + 30 * 86_400_000),
      product: { renewalLeadMinutes: 240, gracePeriodMinutes: 1440 },
    };
    const payment = {
      id: "payment", subscriptionId: "sub", kind, status: "PENDING",
      createdAt: new Date(), amountKopecks: 39000, currency: "RUB", subscription,
    };
    const prisma = {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      channelPayment: {
        findUnique: vi.fn(async () => payment),
        findUniqueOrThrow: vi.fn(async () => payment),
        findFirst: vi.fn(async () => null),
        update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
      },
      channelSubscription: {
        findUniqueOrThrow: vi.fn(async () => subscription),
        update: vi.fn(async ({ data }: any) => Object.assign(subscription, data)),
      },
    };
    const remote = {
      status: "canceled", amount: { value: "390.00", currency: "RUB" },
      metadata: { kind: "channel_subscription", paymentId: "payment" },
      cancellation_details: { reason: "insufficient_funds" },
    };
    const service = new ChannelSubscriptionsService(prisma as any, {} as any, { getPayment: vi.fn(async () => remote) } as any, {} as any, {} as any);
    await service.handleWebhook("provider");
    await service.handleWebhook("provider");
    await service.handleWebhook("provider");
    expect(prisma.channelPayment.update).toHaveBeenCalledTimes(1);
    expect(subscription.autoRenew).toBe(true);
    expect(subscription.attemptCount).toBe(kind === "RENEWAL" ? 1 : 0);
    expect(subscription.status).toBe(kind === "RENEWAL" ? "PAST_DUE" : "ACTIVE");

    // A delayed cancellation must also leave a subsequently paid period alone.
    if (kind === "RENEWAL") {
      payment.status = "PENDING";
      subscription.status = "ACTIVE";
      subscription.attemptCount = 0;
      prisma.channelPayment.findFirst.mockResolvedValue({ id: "newer-paid" } as any);
      await service.handleWebhook("provider");
      expect(subscription.status).toBe("ACTIVE");
      expect(subscription.attemptCount).toBe(0);
    }
  });

  it("reconciles an abandoned initial payment to its YooKassa cancellation", async () => {
    const payment = {
      id: "payment",
      subscriptionId: "sub",
      kind: "INITIAL",
      status: "PENDING",
      amountKopecks: 39000,
      currency: "RUB",
      providerPaymentId: "provider",
      subscription: {
        id: "sub",
        autoRenew: false,
        product: { periodDays: 30 },
      },
    };
    const prisma = {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      channelPayment: {
        findUniqueOrThrow: vi.fn(async () => payment),
        findMany: vi.fn(async () => [payment]),
        update: vi.fn(async () => undefined),
      },
    };
    const service = new ChannelSubscriptionsService(
      prisma as any,
      {} as any,
      {
        getPayment: vi.fn(async () => ({
          id: "provider",
          status: "canceled",
          paid: false,
          amount: { value: "390.00", currency: "RUB" },
          metadata: { kind: "channel_subscription", paymentId: "payment" },
          cancellation_details: { reason: "expired_on_confirmation" },
        })),
      } as any,
      {} as any,
      {} as any,
    );

    await service.reconcilePendingInitialPayments(
      new Date("2026-09-15T10:00:00.000Z"),
    );

    expect(prisma.channelPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "INITIAL",
          status: "PENDING",
          providerPaymentId: { not: null },
        }),
      }),
    );
    expect(prisma.channelPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "payment" },
        data: expect.objectContaining({
          status: "CANCELED",
          failureCode: "expired_on_confirmation",
        }),
      }),
    );
  });

  it("does not extend the subscription again and retries delivery even when receipt processing fails", async () => {
    const paidAt = new Date("2026-09-01T00:00:00Z");
    const payment = {
      id: "payment", status: "SUCCEEDED", kind: "INITIAL", amountKopecks: 39000, currency: "RUB", paidAt,
      subscription: { id: "sub", userId: "user", product: { title: "Креатив идеи", periodDays: 30 } },
    };
    const tx = {
      $queryRaw: vi.fn(),
      channelPayment: { findUniqueOrThrow: vi.fn(async () => payment), update: vi.fn() },
      channelSubscription: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    };
    const prisma = {
      $transaction: vi.fn(async (fn) => fn(tx)),
      channelPayment: { findUnique: vi.fn(async () => payment), findUniqueOrThrow: vi.fn(async () => payment) },
      telegramUser: { findUnique: vi.fn(async () => ({ telegramId: "42" })) },
    };
    const invites = { queueInvite: vi.fn(async () => undefined) };
    const receipts = { queueChannelReceipt: vi.fn(async () => { throw new Error("receipt unavailable"); }) };
    const remote = { status: "succeeded", paid: true, amount: { value: "390.00", currency: "RUB" }, metadata: { kind: "channel_subscription", paymentId: "payment" }, payment_method: { type: "sbp", id: "method", saved: true } };
    const service = new ChannelSubscriptionsService(prisma as any, {} as any, { getPayment: vi.fn(async () => remote) } as any, receipts as any, invites as any);
    await expect(service.handleWebhook("provider")).rejects.toThrow("receipt unavailable");
    expect(tx.channelSubscription.update).not.toHaveBeenCalled();
    expect(tx.channelPayment.update).not.toHaveBeenCalled();
    expect(invites.queueInvite).toHaveBeenCalledWith("payment");
    expect(receipts.queueChannelReceipt).toHaveBeenCalledWith(expect.objectContaining({ paidAt }));
  });

  it("reactivates auto-renew and preserves prepaid days when a canceled subscriber buys again", async () => {
    const currentEnd = new Date(Date.now() + 5 * 86_400_000);
    const product = { periodDays: 30, renewalLeadMinutes: 240, title: "Креатив идеи" };
    const sub = { id: "sub", userId: "user", autoRenew: false, periodEnd: currentEnd, product };
    const payment = { id: "new-payment", subscriptionId: "sub", kind: "INITIAL", status: "PENDING", amountKopecks: 39000, currency: "RUB", subscription: sub };
    const prisma = {
      $queryRaw: vi.fn(),
      $transaction: vi.fn(async (fn: any) => fn(prisma)),
      channelPayment: {
        findUnique: vi.fn(async () => payment),
        findUniqueOrThrow: vi.fn(async () => payment),
        update: vi.fn(async ({ data }: any) => Object.assign(payment, data)),
      },
      channelSubscription: {
        findUniqueOrThrow: vi.fn(async () => ({ ...sub, membership: { removedAt: null }, removalTask: null })),
        update: vi.fn(async () => undefined),
      },
      channelRemovalTask: { updateMany: vi.fn(async () => ({ count: 0 })) },
      channelMembership: { updateMany: vi.fn(async () => ({ count: 1 })) },
      telegramUser: { findUnique: vi.fn(async () => ({ telegramId: "42" })) },
    };
    const remote = { status: "succeeded", paid: true, amount: { value: "390.00", currency: "RUB" },
      metadata: { kind: "channel_subscription", paymentId: "new-payment" }, payment_method: { type: "sbp", id: "saved-sbp", saved: true } };
    const receipts = { queueChannelReceipt: vi.fn(async () => undefined) };
    const invites = { queueInvite: vi.fn(async () => undefined) };
    const service = new ChannelSubscriptionsService(prisma as any, {} as any, { getPayment: vi.fn(async () => remote) } as any, receipts as any, invites as any);
    await service.handleWebhook("provider");
    expect(prisma.channelSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      periodStart: currentEnd,
      periodEnd: new Date(currentEnd.getTime() + 30 * 86_400_000),
      status: "ACTIVE", autoRenew: true, paymentMethodId: "saved-sbp",
    }) }));
    expect(invites.queueInvite).toHaveBeenCalledWith("new-payment");
  });

  it("refuses checkout when the channel has not been bound", async () => {
    const service = new ChannelSubscriptionsService({ channelProduct: { findUnique: vi.fn(async () => ({ telegramChatId: null })) } } as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.createCheckout("42", true)).rejects.toThrow("not bound");
  });
});

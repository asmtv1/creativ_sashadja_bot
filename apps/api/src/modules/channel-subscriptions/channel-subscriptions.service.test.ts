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

  it("refuses checkout when the channel has not been bound", async () => {
    const service = new ChannelSubscriptionsService({ channelProduct: { findUnique: vi.fn(async () => ({ telegramChatId: null })) } } as any, {} as any, {} as any, {} as any, {} as any);
    await expect(service.createCheckout("42", true)).rejects.toThrow("not bound");
  });
});

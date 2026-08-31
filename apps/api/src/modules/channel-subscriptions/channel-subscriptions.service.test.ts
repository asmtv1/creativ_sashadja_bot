import { describe, expect, it, vi } from "vitest";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

describe("ChannelSubscriptionsService stopAutoRenew", () => {
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
      } as any
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

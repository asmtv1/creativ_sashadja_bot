import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

const pendingOrder = {
  id: "order_1",
  userId: "user_1",
  courseId: "course_1",
  amountKopecks: 59900,
  currency: "RUB",
  status: "PENDING" as const,
  idempotenceKey: "idempotence-key",
  providerPaymentId: null,
  paymentUrl: null
};

function createPrisma() {
  return {
    telegramUser: {
      findUnique: vi.fn(async () => ({ id: "user_1", telegramId: "42" }))
    },
    course: {
      findUnique: vi.fn(async () => ({
        id: "course_1",
        slug: "basic-course",
        priceKopecks: 59900,
        currency: "RUB",
        isPublished: true
      }))
    },
    order: {
      create: vi.fn(async () => pendingOrder),
      findFirst: vi.fn(async (): Promise<any> => null),
      findUnique: vi.fn(async () => pendingOrder),
      findUniqueOrThrow: vi.fn(async () => ({ ...pendingOrder, status: "PAID" })),
      update: vi.fn(async () => ({ ...pendingOrder, status: "PAID" }))
    },
    payment: { upsert: vi.fn(async () => undefined) },
    courseAccess: { upsert: vi.fn(async () => undefined) },
    botOutbox: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => undefined)
    },
    $transaction: vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))
  };
}

const successfulRemotePayment = {
  id: "yookassa_payment_1",
  status: "succeeded" as const,
  paid: true,
  amount: { value: "599.00", currency: "RUB" },
  metadata: {
    kind: "course_order",
    orderId: "order_1",
    userId: "user_1",
    telegramId: "42"
  },
  payment_method: { type: "sbp" }
};

describe("OrdersService direct YooKassa SBP flow", () => {
  it("creates an SBP checkout instead of a Telegram invoice", async () => {
    const prisma = createPrisma();
    const yookassa = {
      createSbpPayment: vi.fn(async () => ({
        id: "yookassa_payment_1",
        confirmation: { confirmation_url: "https://yookassa.example/confirm" }
      }))
    };
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any,
      yookassa as any,
      { getOrThrow: () => "https://course.example" } as any
    );

    const result = await service.createCheckoutForTelegramUser("42", "basic-course");

    expect(result).toEqual({
      orderId: "order_1",
      paymentUrl: "https://yookassa.example/confirm"
    });
    expect(yookassa.createSbpPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amountKopecks: 59900,
        metadata: expect.objectContaining({ kind: "course_order", orderId: "order_1" })
      })
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerPaymentId: "yookassa_payment_1",
          paymentUrl: "https://yookassa.example/confirm"
        })
      })
    );
  });

  it("verifies the remote payment before granting course access and notifying the bot", async () => {
    const prisma = createPrisma();
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any,
      { getPayment: vi.fn(async () => successfulRemotePayment) } as any,
      { getOrThrow: () => "https://course.example" } as any
    );

    await service.handleWebhook("yookassa_payment_1");

    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "YOOKASSA",
          providerPaymentId: "yookassa_payment_1",
          status: "SUCCEEDED"
        })
      })
    );
    expect(prisma.courseAccess.upsert).toHaveBeenCalledOnce();
    expect(prisma.botOutbox.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ telegramId: "42", type: "PAYMENT_SUCCEEDED" })
      })
    );
  });

  it("refuses a completed course payment if YooKassa reports a non-SBP method", async () => {
    const prisma = createPrisma();
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any,
      {
        getPayment: vi.fn(async () => ({
          ...successfulRemotePayment,
          payment_method: { type: "bank_card" }
        }))
      } as any,
      { getOrThrow: () => "https://course.example" } as any
    );

    await expect(service.handleWebhook("yookassa_payment_1")).rejects.toThrow(
      "Payment verification failed"
    );
    expect(prisma.courseAccess.upsert).not.toHaveBeenCalled();
  });
});

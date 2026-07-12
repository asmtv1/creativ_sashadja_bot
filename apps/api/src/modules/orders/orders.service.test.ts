import { describe, expect, it, vi } from "vitest";
import { OrdersService } from "./orders.service";

function createPrisma() {
  const order = {
    id: "order_1",
    userId: "user_1",
    courseId: "course_1",
    amountKopecks: 59900,
    currency: "RUB",
    status: "PENDING",
    providerPaymentId: null,
    user: { telegramId: "42" }
  };

  return {
    telegramUser: {
      findUnique: vi.fn(async () => ({ id: "user_1", telegramId: "42" }))
    },
    course: {
      findUnique: vi.fn(async () => ({
        id: "course_1",
        slug: "basic-course",
        title: "Креативный контент | обучение",
        description: "Урок по геймификации в контенте",
        priceKopecks: 59900,
        currency: "RUB",
        isPublished: true
      }))
    },
    order: {
      create: vi.fn(async () => order),
      findFirst: vi.fn(async (): Promise<any> => null),
      findUnique: vi.fn(async () => order),
      update: vi.fn(async () => ({ ...order, status: "PAID" }))
    },
    payment: {
      upsert: vi.fn(async () => undefined)
    },
    courseAccess: {
      upsert: vi.fn(async () => undefined)
    },
    botOutbox: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => undefined)
    }
  };
}

describe("OrdersService Telegram invoice flow", () => {
  it("creates a pending order that can be paid through Telegram sendInvoice", async () => {
    const prisma = createPrisma();
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any
    );

    const result = await service.createOrderForTelegramUser("42", "basic-course");

    expect(prisma.order.create).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      orderId: "order_1",
      status: "PENDING",
      invoicePayload: "order_1",
      title: "Креативный контент | обучение",
      description: "Урок по геймификации в контенте",
      amountKopecks: 59900,
      currency: "RUB"
    });
  });

  it("reuses a matching pending order when checkout is prepared again", async () => {
    const prisma = createPrisma();
    prisma.order.findFirst.mockResolvedValueOnce({
      id: "order_existing",
      userId: "user_1",
      courseId: "course_1",
      amountKopecks: 59900,
      currency: "RUB",
      status: "PENDING",
      providerPaymentId: null,
      user: { telegramId: "42" }
    });
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any
    );

    const result = await service.createOrderForTelegramUser("42", "basic-course");

    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({ orderId: "order_existing", invoicePayload: "order_existing" });
  });

  it("marks a matching Telegram SuccessfulPayment as paid and grants access", async () => {
    const prisma = createPrisma();
    const service = new OrdersService(
      prisma as any,
      { hasAccess: vi.fn(async () => false) } as any
    );

    const result = await service.completeTelegramInvoicePayment({
      orderId: "order_1",
      telegramId: "42",
      providerPaymentChargeId: "ykassa_charge_1",
      telegramPaymentChargeId: "telegram_charge_1",
      amountKopecks: 59900,
      currency: "RUB",
      rawPayload: { invoice_payload: "order_1" }
    });

    expect(result).toEqual({ paid: true, status: "PAID" });
    expect(prisma.payment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          provider: "YOOKASSA",
          providerPaymentId: "ykassa_charge_1",
          status: "SUCCEEDED"
        })
      })
    );
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order_1" },
        data: expect.objectContaining({
          status: "PAID",
          providerPaymentId: "ykassa_charge_1"
        })
      })
    );
    expect(prisma.courseAccess.upsert).toHaveBeenCalled();
  });
});

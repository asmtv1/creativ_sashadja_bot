import { describe, expect, it } from "vitest";
import {
  BotCompleteTelegramPaymentRequestSchema,
  BotValidateTelegramInvoiceRequestSchema,
  BotUserUpsertRequestSchema,
  CreateInvoiceResponseSchema,
  CreateOrderResponseSchema,
  CreateOrderRequestSchema,
  TelegramAuthRequestSchema
} from "./index";

describe("shared API contracts", () => {
  it("accepts valid Mini App auth and order payloads", () => {
    expect(TelegramAuthRequestSchema.parse({ initData: "query=string" })).toEqual({
      initData: "query=string"
    });

    expect(CreateOrderRequestSchema.parse({ courseSlug: "course-basic" })).toEqual({
      courseSlug: "course-basic"
    });
  });

  it("accepts bot user upsert payloads with Telegram identifiers as strings", () => {
    const parsed = BotUserUpsertRequestSchema.parse({
      telegramId: "123456",
      username: "student",
      firstName: "Ivan",
      lastName: null,
      languageCode: "ru"
    });

    expect(parsed.telegramId).toBe("123456");
    expect(parsed.lastName).toBeNull();
  });

  it("accepts Telegram invoice order and payment payloads", () => {
    expect(
      CreateOrderResponseSchema.parse({
        orderId: "order_1",
        status: "PENDING",
        invoicePayload: "order_1",
        title: "Креативный контент | обучение",
        description: "Урок по геймификации в контенте",
        amountKopecks: 59900,
        currency: "RUB"
      })
    ).toMatchObject({ invoicePayload: "order_1", amountKopecks: 59900 });

    expect(
      CreateInvoiceResponseSchema.parse({
        orderId: "order_1",
        invoiceUrl: "https://t.me/$invoice"
      })
    ).toMatchObject({ orderId: "order_1" });

    expect(
      BotValidateTelegramInvoiceRequestSchema.parse({
        telegramId: "42",
        amountKopecks: 59900,
        currency: "RUB"
      })
    ).toMatchObject({ telegramId: "42" });

    expect(
      BotCompleteTelegramPaymentRequestSchema.parse({
        telegramId: "42",
        providerPaymentChargeId: "yookassa_charge_1",
        telegramPaymentChargeId: "telegram_charge_1",
        amountKopecks: 59900,
        currency: "RUB",
        rawPayload: { invoice_payload: "order_1" }
      })
    ).toMatchObject({ providerPaymentChargeId: "yookassa_charge_1" });
  });

  it("rejects malformed payloads before they reach application services", () => {
    expect(() => TelegramAuthRequestSchema.parse({ initData: "" })).toThrow();
    expect(() => CreateOrderRequestSchema.parse({ courseSlug: "" })).toThrow();
    expect(() => BotUserUpsertRequestSchema.parse({ telegramId: "" })).toThrow();
  });
});

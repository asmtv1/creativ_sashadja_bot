import { describe, expect, it } from "vitest";
import {
  BotCreateCourseCheckoutResponseSchema,
  BotUserUpsertRequestSchema,
  CreateCourseCheckoutResponseSchema,
  CreateOrderRequestSchema,
  TelegramAuthRequestSchema
} from "./index";

describe("shared API contracts", () => {
  it("accepts valid Mini App auth and checkout payloads", () => {
    expect(TelegramAuthRequestSchema.parse({ initData: "query=string" })).toEqual({
      initData: "query=string"
    });
    expect(CreateOrderRequestSchema.parse({ courseSlug: "course-basic" })).toEqual({
      courseSlug: "course-basic"
    });
    expect(
      CreateCourseCheckoutResponseSchema.parse({
        orderId: "order_1",
        paymentUrl: "https://yookassa.example/confirm"
      })
    ).toMatchObject({ orderId: "order_1" });
    expect(
      BotCreateCourseCheckoutResponseSchema.parse({
        orderId: "order_1",
        paymentUrl: "https://yookassa.example/confirm"
      })
    ).toMatchObject({ paymentUrl: "https://yookassa.example/confirm" });
  });

  it("accepts bot user upserts with Telegram identifiers as strings", () => {
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

  it("rejects malformed payloads before they reach application services", () => {
    expect(() => TelegramAuthRequestSchema.parse({ initData: "" })).toThrow();
    expect(() => CreateOrderRequestSchema.parse({ courseSlug: "" })).toThrow();
    expect(() => BotUserUpsertRequestSchema.parse({ telegramId: "" })).toThrow();
  });
});

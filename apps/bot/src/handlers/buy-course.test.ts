import { describe, expect, it, vi } from "vitest";
import {
  handleBuyCourse,
  handlePreCheckout,
  handleSuccessfulPayment
} from "./buy-course";
import { BotHandlerContext } from "../types";

function createContext(): BotHandlerContext & {
  replies: Array<{ text: string; options?: unknown }>;
  videos: Array<{ video: unknown; options?: unknown }>;
  invoices: Array<{
    title: string;
    description: string;
    payload: string;
    currency: string;
    prices: Array<{ label: string; amount: number }>;
    options?: unknown;
  }>;
  message?: {
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
} {
  return {
    from: { id: 42, first_name: "Ivan" },
    replies: [],
    videos: [],
    async reply(text: string, options?: unknown) {
      this.replies.push({ text, options });
    },
    async replyWithVideo(video: unknown, options?: unknown) {
      this.videos.push({ video, options });
    },
    invoices: [],
    async replyWithInvoice(
      title: string,
      description: string,
      payload: string,
      currency: string,
      prices: Array<{ label: string; amount: number }>,
      options?: unknown
    ) {
      this.invoices.push({ title, description, payload, currency, prices, options });
    }
  } as BotHandlerContext & {
    replies: Array<{ text: string; options?: unknown }>;
    videos: Array<{ video: unknown; options?: unknown }>;
    invoices: Array<{
      title: string;
      description: string;
      payload: string;
      currency: string;
      prices: Array<{ label: string; amount: number }>;
      options?: unknown;
    }>;
  };
}

describe("buy course handlers", () => {
  it("sends a Telegram invoice with the YooKassa provider token", async () => {
    const ctx = createContext();
    await handleBuyCourse(ctx, {
      paymentProviderToken: "yookassa-provider-token",
      api: {
        createOrder: vi.fn(async () => ({
          orderId: "order_1",
          status: "PENDING" as const,
          invoicePayload: "order_1",
          title: "Креативный контент | обучение",
          description: "Урок по геймификации в контенте",
          amountKopecks: 59900,
          currency: "RUB"
        }))
      }
    });

    expect(ctx.videos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Всё об уроке"),
      parse_mode: "HTML",
      width: 1280,
      height: 800,
      supports_streaming: true
    });
    expect(ctx.videos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Длительность: 33 минуты")
    });
    expect(ctx.videos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Цена: 599 руб")
    });
    expect(ctx.invoices.at(-1)).toMatchObject({
      title: "Креативный контент | обучение",
      payload: "order_1",
      currency: "RUB",
      prices: [{ label: "Геймификация в контенте", amount: 59900 }],
      options: { provider_token: "yookassa-provider-token" }
    });
  });

  it("shows a screenshot payment button when the YooKassa provider token is not ready yet", async () => {
    const ctx = createContext();

    await handleBuyCourse(ctx, {
      api: {
        createOrder: vi.fn(async () => {
          throw new Error("API should not be called without payment token");
        })
      }
    });

    expect(ctx.videos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Всё об уроке"),
      parse_mode: "HTML",
      reply_markup: expect.anything()
    });
    expect(JSON.stringify(ctx.videos.at(-1)?.options)).toContain("Оплатить 599 ₽");
    expect(ctx.invoices).toHaveLength(0);
  });

  it("accepts a matching Telegram pre-checkout query", async () => {
    const answerPreCheckoutQuery = vi.fn(async () => undefined);

    await handlePreCheckout(
      {
        preCheckoutQuery: {
          from: { id: 42 },
          invoice_payload: "order_1",
          currency: "RUB",
          total_amount: 59900
        },
        answerPreCheckoutQuery
      },
      {
        api: {
          validateTelegramInvoice: vi.fn(async () => ({ ok: true }))
        }
      }
    );

    expect(answerPreCheckoutQuery).toHaveBeenCalledWith(true);
  });

  it("grants access and shows the Mini App button after SuccessfulPayment", async () => {
    const ctx = createContext();
    ctx.message = {
      successful_payment: {
        currency: "RUB",
        total_amount: 59900,
        invoice_payload: "order_1",
        telegram_payment_charge_id: "telegram_charge_1",
        provider_payment_charge_id: "yookassa_charge_1"
      }
    };

    await handleSuccessfulPayment(ctx, {
      api: {
        completeTelegramPayment: vi.fn(async () => ({ paid: true, status: "PAID" as const }))
      },
      miniAppUrl: "https://course.example.com"
    });

    expect(ctx.replies.at(-1)?.text).toContain("Урок успешно оплачен");
    expect(JSON.stringify(ctx.replies.at(-1)?.options)).toContain("web_app");
  });
});

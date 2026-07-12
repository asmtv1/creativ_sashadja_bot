import { afterEach, describe, expect, it, vi } from "vitest";
import { TelegramInvoiceService } from "./telegram-invoice.service";

const order = {
  orderId: "order_1",
  status: "PENDING" as const,
  invoicePayload: "order_1",
  title: "Креативный контент | обучение",
  description: "Урок по геймификации в контенте",
  amountKopecks: 59900,
  currency: "RUB"
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TelegramInvoiceService", () => {
  it("creates a Telegram invoice link with the configured provider", async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true, result: "https://t.me/$invoice" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const service = new TelegramInvoiceService({
      getOrThrow: () => "bot-token",
      get: () => "provider-token"
    } as any);

    await expect(service.createInvoiceLink(order)).resolves.toBe("https://t.me/$invoice");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/createInvoiceLink",
      expect.objectContaining({ method: "POST" })
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      payload: "order_1",
      provider_token: "provider-token",
      currency: "RUB",
      prices: [{ amount: 59900 }]
    });
  });

  it("does not call Telegram when the payment provider is unavailable", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const service = new TelegramInvoiceService({
      getOrThrow: () => "bot-token",
      get: () => undefined
    } as any);

    await expect(service.createInvoiceLink(order)).rejects.toThrow("Оплата временно недоступна");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

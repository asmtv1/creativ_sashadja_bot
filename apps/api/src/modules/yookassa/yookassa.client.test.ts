import { afterEach, describe, expect, it, vi } from "vitest";
import { YooKassaClient } from "./yookassa.client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("YooKassaClient", () => {
  it("creates an SBP-only payment with the configured direct API credentials", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          id: "payment_1",
          status: "pending",
          paid: false,
          amount: { value: "599.00", currency: "RUB" },
          confirmation: { confirmation_url: "https://yookassa.example/confirm" }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new YooKassaClient({
      get: (key: string) =>
        ({ YOOKASSA_SHOP_ID: "shop_1", YOOKASSA_SECRET_KEY: "secret_1" })[key]
    } as any);

    await client.createSbpPayment({
      idempotenceKey: "order_1",
      amountKopecks: 59900,
      currency: "RUB",
      returnUrl: "https://course.example/return",
      metadata: { kind: "course_order", orderId: "order_1" }
    });

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({
      Authorization: "Basic " + Buffer.from("shop_1:secret_1").toString("base64"),
      "Idempotence-Key": "order_1"
    });
    expect(JSON.parse(String(request.body))).toMatchObject({
      amount: { value: "599.00", currency: "RUB" },
      payment_method_data: { type: "sbp" },
      capture: true,
      confirmation: { type: "redirect", return_url: "https://course.example/return" }
    });
  });
});

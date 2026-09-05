import { describe, expect, it } from "vitest";
import { formatNpdFailure, NpdGateway, NpdGatewayError } from "./gateway";

const response = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "application/json" } });

describe("NpdGateway", () => {
  it("sends WIRE for a cashless receipt and preserves the sale amount and time", async () => {
    let body: any;
    const gateway = new NpdGateway({ deviceId: "device", fetch: async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return response('{"approvedReceiptUuid":"receipt-1"}');
    } });
    const operationAt = new Date("2026-09-05T20:08:49.193Z");
    await gateway.createReceipt({ inn: "123456789012", operationAt, services: [{ name: "Канал", amount: "390.00", quantity: 1 }] });
    expect(body).toMatchObject({ paymentType: "WIRE", operationTime: operationAt.toISOString(), totalAmount: "390.00", services: [{ name: "Канал", amount: "390.00", quantity: 1 }] });
  });

  it("retains the HTTP status and symbolic code without leaking the provider message", async () => {
    const gateway = new NpdGateway({ deviceId: "device", fetch: async () => response(JSON.stringify({ code: "validation.error", message: "private buyer data", token: "secret" }), 400) });
    const error = await gateway.createReceipt({ inn: "123456789012", operationAt: new Date(), services: [{ name: "Канал", amount: "390.00" }] }).catch((error: NpdGatewayError) => error);
    expect(error).toMatchObject({ code: "API_ERROR", status: 400, providerCode: "validation.error" });
    expect(formatNpdFailure(error as NpdGatewayError)).toBe("Не удалось сформировать чек НПД · API_ERROR · HTTP 400 · validation.error");
    expect(JSON.stringify(error)).not.toMatch(/private buyer data|secret/);
  });

  it.each(["secret token", "79123456789", "token_12345", "x".repeat(81)])("omits unsafe provider codes: %s", async (code) => {
    const gateway = new NpdGateway({ deviceId: "device", fetch: async () => response(JSON.stringify({ code }), 400) });
    await expect(gateway.getProfile()).rejects.toMatchObject({ providerCode: undefined, status: 400 });
  });

  it.each([[200, "{}"], [409, '{"code":"DUPLICATE"}']])("requires reconciliation for an unconfirmed create (HTTP %s)", async (status, body) => {
    const gateway = new NpdGateway({ deviceId: "device", fetch: async () => response(body, status) });
    await expect(gateway.createReceipt({ inn: "123456789012", operationAt: new Date(), services: [{ name: "Канал", amount: "390.00" }] })).rejects.toMatchObject({ code: "AMBIGUOUS_WRITE" });
  });

  it("treats an unconfirmed create response as ambiguous rather than retrying blindly", async () => {
    const gateway = new NpdGateway({ deviceId: "device", fetch: async () => response("", 503) });
    await expect(gateway.createReceipt({ inn: "123456789012", operationAt: new Date(), services: [{ name: "Курс", amount: "390.00" }] })).rejects.toMatchObject({ code: "AMBIGUOUS_WRITE" satisfies NpdGatewayError["code"] });
  });

  it("accepts only the official NPD host", () => {
    expect(() => new NpdGateway({ deviceId: "device", baseUrl: "https://example.test/api" })).toThrow("allowlisted");
  });

  it.each([
    ["89179407410", "79179407410"],
    ["+7 917 940-74-10", "79179407410"],
    ["917 940 74 10", "79179407410"]
  ])("sends the NPD SMS API an 11-digit phone number for %s", async (input, expectedPhone) => {
    let requestBody: Record<string, unknown> | undefined;
    const gateway = new NpdGateway({
      deviceId: "device",
      fetch: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return response('{"challengeToken":"challenge"}');
      }
    });

    await expect(gateway.startSms(input)).resolves.toEqual({ challengeToken: "challenge" });
    expect(requestBody).toMatchObject({ phone: expectedPhone });
  });
});

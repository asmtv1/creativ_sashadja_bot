import { describe, expect, it } from "vitest";
import { NpdGateway, NpdGatewayError } from "./gateway";

const response = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "application/json" } });

describe("NpdGateway", () => {
  it("treats an unconfirmed create response as ambiguous rather than retrying blindly", async () => {
    const gateway = new NpdGateway({ deviceId: "device", fetch: async () => response("", 503) });
    await expect(gateway.createReceipt({ inn: "123456789012", operationAt: new Date(), services: [{ name: "Курс", amount: "390.00" }] })).rejects.toMatchObject({ code: "AMBIGUOUS_WRITE" satisfies NpdGatewayError["code"] });
  });

  it("accepts only the official NPD host", () => {
    expect(() => new NpdGateway({ deviceId: "device", baseUrl: "https://example.test/api" })).toThrow("allowlisted");
  });
});

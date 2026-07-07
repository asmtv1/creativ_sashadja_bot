import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TelegramInitDataService } from "./telegram-init-data.service";

function signedInitData(
  botToken: string,
  params: Record<string, string>,
  hashOverride?: string
): string {
  const dataCheckString = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash =
    hashOverride ?? createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...params, hash }).toString();
}

describe("TelegramInitDataService", () => {
  const botToken = "123456:test-token";
  const service = new TelegramInitDataService(botToken, 900);

  it("accepts valid Mini App initData signed with HMAC SHA-256", () => {
    const initData = signedInitData(botToken, {
      auth_date: Math.floor(Date.now() / 1000).toString(),
      query_id: "AAHdF6IQAAAAAN0XohDhrOrc",
      user: JSON.stringify({
        id: 42,
        first_name: "Ivan",
        last_name: "Petrov",
        username: "ivan",
        language_code: "ru"
      })
    });

    expect(service.validate(initData).telegramId).toBe("42");
    expect(service.validate(initData).username).toBe("ivan");
  });

  it("rejects tampered initData hashes", () => {
    const initData = signedInitData(
      botToken,
      {
        auth_date: Math.floor(Date.now() / 1000).toString(),
        user: JSON.stringify({ id: 42, first_name: "Ivan" })
      },
      "bad-hash"
    );

    expect(() => service.validate(initData)).toThrow(/signature/i);
  });

  it("rejects stale initData auth_date values", () => {
    const initData = signedInitData(botToken, {
      auth_date: "100",
      user: JSON.stringify({ id: 42, first_name: "Ivan" })
    });

    expect(() => service.validate(initData)).toThrow(/expired/i);
  });
});

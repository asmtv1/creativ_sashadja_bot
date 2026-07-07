import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramInitDataUser = {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  languageCode: string | null;
};

type TelegramWebAppUser = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

export class TelegramInitDataService {
  constructor(
    private readonly botToken: string,
    private readonly ttlSeconds = 1800
  ) {}

  validate(initData: string): TelegramInitDataUser {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) {
      throw new Error("Telegram initData signature is missing");
    }
    params.delete("hash");

    const dataCheckString = [...params.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const secret = createHmac("sha256", "WebAppData").update(this.botToken).digest();
    const expectedHash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

    if (!safeEqualHex(hash, expectedHash)) {
      throw new Error("Telegram initData signature is invalid");
    }

    const authDate = Number(params.get("auth_date"));
    if (!Number.isFinite(authDate)) {
      throw new Error("Telegram initData auth_date is missing");
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > this.ttlSeconds) {
      throw new Error("Telegram initData expired");
    }

    const userRaw = params.get("user");
    if (!userRaw) {
      throw new Error("Telegram initData user is missing");
    }
    const user = JSON.parse(userRaw) as TelegramWebAppUser;

    return {
      telegramId: String(user.id),
      username: user.username ?? null,
      firstName: user.first_name ?? null,
      lastName: user.last_name ?? null,
      languageCode: user.language_code ?? null
    };
  }
}

function safeEqualHex(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

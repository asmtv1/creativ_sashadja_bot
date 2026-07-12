import { describe, expect, it } from "vitest";
import { validateEnv } from "./env.schema";

const requiredEnv = {
  DATABASE_URL: "postgresql://course:course@localhost:5432/course?schema=public",
  TELEGRAM_BOT_TOKEN: "telegram-token",
  INTERNAL_API_TOKEN: "internal-token",
  ADMIN_BASIC_PASSWORD: "admin-password",
  YOOKASSA_SHOP_ID: "shop-id",
  YOOKASSA_SECRET_KEY: "secret-key",
  YOOKASSA_WEBHOOK_SECRET: "webhook-secret",
  MINIAPP_SESSION_SECRET: "miniapp-session-secret-32"
};

describe("validateEnv", () => {
  it("treats empty optional .env values as omitted", () => {
    const env = validateEnv({
      ...requiredEnv,
      YOOKASSA_SHOP_ID: "",
      YOOKASSA_SECRET_KEY: "",
      YOOKASSA_WEBHOOK_SECRET: "",
      TELEGRAM_BOT_USERNAME: "",
      TELEGRAM_PAYMENT_PROVIDER_TOKEN: "",
      TELEGRAM_WEBHOOK_SECRET: "",
      KINESCOPE_API_TOKEN: "",
      KINESCOPE_PRIVACY_MODE: ""
    });

    expect(env.TELEGRAM_BOT_USERNAME).toBeUndefined();
    expect(env.TELEGRAM_PAYMENT_PROVIDER_TOKEN).toBeUndefined();
    expect(env.TELEGRAM_WEBHOOK_SECRET).toBeUndefined();
    expect(env.YOOKASSA_SHOP_ID).toBeUndefined();
    expect(env.YOOKASSA_SECRET_KEY).toBeUndefined();
    expect(env.YOOKASSA_WEBHOOK_SECRET).toBeUndefined();
    expect(env.KINESCOPE_API_TOKEN).toBeUndefined();
    expect(env.KINESCOPE_PRIVACY_MODE).toBe("private_domains");
  });
});

import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalNonEmptyString = () => z.preprocess(emptyStringToUndefined, z.string().min(1).optional());
const stringWithDefault = (defaultValue: string) =>
  z.preprocess(emptyStringToUndefined, z.string().min(1).default(defaultValue));

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  PUBLIC_BASE_URL: z.string().url().default("https://sasha.gafus.ru"),
  DATABASE_URL: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: optionalNonEmptyString(),
  TELEGRAM_WEBHOOK_SECRET: optionalNonEmptyString(),
  INTERNAL_API_TOKEN: z.string().min(1),
  ADMIN_BASIC_USER: z.string().min(1).default("admin"),
  ADMIN_BASIC_PASSWORD: z.string().min(1),
  YOOKASSA_SHOP_ID: optionalNonEmptyString(),
  YOOKASSA_SECRET_KEY: optionalNonEmptyString(),
  YOOKASSA_WEBHOOK_SECRET: optionalNonEmptyString(),
  YOOKASSA_CURRENCY: z.string().min(3).default("RUB"),
  MINIAPP_SESSION_SECRET: z.string().min(16),
  MINIAPP_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  KINESCOPE_API_TOKEN: optionalNonEmptyString(),
  KINESCOPE_PRIVACY_MODE: stringWithDefault("private_domains")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return EnvSchema.parse(config);
}

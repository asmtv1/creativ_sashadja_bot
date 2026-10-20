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
  YOOKASSA_SHOP_ID: z.string().min(1),
  YOOKASSA_SECRET_KEY: z.string().min(1),
  YOOKASSA_WEBHOOK_SECRET: z.string().min(16),
  YOOKASSA_CURRENCY: z.string().min(3).default("RUB"),
  CHANNEL_SUBSCRIPTION_ENABLED: z.coerce.boolean().default(false),
  CHANNEL_PRODUCT_SLUG: z.string().min(1).default("creative-ideas"),
  CHANNEL_BIND_SECRET: optionalNonEmptyString(),
  // Opt-in only after the dry-run report has been reviewed.
  CHANNEL_EXPIRY_ENFORCEMENT_ENABLED: z.enum(["true", "false"]).default("false"),
  // Kept for backwards-compatible production environments; NPD processing is
  // controlled independently by NPD_PROCESSING_ENABLED and starts fail-closed.
  SELF_EMPLOYED_RECEIPT_PROVIDER: z.enum(["disabled", "npd"]).default("disabled"),
  SELF_EMPLOYED_SELLER_NAME: optionalNonEmptyString(),
  SELF_EMPLOYED_INN: optionalNonEmptyString(),
  SELF_EMPLOYED_CONTACT: optionalNonEmptyString(),
  NPD_PROCESSING_ENABLED: z.coerce.boolean().default(false),
  NPD_TOKEN_ENCRYPTION_KEY: optionalNonEmptyString(),
  NPD_BATCH_SIZE: z.coerce.number().int().positive().max(100).default(20),
  NPD_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  CHANNEL_SUBSCRIPTION_TERMS_VERSION: z.string().min(1).default("unpublished"),
  MINIAPP_SESSION_SECRET: z.string().min(16),
  MINIAPP_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  KINESCOPE_API_TOKEN: optionalNonEmptyString(),
  KINESCOPE_PRIVACY_MODE: stringWithDefault("private_domains")
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  return EnvSchema.parse(config);
}

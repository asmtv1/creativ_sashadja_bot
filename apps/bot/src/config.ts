import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalNonEmptyString = () => z.preprocess(emptyStringToUndefined, z.string().min(1).optional());

const BotConfigSchema = z.object({
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: optionalNonEmptyString(),
  PUBLIC_BASE_URL: z.string().url(),
  API_BASE_URL: z.string().url().default("http://api:3001"),
  INTERNAL_API_TOKEN: z.string().min(1),
  COURSE_SLUG: z.string().min(1).default("basic-course"),
  PORT: z.coerce.number().int().positive().default(3002)
});

export type BotConfig = z.infer<typeof BotConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  return BotConfigSchema.parse(env);
}

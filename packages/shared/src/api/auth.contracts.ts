import { z } from "zod";

export const TelegramAuthRequestSchema = z.object({
  initData: z.string().min(1)
});

export const TelegramUserDtoSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  username: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  languageCode: z.string().nullable()
});

export const TelegramAuthResponseSchema = z.object({
  token: z.string().min(1),
  user: TelegramUserDtoSchema
});

export type TelegramAuthRequest = z.infer<typeof TelegramAuthRequestSchema>;
export type TelegramUserDto = z.infer<typeof TelegramUserDtoSchema>;
export type TelegramAuthResponse = z.infer<typeof TelegramAuthResponseSchema>;

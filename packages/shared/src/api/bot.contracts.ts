import { z } from "zod";
import { OutboxType } from "../enums";
import { ChannelSubscriptionStatus } from "../enums";
import { CreateCourseCheckoutResponseSchema } from "./order.contracts";

export const BotUserUpsertRequestSchema = z.object({
  telegramId: z.string().min(1),
  username: z.string().nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  languageCode: z.string().nullable().optional()
});

export const BotCourseAccessResponseSchema = z.object({
  hasAccess: z.boolean()
});

export const BotCreateOrderRequestSchema = z.object({
  telegramId: z.string().min(1),
  courseSlug: z.string().min(1)
});

export const BotCreateCourseCheckoutResponseSchema = CreateCourseCheckoutResponseSchema;

export const BotOutboxItemSchema = z.object({
  id: z.string().min(1),
  telegramId: z.string().min(1),
  type: z.nativeEnum(OutboxType),
  payload: z.unknown()
});

export type BotUserUpsertRequest = z.infer<typeof BotUserUpsertRequestSchema>;
export type BotCourseAccessResponse = z.infer<typeof BotCourseAccessResponseSchema>;
export type BotCreateOrderRequest = z.infer<typeof BotCreateOrderRequestSchema>;
export type BotCreateCourseCheckoutResponse = z.infer<typeof BotCreateCourseCheckoutResponseSchema>;
export type BotOutboxItem = z.infer<typeof BotOutboxItemSchema>;

export const ChannelCheckoutRequestSchema = z.object({
  telegramId: z.string().min(1),
  acceptedTerms: z.literal(true)
});
export const ChannelSubscriptionStatusSchema = z.object({
  status: z.nativeEnum(ChannelSubscriptionStatus).optional(),
  activeUntil: z.string().datetime().nullable(),
  nextChargeAt: z.string().datetime().nullable(),
  autoRenew: z.boolean(),
  amountKopecks: z.number().int().nonnegative(),
  currency: z.string().min(3),
  confirmationUrl: z.string().url().optional()
});
export type ChannelSubscriptionStatusResponse = z.infer<typeof ChannelSubscriptionStatusSchema>;

import { z } from "zod";
import { OutboxType } from "../enums";
import { OrderStatus } from "../enums";
import { CreateOrderResponseSchema } from "./order.contracts";

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

export const BotCreateOrderResponseSchema = CreateOrderResponseSchema;

export const BotValidateTelegramInvoiceRequestSchema = z.object({
  telegramId: z.string().min(1),
  amountKopecks: z.number().int().nonnegative(),
  currency: z.string().min(3)
});

export const BotValidateTelegramInvoiceResponseSchema = z.object({
  ok: z.boolean(),
  errorMessage: z.string().optional()
});

export const BotCompleteTelegramPaymentRequestSchema = z.object({
  telegramId: z.string().min(1),
  providerPaymentChargeId: z.string().min(1),
  telegramPaymentChargeId: z.string().min(1),
  amountKopecks: z.number().int().nonnegative(),
  currency: z.string().min(3),
  rawPayload: z.unknown()
});

export const BotCompleteTelegramPaymentResponseSchema = z.object({
  paid: z.boolean(),
  status: z.nativeEnum(OrderStatus)
});

export const BotOutboxItemSchema = z.object({
  id: z.string().min(1),
  telegramId: z.string().min(1),
  type: z.nativeEnum(OutboxType),
  payload: z.unknown()
});

export type BotUserUpsertRequest = z.infer<typeof BotUserUpsertRequestSchema>;
export type BotCourseAccessResponse = z.infer<typeof BotCourseAccessResponseSchema>;
export type BotCreateOrderRequest = z.infer<typeof BotCreateOrderRequestSchema>;
export type BotCreateOrderResponse = z.infer<typeof BotCreateOrderResponseSchema>;
export type BotValidateTelegramInvoiceRequest = z.infer<
  typeof BotValidateTelegramInvoiceRequestSchema
>;
export type BotValidateTelegramInvoiceResponse = z.infer<
  typeof BotValidateTelegramInvoiceResponseSchema
>;
export type BotCompleteTelegramPaymentRequest = z.infer<
  typeof BotCompleteTelegramPaymentRequestSchema
>;
export type BotCompleteTelegramPaymentResponse = z.infer<
  typeof BotCompleteTelegramPaymentResponseSchema
>;
export type BotOutboxItem = z.infer<typeof BotOutboxItemSchema>;

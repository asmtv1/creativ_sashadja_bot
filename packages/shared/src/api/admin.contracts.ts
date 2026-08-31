import { z } from "zod";
import { OrderStatus } from "../enums";

export const AdminAccessMutationRequestSchema = z.object({
  telegramId: z.string().min(1),
  courseSlug: z.string().min(1)
});

export const AdminOrderDtoSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  courseSlug: z.string(),
  status: z.nativeEnum(OrderStatus),
  amountKopecks: z.number().int().nonnegative(),
  currency: z.string(),
  createdAt: z.string()
});

export const AdminNpdReceiptDtoSchema = z.object({
  id: z.string(),
  telegramId: z.string(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  product: z.string(),
  amountKopecks: z.number().int().nonnegative(),
  currency: z.string(),
  paidAt: z.string(),
  status: z.enum(["PENDING", "ISSUED", "RECONCILIATION_REQUIRED", "FAILED"]),
  receiptUrl: z.string().url().nullable(),
  lastError: z.string().nullable(),
});

export type AdminAccessMutationRequest = z.infer<typeof AdminAccessMutationRequestSchema>;
export type AdminOrderDto = z.infer<typeof AdminOrderDtoSchema>;
export type AdminNpdReceiptDto = z.infer<typeof AdminNpdReceiptDtoSchema>;

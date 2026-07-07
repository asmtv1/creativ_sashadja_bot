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

export type AdminAccessMutationRequest = z.infer<typeof AdminAccessMutationRequestSchema>;
export type AdminOrderDto = z.infer<typeof AdminOrderDtoSchema>;

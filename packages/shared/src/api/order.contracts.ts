import { z } from "zod";
import { OrderStatus } from "../enums";

export const CreateOrderRequestSchema = z.object({
  courseSlug: z.string().min(1)
});

export const CreateOrderResponseSchema = z.union([
  z.object({
    orderId: z.string().min(1),
    status: z.nativeEnum(OrderStatus),
    invoicePayload: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    amountKopecks: z.number().int().nonnegative(),
    currency: z.string().min(3)
  }),
  z.object({
    alreadyPaid: z.literal(true)
  })
]);

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;

import { z } from "zod";
export const CreateOrderRequestSchema = z.object({
  courseSlug: z.string().min(1)
});

export const CreateCourseCheckoutResponseSchema = z.union([
  z.object({
    orderId: z.string().min(1),
    paymentUrl: z.string().url()
  }),
  z.object({
    alreadyPaid: z.literal(true)
  })
]);

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type CreateCourseCheckoutResponse = z.infer<typeof CreateCourseCheckoutResponseSchema>;

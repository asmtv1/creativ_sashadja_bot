import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import { CreateOrderRequestSchema } from "@course/shared";
import { MiniAppAuthGuard } from "../telegram-auth/miniapp-auth.guard";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(MiniAppAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post("checkout")
  createCheckout(@Req() request: any, @Body() body: unknown) {
    const input = CreateOrderRequestSchema.parse(body);
    return this.orders.createCheckoutForUser(request.session.userId, input.courseSlug);
  }

  @Post(":orderId/verify")
  verifyCheckout(@Req() request: any, @Param("orderId") orderId: string) {
    return this.orders.verifyCheckoutForUser(request.session.userId, orderId);
  }
}

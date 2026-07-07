import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { CreateOrderRequestSchema } from "@course/shared";
import { MiniAppAuthGuard } from "../telegram-auth/miniapp-auth.guard";
import { OrdersService } from "./orders.service";

@Controller("orders")
@UseGuards(MiniAppAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Req() request: any, @Body() body: unknown) {
    const input = CreateOrderRequestSchema.parse(body);
    return this.orders.createOrderForUser(request.session.userId, input.courseSlug);
  }
}

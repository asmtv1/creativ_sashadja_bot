import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { CreateOrderRequestSchema } from "@course/shared";
import { MiniAppAuthGuard } from "../telegram-auth/miniapp-auth.guard";
import { OrdersService } from "./orders.service";
import { TelegramInvoiceService } from "./telegram-invoice.service";

@Controller("orders")
@UseGuards(MiniAppAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly telegramInvoices: TelegramInvoiceService
  ) {}

  @Post()
  create(@Req() request: any, @Body() body: unknown) {
    const input = CreateOrderRequestSchema.parse(body);
    return this.orders.createOrderForUser(request.session.userId, input.courseSlug);
  }

  @Post("invoice")
  async createInvoice(@Req() request: any, @Body() body: unknown) {
    const input = CreateOrderRequestSchema.parse(body);
    const order = await this.orders.createOrderForUser(request.session.userId, input.courseSlug);
    if ("alreadyPaid" in order) {
      return order;
    }
    return {
      orderId: order.orderId,
      invoiceUrl: await this.telegramInvoices.createInvoiceLink(order)
    };
  }
}

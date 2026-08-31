import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ChannelCheckoutRequestSchema } from "@course/shared";
import { InternalTokenGuard } from "../../common/guards/internal-token.guard";
import { OrdersService } from "../orders/orders.service";
import { ChannelSubscriptionsService } from "./channel-subscriptions.service";

@Controller()
export class ChannelSubscriptionsController {
  constructor(
    private readonly subscriptions: ChannelSubscriptionsService,
    private readonly orders: OrdersService
  ) {}

  @Post("webhooks/yookassa/:secret")
  async yookassaWebhook(@Param("secret") secret: string, @Body() body: unknown) {
    if (!process.env.YOOKASSA_WEBHOOK_SECRET || secret !== process.env.YOOKASSA_WEBHOOK_SECRET) return { ok: true };
    const object = body as { object?: { id?: string } };
    if (object.object?.id) {
      await Promise.all([
        this.subscriptions.handleWebhook(object.object.id),
        this.orders.handleWebhook(object.object.id)
      ]);
    }
    return { ok: true };
  }

  @UseGuards(InternalTokenGuard)
  @Post("internal/bot/channel-subscription/checkout")
  checkout(@Body() body: unknown) { const input = ChannelCheckoutRequestSchema.parse(body); return this.subscriptions.createCheckout(input.telegramId, input.acceptedTerms); }

  @UseGuards(InternalTokenGuard)
  @Get("internal/bot/channel-subscription/:telegramId")
  status(@Param("telegramId") telegramId: string) { return this.subscriptions.statusForTelegramId(telegramId); }

  @UseGuards(InternalTokenGuard)
  @Post("internal/bot/channel-subscription/:telegramId/stop-renewal")
  stopRenewal(@Param("telegramId") telegramId: string) {
    return this.subscriptions.stopAutoRenew(telegramId);
  }

  @UseGuards(InternalTokenGuard)
  @Post("internal/bot/channel-subscription/bind")
  bind(@Body() body: { secret?: string; chatId?: string; title?: string }) { return this.subscriptions.bindChannel({ secret: body.secret ?? "", chatId: body.chatId ?? "", title: body.title }); }
}

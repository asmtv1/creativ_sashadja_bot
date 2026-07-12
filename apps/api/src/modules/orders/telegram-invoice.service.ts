import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateOrderResponse } from "@course/shared";

type PendingOrder = Exclude<CreateOrderResponse, { alreadyPaid: true }>;

type TelegramResponse = {
  ok?: boolean;
  result?: string;
};

@Injectable()
export class TelegramInvoiceService {
  constructor(private readonly config: ConfigService) {}

  async createInvoiceLink(order: PendingOrder): Promise<string> {
    const botToken = this.config.getOrThrow<string>("TELEGRAM_BOT_TOKEN");
    const providerToken = this.config.get<string>("TELEGRAM_PAYMENT_PROVIDER_TOKEN");
    if (!providerToken) {
      throw new ServiceUnavailableException("Оплата временно недоступна");
    }

    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: order.title.slice(0, 32),
          description: order.description.slice(0, 255),
          payload: order.invoicePayload,
          provider_token: providerToken,
          currency: order.currency,
          prices: [{ label: order.title.slice(0, 32), amount: order.amountKopecks }]
        }),
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new BadGatewayException("Не удалось подготовить оплату");
    }

    const payload = (await response.json().catch(() => ({}))) as TelegramResponse;
    if (!response.ok || payload.ok !== true || typeof payload.result !== "string") {
      throw new BadGatewayException("Не удалось подготовить оплату");
    }
    return payload.result;
  }
}

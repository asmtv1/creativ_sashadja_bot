import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { kopecksToYooKassaAmount } from "@course/shared";

export type YooKassaPayment = {
  id: string;
  status: "pending" | "succeeded" | "canceled";
  paid: boolean;
  amount: { value: string; currency: string };
  metadata?: Record<string, string>;
  confirmation?: { confirmation_url?: string };
  payment_method?: { id?: string; saved?: boolean; type?: string };
  cancellation_details?: { reason?: string };
};

@Injectable()
export class YooKassaClient {
  private readonly endpoint = "https://api.yookassa.ru/v3/payments";

  constructor(private readonly config: ConfigService) {}

  async createSbpPayment(input: {
    idempotenceKey: string;
    amountKopecks: number;
    currency: string;
    returnUrl: string;
    metadata: Record<string, string>;
    savePaymentMethod?: boolean;
  }) {
    return this.request("", {
      method: "POST",
      headers: { "Idempotence-Key": input.idempotenceKey },
      body: JSON.stringify({
        amount: {
          value: kopecksToYooKassaAmount(input.amountKopecks),
          currency: input.currency
        },
        capture: true,
        ...(input.savePaymentMethod ? { save_payment_method: true } : {}),
        payment_method_data: { type: "sbp" },
        confirmation: { type: "redirect", return_url: input.returnUrl },
        metadata: input.metadata
      })
    });
  }

  async createSavedMethodPayment(input: {
    idempotenceKey: string;
    amountKopecks: number;
    currency: string;
    paymentMethodId: string;
    metadata: Record<string, string>;
  }) {
    return this.request("", {
      method: "POST",
      headers: { "Idempotence-Key": input.idempotenceKey },
      body: JSON.stringify({
        amount: {
          value: kopecksToYooKassaAmount(input.amountKopecks),
          currency: input.currency
        },
        capture: true,
        payment_method_id: input.paymentMethodId,
        metadata: input.metadata
      })
    });
  }

  async getPayment(id: string) {
    return this.request(`/${encodeURIComponent(id)}`);
  }

  async cancelPayment(id: string, idempotenceKey: string) {
    return this.request(`/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: { "Idempotence-Key": idempotenceKey },
      body: JSON.stringify({})
    });
  }

  private async request(path: string, init: RequestInit = {}): Promise<YooKassaPayment> {
    const shopId = this.config.get<string>("YOOKASSA_SHOP_ID");
    const secret = this.config.get<string>("YOOKASSA_SECRET_KEY");
    if (!shopId || !secret) {
      throw new ServiceUnavailableException("YooKassa payments are not configured");
    }

    const authorization = `Basic ${Buffer.from(`${shopId}:${secret}`).toString("base64")}`;
    let response: Response;
    try {
      response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          ...init.headers
        },
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new ServiceUnavailableException("Payment provider is temporarily unavailable");
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new ServiceUnavailableException(`Payment provider returned ${response.status}`);
    }
    return payload as YooKassaPayment;
  }
}

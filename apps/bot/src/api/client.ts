import {
  BotCompleteTelegramPaymentResponse,
  BotCompleteTelegramPaymentResponseSchema,
  BotCourseAccessResponseSchema,
  BotValidateTelegramInvoiceResponseSchema,
  BotCreateOrderResponseSchema,
  BotOutboxItemSchema,
  BotUserUpsertRequest
} from "@course/shared";
import { BotApi } from "../types";

type ClientConfig = {
  apiBaseUrl: string;
  internalToken: string;
  courseSlug: string;
};

export class InternalApiClient implements BotApi {
  constructor(private readonly config: ClientConfig) {}

  async upsertBotUser(input: BotUserUpsertRequest) {
    return this.request("/api/internal/bot/users/upsert", {
      method: "POST",
      body: input
    });
  }

  async getCourseAccess(telegramId: string) {
    const url = `/api/internal/bot/users/${telegramId}/course-access?courseSlug=${encodeURIComponent(
      this.config.courseSlug
    )}`;
    return BotCourseAccessResponseSchema.parse(await this.request(url));
  }

  async createOrder(telegramId: string) {
    return BotCreateOrderResponseSchema.parse(
      await this.request("/api/internal/bot/orders", {
        method: "POST",
        body: { telegramId, courseSlug: this.config.courseSlug }
      })
    );
  }

  async validateTelegramInvoice(input: {
    orderId: string;
    telegramId: string;
    amountKopecks: number;
    currency: string;
  }) {
    return BotValidateTelegramInvoiceResponseSchema.parse(
      await this.request(`/api/internal/bot/orders/${input.orderId}/telegram/pre-checkout`, {
        method: "POST",
        body: {
          telegramId: input.telegramId,
          amountKopecks: input.amountKopecks,
          currency: input.currency
        }
      })
    );
  }

  async completeTelegramPayment(input: {
    orderId: string;
    telegramId: string;
    providerPaymentChargeId: string;
    telegramPaymentChargeId: string;
    amountKopecks: number;
    currency: string;
    rawPayload: unknown;
  }): Promise<BotCompleteTelegramPaymentResponse> {
    return BotCompleteTelegramPaymentResponseSchema.parse(
      await this.request(`/api/internal/bot/orders/${input.orderId}/telegram/successful-payment`, {
        method: "POST",
        body: {
          telegramId: input.telegramId,
          providerPaymentChargeId: input.providerPaymentChargeId,
          telegramPaymentChargeId: input.telegramPaymentChargeId,
          amountKopecks: input.amountKopecks,
          currency: input.currency,
          rawPayload: input.rawPayload
        }
      })
    );
  }

  async getOutbox(limit = 20) {
    const payload = await this.request(`/api/internal/bot/outbox?limit=${limit}`);
    return BotOutboxItemSchema.array().parse(payload);
  }

  async markOutboxSent(id: string) {
    await this.request(`/api/internal/bot/outbox/${id}/sent`, { method: "POST" });
  }

  async markOutboxFailed(id: string, error: string) {
    await this.request(`/api/internal/bot/outbox/${id}/failed`, {
      method: "POST",
      body: { error }
    });
  }

  private async request(path: string, init: { method?: string; body?: unknown } = {}) {
    const response = await fetch(`${this.config.apiBaseUrl}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": this.config.internalToken
      },
      body: init.body ? JSON.stringify(init.body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`API request failed ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload;
  }
}

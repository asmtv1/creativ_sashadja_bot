import {
  BotCourseAccessResponseSchema,
  BotCreateCourseCheckoutResponseSchema,
  BotOutboxItemSchema,
  BotUserUpsertRequest,
  ChannelSubscriptionStatusSchema
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

  async createCourseCheckout(telegramId: string) {
    return BotCreateCourseCheckoutResponseSchema.parse(
      await this.request("/api/internal/bot/orders/checkout", {
        method: "POST",
        body: { telegramId, courseSlug: this.config.courseSlug }
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

  async createChannelCheckout(telegramId: string) {
    return ChannelSubscriptionStatusSchema.parse(await this.request("/api/internal/bot/channel-subscription/checkout", { method: "POST", body: { telegramId, acceptedTerms: true } }));
  }
  async getChannelSubscription(telegramId: string) {
    return ChannelSubscriptionStatusSchema.parse(await this.request(`/api/internal/bot/channel-subscription/${encodeURIComponent(telegramId)}`));
  }
  async stopChannelRenewal(telegramId: string) {
    return this.request(
      `/api/internal/bot/channel-subscription/${encodeURIComponent(telegramId)}/stop-renewal`,
      { method: "POST" }
    );
  }
  async bindChannel(input: { secret: string; chatId: string; title?: string }) {
    return this.request("/api/internal/bot/channel-subscription/bind", { method: "POST", body: input });
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

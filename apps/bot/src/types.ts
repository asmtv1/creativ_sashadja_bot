import {
  BotCreateCourseCheckoutResponse,
  BotOutboxItem,
  ChannelSubscriptionStatusResponse
} from "@course/shared";

export type BotHandlerContext = {
  from?: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };
  reply(text: string, options?: unknown): Promise<unknown>;
  replyWithPhoto?(photo: unknown, options?: unknown): Promise<unknown>;
  replyWithVideo?(video: unknown, options?: unknown): Promise<unknown>;
};

export type BotApi = {
  upsertBotUser(input: {
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    languageCode?: string | null;
  }): Promise<unknown>;
  getCourseAccess(telegramId: string): Promise<{ hasAccess: boolean }>;
  createCourseCheckout(telegramId: string): Promise<BotCreateCourseCheckoutResponse>;
  getOutbox(limit?: number): Promise<BotOutboxItem[]>;
  markOutboxSent(id: string): Promise<void>;
  markOutboxFailed(id: string, error: string): Promise<void>;
  createChannelCheckout(telegramId: string): Promise<ChannelSubscriptionStatusResponse>;
  getChannelSubscription(telegramId: string): Promise<ChannelSubscriptionStatusResponse>;
  stopChannelRenewal(telegramId: string): Promise<unknown>;
  bindChannel(input: { secret: string; chatId: string; title?: string }): Promise<unknown>;
};

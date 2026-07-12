import {
  BotCompleteTelegramPaymentResponse,
  BotCreateOrderResponse,
  BotOutboxItem,
  BotValidateTelegramInvoiceResponse
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
  api?: {
    createInvoiceLink(
      title: string,
      description: string,
      payload: string,
      providerToken: string,
      currency: string,
      prices: Array<{ label: string; amount: number }>,
      options?: unknown
    ): Promise<string>;
  };
};

export type BotPreCheckoutContext = {
  preCheckoutQuery?: {
    from: { id: number };
    invoice_payload: string;
    currency: string;
    total_amount: number;
  };
  answerPreCheckoutQuery(ok: boolean, options?: unknown): Promise<unknown>;
};

export type BotSuccessfulPaymentContext = BotHandlerContext & {
  message?: {
    successful_payment?: {
      currency: string;
      total_amount: number;
      invoice_payload: string;
      telegram_payment_charge_id: string;
      provider_payment_charge_id: string;
    };
  };
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
  createOrder(telegramId: string): Promise<BotCreateOrderResponse>;
  validateTelegramInvoice(input: {
    orderId: string;
    telegramId: string;
    amountKopecks: number;
    currency: string;
  }): Promise<BotValidateTelegramInvoiceResponse>;
  completeTelegramPayment(input: {
    orderId: string;
    telegramId: string;
    providerPaymentChargeId: string;
    telegramPaymentChargeId: string;
    amountKopecks: number;
    currency: string;
    rawPayload: unknown;
  }): Promise<BotCompleteTelegramPaymentResponse>;
  getOutbox(limit?: number): Promise<BotOutboxItem[]>;
  markOutboxSent(id: string): Promise<void>;
  markOutboxFailed(id: string, error: string): Promise<void>;
};

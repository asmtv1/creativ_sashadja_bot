import { BotOutboxItem } from "@course/shared";
import type { Api } from "grammy";
import { PAYMENT_SUCCESS_MESSAGE } from "./content";
import { openCourseKeyboard, subscriptionKeyboard } from "./keyboards";
import { BotApi } from "./types";

type TelegramSendMessageOptions = Parameters<Api["sendMessage"]>[2];

export type TelegramSender = {
  sendMessage(telegramId: string, text: string, options?: TelegramSendMessageOptions): Promise<void>;
};

export async function runOutboxBatch(deps: {
  api: Pick<BotApi, "getOutbox" | "markOutboxSent" | "markOutboxFailed"> & Partial<Pick<BotApi, "getChannelSubscription">>;
  telegram: TelegramSender;
  miniAppUrl: string;
}) {
  let items: BotOutboxItem[];
  try {
    items = await deps.api.getOutbox(20);
  } catch (error) {
    console.warn(
      "Bot outbox polling failed",
      error instanceof Error ? error.message : "Unknown API error"
    );
    return;
  }

  for (const item of items) {
    try {
      const isSubscriptionNotice = item.type === "CHANNEL_SUBSCRIPTION_EXPIRING" || item.type === "CHANNEL_SUBSCRIPTION_EXPIRED";
      if (isSubscriptionNotice) {
        if (!deps.api.getChannelSubscription) throw new Error("Subscription status API unavailable");
        const payload = item.payload as { periodEnd?: unknown } | null;
        const end = typeof payload?.periodEnd === "string" ? Date.parse(payload.periodEnd) : NaN;
        if (!Number.isFinite(end)) throw new Error("Invalid subscription notice payload");
        const current = await deps.api.getChannelSubscription(item.telegramId);
        const stillRelevant = !current.autoRenew && current.activeUntil === payload!.periodEnd &&
          (item.type === "CHANNEL_SUBSCRIPTION_EXPIRING" ? Date.now() < end : Date.now() >= end && Date.now() - end <= 48 * 60 * 60_000);
        if (!stillRelevant) {
          await deps.api.markOutboxSent(item.id);
          continue;
        }
      }
      const text = messageForOutboxItem(item);
      if (item.type === "PAYMENT_SUCCEEDED") {
        await deps.telegram.sendMessage(item.telegramId, text, openCourseKeyboard(deps.miniAppUrl));
      } else if (isSubscriptionNotice) {
        await deps.telegram.sendMessage(item.telegramId, text, subscriptionKeyboard(false));
      } else {
        await deps.telegram.sendMessage(item.telegramId, text);
      }
      await deps.api.markOutboxSent(item.id);
    } catch (error) {
      await deps.api.markOutboxFailed(
        item.id,
        error instanceof Error ? error.message : "Unknown Telegram error"
      );
    }
  }
}

function messageForOutboxItem(item: BotOutboxItem): string {
  if (item.type === "CHANNEL_SUBSCRIPTION_EXPIRING" || item.type === "CHANNEL_SUBSCRIPTION_EXPIRED") {
    const payload = item.payload as { periodEnd?: string };
    const date = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeZone: "Europe/Moscow" }).format(new Date(payload.periodEnd!));
    return item.type === "CHANNEL_SUBSCRIPTION_EXPIRING"
      ? `Напоминание: автопродление отключено, оплаченная подписка заканчивается ${date}. Чтобы продлить доступ к каналу, откройте /subscription и оформите подписку снова.`
      : `Оплаченный период подписки закончился ${date}. Автопродление было отключено. Вернуться в канал можно через /subscription — оформите подписку снова.`;
  }
  if (item.type === "CHANNEL_INVITE") {
    const payload = item.payload as { title?: string; inviteLink?: string };
    if (!payload?.inviteLink?.startsWith("https://t.me/")) throw new Error("Invalid channel invite payload");
    return `Оплата прошла! Доступ к каналу «${payload.title ?? "Креатив идеи"}» открыт. Вступите по одноразовой ссылке: ${payload.inviteLink}`;
  }
  if (item.type === "PAYMENT_SUCCEEDED") {
    return PAYMENT_SUCCESS_MESSAGE;
  }
  if (item.type === "ACCESS_GRANTED") {
    return "Доступ к курсу открыт администратором.";
  }
  if (item.type === "NPD_RECEIPT_ISSUED") {
    const payload = item.payload && typeof item.payload === "object" ? item.payload as { printUrl?: unknown; serviceName?: unknown } : {};
    const serviceName = typeof payload.serviceName === "string" ? payload.serviceName : "покупку";
    const printUrl = typeof payload.printUrl === "string" && /^https:\/\//.test(payload.printUrl) ? payload.printUrl : null;
    return printUrl ? `Чек за ${serviceName} сформирован: ${printUrl}` : `Чек за ${serviceName} сформирован.`;
  }
  if (item.type === "ACCESS_REVOKED") {
    return "Доступ к курсу был отозван.";
  }
  return "Обновление по вашему курсу.";
}

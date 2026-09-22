import { BotOutboxItem } from "@course/shared";
import type { Api } from "grammy";
import { PAYMENT_SUCCESS_MESSAGE } from "./content";
import { openCourseKeyboard } from "./keyboards";
import { BotApi } from "./types";

type TelegramSendMessageOptions = Parameters<Api["sendMessage"]>[2];

export type TelegramSender = {
  sendMessage(telegramId: string, text: string, options?: TelegramSendMessageOptions): Promise<void>;
};

export async function runOutboxBatch(deps: {
  api: Pick<BotApi, "getOutbox" | "markOutboxSent" | "markOutboxFailed">;
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
      const text = messageForOutboxItem(item);
      if (item.type === "PAYMENT_SUCCEEDED") {
        await deps.telegram.sendMessage(item.telegramId, text, openCourseKeyboard(deps.miniAppUrl));
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

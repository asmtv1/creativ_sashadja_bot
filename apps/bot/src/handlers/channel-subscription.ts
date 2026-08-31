import { formatRubles } from "@course/shared";
import { channelTermsKeyboard, paymentUrlKeyboard, subscriptionKeyboard } from "../keyboards";
import { BotApi, BotHandlerContext } from "../types";

const CHANNEL_OFFER = [
  "Канал «Креатив идеи» — 390 ₽ за 30 суток.",
  "",
  "Первый платёж и каждое продление выполняются только через СБП.",
  "Автопродление включено по умолчанию: мы попробуем списать 390 ₽ за 4 часа до окончания периода. Его можно остановить в любой момент — мы удалим сохранённый способ оплаты из нашей системы, а доступ сохранится до конца оплаченного срока.",
  "",
  "До оплаты ознакомьтесь с офертой и политикой конфиденциальности. Нажатие кнопки ниже подтверждает принятие условий."
].join("\n");

export async function handleChannelEntry(
  ctx: BotHandlerContext,
  api: Pick<BotApi, "getChannelSubscription">,
  publicBaseUrl: string
) {
  const status = await api.getChannelSubscription(requireTelegramId(ctx)).catch(() => null);
  if (status?.activeUntil) {
    await sendSubscriptionStatus(ctx, status);
    return;
  }
  await ctx.reply(CHANNEL_OFFER, channelTermsKeyboard(publicBaseUrl));
}

export async function handleChannelCheckout(
  ctx: BotHandlerContext,
  api: Pick<BotApi, "createChannelCheckout">
) {
  const telegramId = requireTelegramId(ctx);
  try {
    const result = await api.createChannelCheckout(telegramId);
    if (!result.confirmationUrl) {
      throw new Error("Missing checkout URL");
    }
    await ctx.reply(
      "Перейдите на защищённую страницу YooKassa. Оплата доступна только через СБП.",
      paymentUrlKeyboard(result.confirmationUrl)
    );
  } catch {
    await ctx.reply("Подписка пока недоступна. Попробуйте позже или напишите в поддержку.");
  }
}

export async function handleSubscriptionStatus(
  ctx: BotHandlerContext,
  api: Pick<BotApi, "getChannelSubscription">
) {
  try {
    await sendSubscriptionStatus(ctx, await api.getChannelSubscription(requireTelegramId(ctx)));
  } catch {
    await ctx.reply("Не удалось загрузить статус подписки. Попробуйте позже.");
  }
}

export async function handleStopRenewal(
  ctx: BotHandlerContext,
  api: Pick<BotApi, "stopChannelRenewal">
) {
  try {
    await api.stopChannelRenewal(requireTelegramId(ctx));
    await ctx.reply(
      "Продление остановлено. Сохранённый способ оплаты удалён из нашей системы, новых списаний не будет. Доступ сохранится до конца оплаченного периода."
    );
  } catch {
    await ctx.reply("Не удалось остановить продление. Попробуйте позже.");
  }
}

async function sendSubscriptionStatus(
  ctx: BotHandlerContext,
  status: Awaited<ReturnType<BotApi["getChannelSubscription"]>>
) {
  const until = status.activeUntil
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeZone: "Europe/Moscow"
      }).format(new Date(status.activeUntil))
    : "нет активного периода";
  const next = status.nextChargeAt
    ? new Intl.DateTimeFormat("ru-RU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Moscow"
      }).format(new Date(status.nextChargeAt))
    : "не назначено";
  const autoRenewText = status.autoRenew
    ? "включено — списание будет только через СБП"
    : "остановлено — сохранённый способ оплаты удалён";

  await ctx.reply(
    [
      "Подписка: " + (status.status ?? "не оформлена"),
      "Оплачено до: " + until,
      "Следующее списание: " + next + ", " + formatRubles(status.amountKopecks),
      "Автопродление: " + autoRenewText
    ].join("\n"),
    subscriptionKeyboard(status.autoRenew)
  );
}

function requireTelegramId(ctx: BotHandlerContext) {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from bot context");
  }
  return String(ctx.from.id);
}

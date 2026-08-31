import { BotHandlerContext } from "../types";

export async function handleSupport(ctx: BotHandlerContext) {
  await ctx.reply("Поддержка и обращения к исполнителю: @sakassandra");
}

export async function handleTerms(ctx: BotHandlerContext, publicBaseUrl: string) {
  await ctx.reply("Публичная оферта:", {
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть оферту", url: legalUrl(publicBaseUrl, "/legal/offer") }]]
    }
  });
}

export async function handlePrivacy(ctx: BotHandlerContext, publicBaseUrl: string) {
  await ctx.reply("Политика обработки персональных данных:", {
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть политику", url: legalUrl(publicBaseUrl, "/legal/privacy") }]]
    }
  });
}

export async function handlePaySupport(ctx: BotHandlerContext) {
  await ctx.reply("По вопросам оплаты и возврата напишите @sakassandra и приложите номер заказа или платежа. Не отправляйте данные карты, коды из СМС или пароль от банка.");
}

function legalUrl(publicBaseUrl: string, path: string) {
  return new URL(path, publicBaseUrl).href;
}

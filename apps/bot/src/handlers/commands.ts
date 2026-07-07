import { BotHandlerContext } from "../types";

export async function handleSupport(ctx: BotHandlerContext) {
  await ctx.reply("Поддержка: напишите администратору курса или ответьте на любое сообщение бота.");
}

export async function handleTerms(ctx: BotHandlerContext) {
  await ctx.reply("Условия: доступ к цифровому курсу открывается после подтверждения оплаты.");
}

export async function handlePaySupport(ctx: BotHandlerContext) {
  await ctx.reply("По вопросам оплаты напишите в поддержку и приложите номер заказа.");
}

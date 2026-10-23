import { Bot, GrammyError } from "grammy";
import { BotApi } from "./types";
import { handleBuyCourse } from "./handlers/buy-course";
import { handlePaySupport, handlePrivacy, handleSupport, handleTerms } from "./handlers/commands";
import { handleStart } from "./handlers/start";
import {
  handleChannelCheckout,
  handleChannelEntry,
  handleChannelOffer,
  handleStopRenewal,
  handleSubscriptionStatus
} from "./handlers/channel-subscription";

export function createCourseBot(deps: {
  token: string;
  api: BotApi;
  miniAppUrl: string;
}) {
  const bot = new Bot(deps.token);

  bot.command("start", (ctx) => handleStart(ctx, { api: deps.api, miniAppUrl: deps.miniAppUrl }));
  bot.command("support", handleSupport);
  bot.command("terms", (ctx) => handleTerms(ctx, deps.miniAppUrl));
  bot.command("privacy", (ctx) => handlePrivacy(ctx, deps.miniAppUrl));
  bot.command("paysupport", handlePaySupport);
  bot.command("subscription", (ctx) => handleSubscriptionStatus(ctx, deps.api));

  bot.callbackQuery("buy_course", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx);
    await handleBuyCourse(ctx, {
      api: deps.api,
      miniAppUrl: deps.miniAppUrl
    });
  });

  bot.callbackQuery("channel_subscription", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx);
    await handleChannelEntry(ctx, deps.api, deps.miniAppUrl);
  });
  bot.callbackQuery("channel_reactivate", async (ctx) => { await answerCallbackQueryIfFresh(ctx); await handleChannelOffer(ctx, deps.miniAppUrl); });
  bot.callbackQuery("channel_checkout", async (ctx) => { await answerCallbackQueryIfFresh(ctx); await handleChannelCheckout(ctx, deps.api); });
  bot.callbackQuery("channel_cancel_confirm", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx);
    await ctx.reply(
      "Остановить продление? Мы удалим сохранённый способ оплаты из нашей системы. Доступ сохранится до конца оплаченного периода.",
      { reply_markup: { inline_keyboard: [[{ text: "Остановить продление", callback_data: "channel_cancel" }]] } }
    );
  });
  bot.callbackQuery("channel_cancel", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx);
    await handleStopRenewal(ctx, deps.api);
  });

  bot.on("channel_post:text", async (ctx) => {
    const match = ctx.channelPost.text.match(/^\/bind_channel\s+(.+)$/);
    if (!match) return;
    try {
      await deps.api.bindChannel({ secret: match[1] ?? "", chatId: String(ctx.chat.id), title: "title" in ctx.chat ? ctx.chat.title : undefined });
      await ctx.api.deleteMessage(ctx.chat.id, ctx.channelPost.message_id);
    } catch {
      // Never reveal or log a channel bind secret.
    }
  });

  bot.catch((error) => {
    console.error("Bot handler failed", error.error);
  });

  return bot;
}

async function answerCallbackQueryIfFresh(
  ctx: { answerCallbackQuery(options?: { text?: string }): Promise<unknown> },
  options?: { text?: string }
) {
  try {
    await ctx.answerCallbackQuery(options);
  } catch (error) {
    if (
      error instanceof GrammyError &&
      error.error_code === 400 &&
      error.description.includes("query is too old")
    ) {
      return;
    }
    throw error;
  }
}

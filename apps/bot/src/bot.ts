import { Bot, GrammyError } from "grammy";
import { BotApi } from "./types";
import {
  handleBuyCourse,
  handlePreCheckout,
  handleSuccessfulPayment
} from "./handlers/buy-course";
import { handlePaySupport, handleSupport, handleTerms } from "./handlers/commands";
import { handleStart } from "./handlers/start";

export function createCourseBot(deps: {
  token: string;
  api: BotApi;
  miniAppUrl: string;
  paymentProviderToken?: string;
}) {
  const bot = new Bot(deps.token);

  bot.command("start", (ctx) => handleStart(ctx, { api: deps.api, miniAppUrl: deps.miniAppUrl }));
  bot.command("support", handleSupport);
  bot.command("terms", handleTerms);
  bot.command("paysupport", handlePaySupport);

  bot.callbackQuery("buy_course", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx);
    await handleBuyCourse(ctx, {
      api: deps.api,
      paymentProviderToken: deps.paymentProviderToken
    });
  });

  bot.callbackQuery("payment_setup_pending", async (ctx) => {
    await answerCallbackQueryIfFresh(ctx, {
      text: "Оплата подключается. Кнопка показана для проверки YooKassa."
    });
  });

  bot.on("pre_checkout_query", async (ctx) => {
    await handlePreCheckout(ctx, { api: deps.api });
  });

  bot.on("message:successful_payment", async (ctx) => {
    await handleSuccessfulPayment(ctx, { api: deps.api, miniAppUrl: deps.miniAppUrl });
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

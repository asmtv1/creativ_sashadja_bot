import { InputFile } from "grammy";
import { buyCourseKeyboard } from "../keyboards";
import { START_MESSAGE, WELCOME_IMAGE_PATH } from "../content";
import { BotApi, BotHandlerContext } from "../types";

export async function handleStart(
  ctx: BotHandlerContext,
  deps: { api: Pick<BotApi, "upsertBotUser">; miniAppUrl: string }
) {
  const from = requireTelegramUser(ctx);
  const telegramId = String(from.id);

  try {
    await deps.api.upsertBotUser({
      telegramId,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null
    });
  } catch (error) {
    console.warn(
      "Bot /start API call failed",
      error instanceof Error ? error.message : "Unknown API error"
    );
  }

  if (ctx.replyWithPhoto) {
    await ctx.replyWithPhoto(new InputFile(WELCOME_IMAGE_PATH), {
      caption: START_MESSAGE,
      parse_mode: "HTML",
      ...buyCourseKeyboard()
    });
    return;
  }

  await ctx.reply(START_MESSAGE, { ...buyCourseKeyboard() });
}

function requireTelegramUser(ctx: BotHandlerContext) {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from bot context");
  }
  return ctx.from;
}

import { buyCourseKeyboard, openCourseKeyboard } from "../keyboards";
import { BotApi, BotHandlerContext } from "../types";
import { START_MESSAGE } from "../content";

export async function handleStart(
  ctx: BotHandlerContext,
  deps: { api: Pick<BotApi, "upsertBotUser" | "getCourseAccess">; miniAppUrl: string }
) {
  const from = requireTelegramUser(ctx);
  const telegramId = String(from.id);

  let access = { hasAccess: false };
  try {
    await deps.api.upsertBotUser({
      telegramId,
      username: from.username ?? null,
      firstName: from.first_name ?? null,
      lastName: from.last_name ?? null,
      languageCode: from.language_code ?? null
    });
    access = await deps.api.getCourseAccess(telegramId);
  } catch (error) {
    console.warn(
      "Bot /start API call failed",
      error instanceof Error ? error.message : "Unknown API error"
    );
  }

  if (access.hasAccess) {
    await ctx.reply("Доступ открыт. Нажмите «Открыть курс», чтобы перейти к урокам.", {
      ...openCourseKeyboard(deps.miniAppUrl)
    });
    return;
  }

  await ctx.reply(START_MESSAGE, {
    ...buyCourseKeyboard()
  });
}

function requireTelegramUser(ctx: BotHandlerContext) {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from bot context");
  }
  return ctx.from;
}

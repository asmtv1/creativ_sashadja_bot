import { InputFile } from "grammy";
import { openCourseKeyboard, paymentKeyboard } from "../keyboards";
import { BotApi, BotHandlerContext } from "../types";
import { LESSON_PAYMENT_MESSAGE, LESSON_PREVIEW_VIDEO_PATH } from "../content";

export async function handleBuyCourse(
  ctx: BotHandlerContext,
  deps: { api: Pick<BotApi, "createCourseCheckout" | "getCourseAccess">; miniAppUrl: string }
) {
  const telegramId = requireTelegramId(ctx);
  const access = await deps.api.getCourseAccess(telegramId).catch(() => ({ hasAccess: false }));
  if (access.hasAccess) {
    await ctx.reply("Доступ уже открыт. Можно переходить к курсу.", {
      ...openCourseKeyboard(deps.miniAppUrl)
    });
    return;
  }

  const checkout = await deps.api.createCourseCheckout(telegramId).catch((error: unknown) => {
    console.error(
      "Bot course checkout API call failed",
      error instanceof Error ? error.message : error
    );
    return null;
  });
  if (!checkout) {
    await ctx.reply("Сервис временно недоступен. Попробуйте ещё раз через минуту.");
    return;
  }
  if ("alreadyPaid" in checkout) {
    await ctx.reply("Доступ уже открыт. Можно переходить к курсу.", {
      ...openCourseKeyboard(deps.miniAppUrl)
    });
    return;
  }

  await sendLessonPaymentPost(ctx, paymentKeyboard(checkout.paymentUrl, deps.miniAppUrl));
}

async function sendLessonPaymentPost(ctx: BotHandlerContext, options?: unknown) {
  if (ctx.replyWithVideo) {
    await ctx.replyWithVideo(new InputFile(LESSON_PREVIEW_VIDEO_PATH), {
      caption: LESSON_PAYMENT_MESSAGE,
      parse_mode: "HTML",
      width: 1280,
      height: 800,
      supports_streaming: true,
      ...(options ?? {})
    });
    return;
  }

  await ctx.reply(LESSON_PAYMENT_MESSAGE, options);
}

function requireTelegramId(ctx: BotHandlerContext): string {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from bot context");
  }
  return String(ctx.from.id);
}

import { InputFile } from "grammy";
import { openCourseKeyboard, paymentKeyboard, screenshotPaymentKeyboard } from "../keyboards";
import {
  BotApi,
  BotHandlerContext,
  BotPreCheckoutContext,
  BotSuccessfulPaymentContext
} from "../types";
import {
  LESSON_PAYMENT_MESSAGE,
  LESSON_PREVIEW_VIDEO_PATH,
  LESSON_TITLE,
  PAYMENT_SUCCESS_MESSAGE
} from "../content";

export async function handleBuyCourse(
  ctx: BotHandlerContext,
  deps: { api: Pick<BotApi, "createOrder">; paymentProviderToken?: string }
) {
  const telegramId = requireTelegramId(ctx);
  if (!deps.paymentProviderToken) {
    await sendLessonPaymentPost(ctx, screenshotPaymentKeyboard());
    return;
  }
  if (!ctx.api?.createInvoiceLink) {
    throw new Error("Telegram createInvoiceLink API is missing from bot context");
  }

  const order = await deps.api.createOrder(telegramId).catch((error: unknown) => {
    console.error("Bot buy_course API call failed", error instanceof Error ? error.message : error);
    return null;
  });

  if (!order) {
    await ctx.reply("Сервис временно недоступен. Попробуйте ещё раз через минуту.");
    return;
  }

  if ("alreadyPaid" in order) {
    await ctx.reply("Доступ уже открыт. Можно переходить к курсу.");
    return;
  }

  const invoiceUrl = await ctx.api
    .createInvoiceLink(
      order.title,
      order.description,
      order.invoicePayload,
      deps.paymentProviderToken,
      order.currency,
      [{ label: LESSON_TITLE, amount: order.amountKopecks }]
    )
    .catch((error: unknown) => {
      console.error(
        "Telegram createInvoiceLink failed",
        error instanceof Error ? error.message : error
      );
      return null;
    });

  if (!invoiceUrl) {
    await ctx.reply("Не удалось подготовить оплату. Попробуйте ещё раз через минуту.");
    return;
  }

  await sendLessonPaymentPost(ctx, paymentKeyboard(invoiceUrl));
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

export async function handlePreCheckout(
  ctx: BotPreCheckoutContext,
  deps: { api: Pick<BotApi, "validateTelegramInvoice"> }
) {
  const query = ctx.preCheckoutQuery;
  if (!query) {
    return;
  }

  const result = await deps.api.validateTelegramInvoice({
    orderId: query.invoice_payload,
    telegramId: String(query.from.id),
    amountKopecks: query.total_amount,
    currency: query.currency
  });

  if (result.ok) {
    await ctx.answerPreCheckoutQuery(true);
    return;
  }

  await ctx.answerPreCheckoutQuery(false, {
    error_message: result.errorMessage ?? "Не удалось подтвердить заказ"
  });
}

export async function handleSuccessfulPayment(
  ctx: BotSuccessfulPaymentContext,
  deps: { api: Pick<BotApi, "completeTelegramPayment">; miniAppUrl: string }
) {
  const telegramId = requireTelegramId(ctx);
  const payment = ctx.message?.successful_payment;
  if (!payment) {
    return;
  }

  const result = await deps.api.completeTelegramPayment({
    orderId: payment.invoice_payload,
    telegramId,
    providerPaymentChargeId: payment.provider_payment_charge_id,
    telegramPaymentChargeId: payment.telegram_payment_charge_id,
    amountKopecks: payment.total_amount,
    currency: payment.currency,
    rawPayload: payment
  });

  if (result.paid) {
    await ctx.reply(PAYMENT_SUCCESS_MESSAGE, {
      ...openCourseKeyboard(deps.miniAppUrl)
    });
  }
}

function requireTelegramId(ctx: BotHandlerContext): string {
  if (!ctx.from) {
    throw new Error("Telegram user is missing from bot context");
  }
  return String(ctx.from.id);
}

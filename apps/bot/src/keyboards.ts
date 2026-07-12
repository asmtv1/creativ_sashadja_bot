import { LESSON_TITLE } from "./content";

export function openCourseKeyboard(miniAppUrl: string) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть курс", web_app: { url: miniAppUrl } }]]
    }
  };
}

export function buyCourseKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: LESSON_TITLE, callback_data: "buy_course" }]]
    }
  };
}

export function screenshotPaymentKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "Оплатить", callback_data: "payment_setup_pending" }]]
    }
  };
}

export function paymentKeyboard(invoiceUrl: string) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "Оплатить", url: invoiceUrl }]]
    }
  };
}

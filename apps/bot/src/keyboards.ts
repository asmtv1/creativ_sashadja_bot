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
      inline_keyboard: [
        [{ text: "Смотреть урок", callback_data: "buy_course" }],
        [{ text: "Попасть в канал с идеями", callback_data: "channel_subscription" }]
      ]
    }
  };
}

export function channelTermsKeyboard(publicBaseUrl: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Принять условия и перейти к оплате", callback_data: "channel_checkout" }],
        [
          { text: "Публичная оферта", url: new URL("/legal/offer", publicBaseUrl).href },
          { text: "Конфиденциальность", url: new URL("/legal/privacy", publicBaseUrl).href }
        ]
      ]
    }
  };
}
export function paymentUrlKeyboard(url: string) { return { reply_markup: { inline_keyboard: [[{ text: "Оплатить через СБП", url }]] } }; }
export function subscriptionKeyboard(autoRenew: boolean) {
  if (!autoRenew) {
    return undefined;
  }
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "Остановить продление", callback_data: "channel_cancel_confirm" }]]
    }
  };
}

export function paymentKeyboard(paymentUrl: string, publicBaseUrl: string) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Принять условия и перейти к оплате", url: paymentUrl }],
        [
          { text: "Публичная оферта", url: new URL("/legal/offer", publicBaseUrl).href },
          { text: "Конфиденциальность", url: new URL("/legal/privacy", publicBaseUrl).href }
        ]
      ]
    }
  };
}

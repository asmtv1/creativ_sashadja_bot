export function getTelegramInitData(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.Telegram?.WebApp.initData || null;
}

export function prepareTelegramWebApp() {
  window.Telegram?.WebApp.ready();
  window.Telegram?.WebApp.expand();
}

export function openExternalUrl(url: string) {
  if (window.Telegram?.WebApp.openLink) {
    window.Telegram.WebApp.openLink(url);
    return;
  }
  window.location.href = url;
}

export type TelegramInvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export function openTelegramInvoice(url: string): Promise<TelegramInvoiceStatus> {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.openInvoice) {
    return Promise.reject(new Error("Оплата доступна только внутри Telegram"));
  }

  return new Promise((resolve, reject) => {
    try {
      webApp.openInvoice?.(url, resolve);
    } catch {
      reject(new Error("Не удалось открыть оплату в Telegram"));
    }
  });
}

export function requestTelegramFullscreen() {
  window.Telegram?.WebApp.requestFullscreen?.();
}

export function exitTelegramFullscreen() {
  window.Telegram?.WebApp.exitFullscreen?.();
}

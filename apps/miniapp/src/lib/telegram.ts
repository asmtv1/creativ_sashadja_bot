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

export function closeTelegramWebApp() {
  window.Telegram?.WebApp.close();
}

export function requestTelegramFullscreen() {
  window.Telegram?.WebApp.requestFullscreen?.();
}

export function exitTelegramFullscreen() {
  window.Telegram?.WebApp.exitFullscreen?.();
}

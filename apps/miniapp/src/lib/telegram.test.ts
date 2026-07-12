import { afterEach, describe, expect, it, vi } from "vitest";
import { openTelegramInvoice } from "./telegram";

afterEach(() => {
  delete window.Telegram;
});

describe("openTelegramInvoice", () => {
  it("opens the native Telegram invoice and resolves its status", async () => {
    const openInvoice = vi.fn((_url: string, callback?: (status: "paid") => void) => {
      callback?.("paid");
    });
    window.Telegram = {
      WebApp: {
        initData: "",
        ready: vi.fn(),
        expand: vi.fn(),
        openInvoice,
        openLink: vi.fn(),
        close: vi.fn()
      }
    };

    await expect(openTelegramInvoice("https://t.me/$invoice")).resolves.toBe("paid");
    expect(openInvoice).toHaveBeenCalledWith("https://t.me/$invoice", expect.any(Function));
  });

  it("explains when checkout is opened outside Telegram", async () => {
    await expect(openTelegramInvoice("https://t.me/$invoice")).rejects.toThrow(
      "Оплата доступна только внутри Telegram"
    );
  });
});

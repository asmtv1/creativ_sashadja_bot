import { describe, expect, it, vi } from "vitest";
import { runOutboxBatch } from "./outbox-worker";

describe("runOutboxBatch", () => {
  it("marks outbox items sent after successful Telegram delivery", async () => {
    const api = {
      getOutbox: vi.fn(async () => [
        { id: "out_1", telegramId: "42", type: "PAYMENT_SUCCEEDED" as const, payload: {} }
      ]),
      markOutboxSent: vi.fn(),
      markOutboxFailed: vi.fn()
    };
    const telegram = { sendMessage: vi.fn(async () => undefined) };

    await runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" });

    expect(telegram.sendMessage).toHaveBeenCalledWith(
      "42",
      expect.stringContaining("Урок успешно оплачен"),
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть курс", web_app: { url: "https://course.example.com" } }]]
        }
      }
    );
    expect(api.markOutboxSent).toHaveBeenCalledWith("out_1");
    expect(api.markOutboxFailed).not.toHaveBeenCalled();
  });

  it("marks outbox items failed and delegates retry scheduling to the API", async () => {
    const api = {
      getOutbox: vi.fn(async () => [
        { id: "out_1", telegramId: "42", type: "PAYMENT_SUCCEEDED" as const, payload: {} }
      ]),
      markOutboxSent: vi.fn(),
      markOutboxFailed: vi.fn()
    };
    const telegram = { sendMessage: vi.fn(async () => Promise.reject(new Error("telegram down"))) };

    await runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" });

    expect(api.markOutboxFailed).toHaveBeenCalledWith("out_1", "telegram down");
  });

  it("does not crash polling when the API is temporarily unavailable", async () => {
    const api = {
      getOutbox: vi.fn(async () => Promise.reject(new Error("api down"))),
      markOutboxSent: vi.fn(),
      markOutboxFailed: vi.fn()
    };
    const telegram = { sendMessage: vi.fn(async () => undefined) };

    await expect(runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" })).resolves.toBeUndefined();
    expect(telegram.sendMessage).not.toHaveBeenCalled();
  });
});

it("delivers the paid channel link instead of course payment instructions", async () => {
  const api = {
    getOutbox: vi.fn(async () => [{ id: "invite_1", telegramId: "42", type: "CHANNEL_INVITE" as const, payload: { title: "Креатив идеи", inviteLink: "https://t.me/+test" } }]),
    markOutboxSent: vi.fn(), markOutboxFailed: vi.fn(),
  };
  const telegram = { sendMessage: vi.fn() };
  await runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" });
  expect(telegram.sendMessage).toHaveBeenCalledWith("42", expect.stringContaining("одноразовой ссылке: https://t.me/+test"));
  expect(api.markOutboxSent).toHaveBeenCalledWith("invite_1");
});


describe("channel subscription notifications", () => {
  const end = "2020-10-15T00:00:00.000Z";
  it("delivers an expired notice with a resubscribe button", async () => {
    const recentEnd = new Date(Date.now() - 60_000).toISOString();
    const api = {
      getOutbox: vi.fn(async () => [{ id: "notice", telegramId: "42", type: "CHANNEL_SUBSCRIPTION_EXPIRED" as const, payload: { periodEnd: recentEnd } }]),
      getChannelSubscription: vi.fn(async () => ({ activeUntil: recentEnd, autoRenew: false, nextChargeAt: null, amountKopecks: 39000, currency: "RUB" })),
      markOutboxSent: vi.fn(), markOutboxFailed: vi.fn(),
    };
    const telegram = { sendMessage: vi.fn() };
    await runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" });
    expect(telegram.sendMessage).toHaveBeenCalledWith("42", expect.stringContaining("Оплаченный период подписки закончился"),
      { reply_markup: { inline_keyboard: [[{ text: "Оформить подписку снова", callback_data: "channel_reactivate" }]] } });
    expect(api.markOutboxSent).toHaveBeenCalledWith("notice");
  });

  it("suppresses stale notification when a subscription was renewed", async () => {
    const api = { getOutbox: vi.fn(async () => [{ id: "old-notice", telegramId: "42", type: "CHANNEL_SUBSCRIPTION_EXPIRED" as const, payload: { periodEnd: end } }]),
      getChannelSubscription: vi.fn(async () => ({ activeUntil: "2026-11-20T00:00:00.000Z", autoRenew: true, nextChargeAt: null, amountKopecks: 39000, currency: "RUB" })),
      markOutboxSent: vi.fn(), markOutboxFailed: vi.fn() };
    const telegram = { sendMessage: vi.fn() };
    await runOutboxBatch({ api, telegram, miniAppUrl: "https://course.example.com" });
    expect(telegram.sendMessage).not.toHaveBeenCalled();
    expect(api.markOutboxSent).toHaveBeenCalledWith("old-notice");
  });
});

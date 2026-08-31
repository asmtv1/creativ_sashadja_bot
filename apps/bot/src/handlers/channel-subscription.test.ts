import { describe, expect, it, vi } from "vitest";
import { handleChannelEntry, handleStopRenewal, handleSubscriptionStatus } from "./channel-subscription";

function createContext() {
  const replies: Array<{ text: string; options?: unknown }> = [];
  return {
    from: { id: 42 },
    replies,
    reply: vi.fn(async (text: string, options?: unknown) => {
      replies.push({ text, options });
    })
  };
}

const activeStatus = {
  status: "ACTIVE" as const,
  activeUntil: "2026-09-30T09:00:00.000Z",
  nextChargeAt: "2026-09-30T05:00:00.000Z",
  autoRenew: true,
  amountKopecks: 39000,
  currency: "RUB"
};

describe("channel subscription controls", () => {
  it("shows the offer and privacy policy before checkout", async () => {
    const ctx = createContext();
    await handleChannelEntry(
      ctx as any,
      { getChannelSubscription: vi.fn(async () => ({ ...activeStatus, activeUntil: null })) },
      "https://course.example.com"
    );

    expect(ctx.replies.at(-1)?.options).toMatchObject({
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Публичная оферта", url: "https://course.example.com/legal/offer" },
            { text: "Конфиденциальность", url: "https://course.example.com/legal/privacy" }
          ],
          [{ text: "Принимаю условия и перейти к оплате", callback_data: "channel_checkout" }]
        ]
      }
    });
  });

  it("shows an explicit stop-renewal button to an active subscriber", async () => {
    const ctx = createContext();
    await handleSubscriptionStatus(ctx as any, {
      getChannelSubscription: vi.fn(async () => activeStatus)
    });

    expect(ctx.replies.at(-1)?.text).toContain("списание будет только через СБП");
    expect(ctx.replies.at(-1)?.options).toMatchObject({
      reply_markup: {
        inline_keyboard: [[{ text: "Остановить продление", callback_data: "channel_cancel_confirm" }]]
      }
    });
  });

  it("stops renewal through the API and confirms that the saved method was removed", async () => {
    const ctx = createContext();
    const stopChannelRenewal = vi.fn(async () => undefined);

    await handleStopRenewal(ctx as any, { stopChannelRenewal });

    expect(stopChannelRenewal).toHaveBeenCalledWith("42");
    expect(ctx.replies.at(-1)?.text).toContain("Сохранённый способ оплаты удалён");
  });
});

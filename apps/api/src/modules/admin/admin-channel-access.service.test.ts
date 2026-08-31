import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminChannelAccessService } from "./admin-channel-access.service";

afterEach(() => vi.unstubAllGlobals());

describe("AdminChannelAccessService", () => {
  it("creates a one-time Telegram invite and records manually granted channel access", async () => {
    const fetchMock = vi
      .fn<(input: string, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: true,
            result: { invite_link: "https://t.me/+one-time" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const prisma = {
      telegramUser: {
        findUnique: vi.fn(async () => ({ id: "user_1", telegramId: "42" })),
      },
      channelProduct: {
        findUnique: vi.fn(async () => ({
          id: "product_1",
          slug: "creative-ideas",
          title: "Креатив идеи",
          telegramChatId: "-1001",
          periodDays: 30,
        })),
      },
      channelSubscription: {
        upsert: vi.fn(async () => ({ id: "subscription_1" })),
      },
      channelInvite: { create: vi.fn(async () => undefined) },
      channelMembership: { upsert: vi.fn(async () => undefined) },
      adminAuditLog: { create: vi.fn(async () => undefined) },
      $transaction: vi.fn(async (operations) => Promise.all(operations)),
    };
    const service = new AdminChannelAccessService(
      prisma as any,
      {
        get: (key: string) =>
          key === "TELEGRAM_BOT_TOKEN" ? "bot-token" : undefined,
      } as any,
    );

    const result = await service.grant("42", "admin");

    expect(result.inviteLink).toBe("https://t.me/+one-time");
    expect(prisma.channelSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          autoRenew: false,
          paymentMethodId: null,
          status: "ACTIVE",
        }),
      }),
    );
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "https://api.telegram.org/botbot-token/createChatInviteLink",
      "https://api.telegram.org/botbot-token/sendMessage",
    ]);
  });
});

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
        findUnique: vi.fn(async () => null),
      },
      channelRemovalTask: { updateMany: vi.fn(async () => undefined) },
      $queryRaw: vi.fn(async () => []),
      channelInvite: { create: vi.fn(async () => undefined) },
      channelMembership: { upsert: vi.fn(async () => undefined) },
      adminAuditLog: { create: vi.fn(async () => undefined) },
      $transaction: vi.fn(async (operations) => typeof operations === "function" ? operations(prisma) : Promise.all(operations)),
    };
    const service = new AdminChannelAccessService(
      prisma as any,
      {
        get: (key: string) =>
          key === "TELEGRAM_BOT_TOKEN" ? "bot-token" : undefined,
      } as any,
      {} as any,
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

describe("manual channel revocation confirmation", () => {
  function setup(source: "MANUAL" | "EXEMPT" = "MANUAL") {
    const subscription = {
      id: "sub1", userId: "user1", user: { telegramId: "42" },
      product: { slug: "creative-ideas", telegramChatId: "-100" },
      membership: { source }, invites: [{ id: "invite1", inviteLink: "https://t.me/+invite" }],
    };
    const tx = {
      $queryRaw: vi.fn(async () => []),
      channelSubscription: { findUniqueOrThrow: vi.fn(async () => subscription), update: vi.fn(async () => ({})) },
      channelInvite: { updateMany: vi.fn(async () => ({})) },
      channelMembership: { upsert: vi.fn(async () => ({})) },
      channelRemovalTask: { upsert: vi.fn(async () => ({})) },
      adminAuditLog: { create: vi.fn(async () => ({})) },
    };
    const prisma = {
      channelSubscription: { findFirst: vi.fn(async () => ({ id: "sub1" })) },
      $transaction: vi.fn(async (run: any) => run(tx)),
    };
    const telegram = {
      getMember: vi.fn(async () => ({ status: "member" })),
      revokeInvite: vi.fn(async () => undefined),
      removeAndConfirm: vi.fn(async () => "REMOVED"),
    };
    return { service: new AdminChannelAccessService(prisma as any, {} as any, telegram as any), tx, telegram };
  }

  it("blocks EXEMPT before requesting Telegram removal", async () => {
    const { service, tx, telegram } = setup("EXEMPT");
    await expect(service.revoke("42", "admin")).rejects.toThrow("EXEMPT");
    expect(telegram.getMember).not.toHaveBeenCalled();
    expect(tx.channelSubscription.update).not.toHaveBeenCalled();
  });

  it("blocks Telegram owner and administrator without editing subscription", async () => {
    for (const status of ["creator", "administrator"]) {
      const { service, tx, telegram } = setup();
      telegram.getMember.mockResolvedValue({ status });
      await expect(service.revoke("42", "admin")).rejects.toThrow("administrator");
      expect(tx.channelSubscription.update).not.toHaveBeenCalled();
      expect(telegram.removeAndConfirm).not.toHaveBeenCalled();
    }
  });

  it("surfaces Telegram failures rather than falsely storing a successful revoke", async () => {
    const { service, tx, telegram } = setup();
    telegram.removeAndConfirm.mockRejectedValue(new Error("Telegram 403"));
    await expect(service.revoke("42", "admin")).rejects.toThrow("Telegram 403");
    expect(tx.channelSubscription.update).not.toHaveBeenCalled();
    expect(tx.channelMembership.upsert).not.toHaveBeenCalled();
    expect(tx.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("persists manual revocation only after confirmed removal", async () => {
    const { service, tx, telegram } = setup();
    await service.revoke("42", "admin");
    expect(telegram.revokeInvite).toHaveBeenCalledTimes(1);
    expect(telegram.removeAndConfirm).toHaveBeenCalledTimes(1);
    expect(tx.channelSubscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED" }) }));
    expect(tx.channelRemovalTask.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: "REMOVED" }) }));
    expect(tx.adminAuditLog.create).toHaveBeenCalledTimes(1);
  });
});

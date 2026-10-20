import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelInvitesService } from "./channel-invites.service";

function setup() {
  const payment = { id: "payment", kind: "INITIAL", status: "SUCCEEDED", subscription: {
    id: "sub", status: "ACTIVE", periodEnd: new Date(Date.now() + 30 * 86400000),
    product: { telegramChatId: "-100123", title: "Креатив идеи" }, user: { telegramId: "42" },
  } };
  let queued: unknown = null;
  const tx = {
    $queryRaw: vi.fn(),
    botOutbox: { findUnique: vi.fn(async () => queued), create: vi.fn(async (args) => { queued = args.data; }) },
    channelPayment: { findUnique: vi.fn(async () => payment) },
    channelInvite: { create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (fn) => fn(tx)) };
  const service = new ChannelInvitesService(prisma as any);
  const telegram = vi.spyOn(service as any, "telegramRequest").mockResolvedValue({ invite_link: "https://t.me/+test" });
  return { service, tx, payment, telegram };
}

afterEach(() => vi.restoreAllMocks());
describe("Paid channel invitations", () => {
  it("creates a single-use invite and durable delivery job only once on duplicate callbacks", async () => {
    const { service, tx, telegram } = setup();
    await service.queueInvite("payment");
    await service.queueInvite("payment");
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(telegram).toHaveBeenCalledWith("createChatInviteLink", expect.objectContaining({ member_limit: 1, chat_id: "-100123" }));
    expect(tx.botOutbox.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: "payment", telegramId: "42", type: "CHANNEL_INVITE", payload: expect.objectContaining({ inviteLink: "https://t.me/+test" }) }) });
  });
  it("retries invite creation after Telegram failure without recording a delivery", async () => {
    const { service, telegram, tx } = setup();
    telegram.mockRejectedValueOnce(new Error("unavailable"));
    await expect(service.queueInvite("payment")).rejects.toThrow("unavailable");
    expect(tx.botOutbox.create).not.toHaveBeenCalled();
    await service.queueInvite("payment");
    expect(tx.botOutbox.create).toHaveBeenCalledTimes(1);
  });
  it.each(["PENDING", "REFUNDED"])("never grants access for %s payment", async (status) => {
    const { service, payment, telegram } = setup();
    payment.status = status;
    await service.queueInvite("payment");
    expect(telegram).not.toHaveBeenCalled();
  });
  it("does not create links for expired access or renewals", async () => {
    const { service, payment, telegram } = setup();
    payment.subscription.periodEnd = new Date(0);
    await service.queueInvite("payment");
    payment.subscription.periodEnd = new Date(Date.now() + 86400000);
    payment.kind = "RENEWAL";
    await service.queueInvite("payment");
    expect(telegram).not.toHaveBeenCalled();
  });
  it("sends a rejoin invitation for a successful renewal after confirmed removal", async () => {
    const { service, payment, telegram, tx } = setup();
    Object.assign(payment, { kind: "RENEWAL", rejoinInviteRequired: true });
    await service.queueInvite("payment");
    expect(telegram).toHaveBeenCalledTimes(1);
    expect(tx.botOutbox.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "CHANNEL_INVITE" }) }));
  });

  it("leaves an unbound channel recoverable", async () => {
    const { service, payment, telegram } = setup();
    payment.subscription.product.telegramChatId = null as any;
    await expect(service.queueInvite("payment")).rejects.toThrow("not bound");
    expect(telegram).not.toHaveBeenCalled();
  });
});

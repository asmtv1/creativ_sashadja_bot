import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelTelegramMembersService } from "./channel-telegram-members.service";

afterEach(() => vi.unstubAllGlobals());
function make() { return new ChannelTelegramMembersService({ get: () => "bot-token" } as any); }
const okay = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

describe("Telegram removal confirmation", () => {
  it("never bans an administrator or owner and treats departed members as not needing removal", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const tg = make();
    for (const status of ["creator", "administrator"] as const) {
      await expect(tg.removeAndConfirm("-100", "42", { status })).rejects.toThrow("Protected");
    }
    expect(await tg.removeAndConfirm("-100", "42", { status: "left" })).toBe("ALREADY_LEFT");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bans, unbans, verifies departed state in that order", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okay(true)).mockResolvedValueOnce(okay(true)).mockResolvedValueOnce(okay({ status: "left" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await make().removeAndConfirm("-100", "42", { status: "member" })).toBe("REMOVED");
    expect(fetchMock.mock.calls.map(([url]) => String(url).split("/").at(-1))).toEqual(["banChatMember", "unbanChatMember", "getChatMember"]);
  });

  it("recovers interrupted removal from Telegram kicked state without another ban", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okay(true)).mockResolvedValueOnce(okay({ status: "left" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await make().removeAndConfirm("-100", "42", { status: "kicked" })).toBe("REMOVED");
    expect(fetchMock.mock.calls.map(([url]) => String(url).split("/").at(-1))).toEqual(["unbanChatMember", "getChatMember"]);
  });

  it("refuses to confirm when Telegram still reports a member or errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(okay(true)).mockResolvedValueOnce(okay(true)).mockResolvedValueOnce(okay({ status: "member" })));
    await expect(make().removeAndConfirm("-100", "42", { status: "member" })).rejects.toThrow("did not confirm");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: false, error_code: 403 }), { status: 403 })));
    await expect(make().getMember("-100", "42")).rejects.toThrow("403");
  });
});

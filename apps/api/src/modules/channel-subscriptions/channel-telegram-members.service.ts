import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type ChannelMember = {
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  is_member?: boolean;
};

@Injectable()
export class ChannelTelegramMembersService {
  constructor(private readonly config: ConfigService) {}

  async getMember(chatId: string, telegramId: string): Promise<ChannelMember> {
    const member = await this.request<ChannelMember>("getChatMember", { chat_id: chatId, user_id: telegramId });
    if (!member || !["creator", "administrator", "member", "restricted", "left", "kicked"].includes(member.status)) {
      throw new ServiceUnavailableException("Telegram returned an unknown member status");
    }
    return member;
  }

  async getMemberCount(chatId: string): Promise<number> {
    const count = await this.request<number>("getChatMemberCount", { chat_id: chatId });
    if (!Number.isInteger(count) || count < 0) {
      throw new ServiceUnavailableException("Telegram returned an invalid member count");
    }
    return count;
  }

  async removeAndConfirm(chatId: string, telegramId: string, member: ChannelMember): Promise<"REMOVED" | "ALREADY_LEFT"> {
    if (member.status === "creator" || member.status === "administrator") {
      throw new ServiceUnavailableException("Protected channel administrator");
    }
    if (member.status === "left" || (member.status === "restricted" && member.is_member === false)) return "ALREADY_LEFT";
    // A previous attempt may have banned successfully and failed to unban.
    if (member.status !== "kicked") {
      await this.request("banChatMember", { chat_id: chatId, user_id: telegramId });
    }
    await this.request("unbanChatMember", { chat_id: chatId, user_id: telegramId, only_if_banned: true });
    const confirmed = await this.getMember(chatId, telegramId);
    if (confirmed.status !== "left") {
      throw new ServiceUnavailableException("Telegram did not confirm that membership ended");
    }
    return "REMOVED";
  }

  async revokeInvite(chatId: string, inviteLink: string) {
    await this.request("revokeChatInviteLink", { chat_id: chatId, invite_link: inviteLink });
  }

  private async request<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = this.config.get<string>("TELEGRAM_BOT_TOKEN");
    if (!token) throw new ServiceUnavailableException("Telegram bot is not configured");
    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new ServiceUnavailableException("Telegram request unavailable");
    }
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (method === "revokeChatInviteLink" && response.status === 400 &&
        /invite.*(invalid|expired|revoked)|INVITE_HASH_(INVALID|EXPIRED)/i.test(payload.description ?? "")) {
      // Telegram confirms the old invitation is no longer usable. This allows
      // retry after a crash between remote revocation and DB commit.
      return true as T;
    }
    if (!response.ok || !payload.ok || payload.result === undefined) {
      // Never persist the raw provider response (it may contain sensitive information).
      throw new ServiceUnavailableException(`Telegram ${method} failed (${response.status || payload.error_code || "unknown"})`);
    }
    return payload.result;
  }
}

import { describe, expect, it, vi } from "vitest";
import { syncBotMenuButton } from "./menu-button";

describe("syncBotMenuButton", () => {
  it("points the persistent Telegram menu button at the production Mini App", async () => {
    const setChatMenuButton = vi.fn().mockResolvedValue(true);

    await syncBotMenuButton({ setChatMenuButton } as never, "https://sasha.gafus.ru");

    expect(setChatMenuButton).toHaveBeenCalledWith({
      menu_button: {
        type: "web_app",
        text: "Открыть курс",
        web_app: { url: "https://sasha.gafus.ru" }
      }
    });
  });
});

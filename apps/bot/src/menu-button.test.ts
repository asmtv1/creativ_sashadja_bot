import { describe, expect, it, vi } from "vitest";
import { syncBotMenuButton } from "./menu-button";

describe("syncBotMenuButton", () => {
  it("replaces the course shortcut with commands for both products and support", async () => {
    const setChatMenuButton = vi.fn().mockResolvedValue(true);
    const setMyCommands = vi.fn().mockResolvedValue(true);

    await syncBotMenuButton({ setChatMenuButton, setMyCommands } as never);

    expect(setMyCommands).toHaveBeenCalledWith([
        { command: "start", description: "Урок и канал с идеями" },
        { command: "subscription", description: "Моя подписка на канал" },
        { command: "support", description: "Поддержка" },
        { command: "paysupport", description: "Помощь с оплатой" },
        { command: "terms", description: "Публичная оферта" },
        { command: "privacy", description: "Конфиденциальность" }
    ]);
    expect(setChatMenuButton).toHaveBeenCalledWith({
      menu_button: {
        type: "commands"
      }
    });
  });
});

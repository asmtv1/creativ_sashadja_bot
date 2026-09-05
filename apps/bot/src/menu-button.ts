import { Api } from "grammy";

export async function syncBotMenuButton(
  telegram: Pick<Api, "setChatMenuButton" | "setMyCommands">
) {
  await telegram.setMyCommands([
      { command: "start", description: "Урок и канал с идеями" },
      { command: "subscription", description: "Моя подписка на канал" },
      { command: "support", description: "Поддержка" },
      { command: "paysupport", description: "Помощь с оплатой" },
      { command: "terms", description: "Публичная оферта" },
      { command: "privacy", description: "Конфиденциальность" }
  ]);
  await telegram.setChatMenuButton({
    menu_button: {
      type: "commands"
    }
  });
}

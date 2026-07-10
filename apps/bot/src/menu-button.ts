import { Api } from "grammy";

export async function syncBotMenuButton(
  telegram: Pick<Api, "setChatMenuButton">,
  miniAppUrl: string
) {
  await telegram.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "Открыть курс",
      web_app: { url: miniAppUrl }
    }
  });
}

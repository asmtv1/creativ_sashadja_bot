import { Api } from "grammy";
import { InternalApiClient } from "./api/client";
import { createCourseBot } from "./bot";
import { loadConfig } from "./config";
import { syncBotMenuButton } from "./menu-button";
import { runOutboxBatch } from "./outbox-worker";
import { startWebhookServer } from "./webhook-server";

const config = loadConfig();
const api = new InternalApiClient({
  apiBaseUrl: config.API_BASE_URL,
  internalToken: config.INTERNAL_API_TOKEN,
  courseSlug: config.COURSE_SLUG
});
const bot = createCourseBot({
  token: config.TELEGRAM_BOT_TOKEN,
  api,
  miniAppUrl: config.PUBLIC_BASE_URL
});

await syncBotMenuButton(bot.api);
startOutboxWorker(api, bot.api);

if (config.BOT_MODE === "webhook") {
  const webhookUrl = new URL("/telegram/webhook", config.PUBLIC_BASE_URL).href;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query", "channel_post", "chat_member", "chat_join_request"]
  });
  await startWebhookServer({
    bot,
    port: config.PORT,
    secretToken: config.TELEGRAM_WEBHOOK_SECRET
  });
} else {
  void bot.start();
}

function startOutboxWorker(internalApi: InternalApiClient, telegram: Api) {
  setInterval(() => {
    void runOutboxBatch({
      api: internalApi,
      miniAppUrl: config.PUBLIC_BASE_URL,
      telegram: {
        sendMessage: async (telegramId, text, options) => {
          await telegram.sendMessage(telegramId, text, options);
        }
      }
    });
  }, 5_000);
}

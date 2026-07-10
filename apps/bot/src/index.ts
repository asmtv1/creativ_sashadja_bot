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
  miniAppUrl: config.PUBLIC_BASE_URL,
  paymentProviderToken: config.TELEGRAM_PAYMENT_PROVIDER_TOKEN
});

await syncBotMenuButton(bot.api, config.PUBLIC_BASE_URL);
startOutboxWorker(api, bot.api);

if (config.BOT_MODE === "webhook") {
  const webhookUrl = new URL("/telegram/webhook", config.PUBLIC_BASE_URL).href;
  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query", "pre_checkout_query"]
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
      telegram: {
        sendMessage: async (telegramId, text) => {
          await telegram.sendMessage(telegramId, text);
        }
      }
    });
  }, 5_000);
}

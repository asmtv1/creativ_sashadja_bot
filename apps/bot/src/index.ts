import { Api } from "grammy";
import { InternalApiClient } from "./api/client";
import { createCourseBot } from "./bot";
import { loadConfig } from "./config";
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

startOutboxWorker(api, bot.api);

if (config.BOT_MODE === "webhook") {
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

import { createServer } from "node:http";
import { Bot } from "grammy";

export async function startWebhookServer(options: {
  bot: Pick<Bot, "handleUpdate" | "init">;
  port: number;
  secretToken?: string;
}) {
  await options.bot.init();

  const server = createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    if (request.method !== "POST" || request.url !== "/telegram/webhook") {
      response.writeHead(404);
      response.end();
      return;
    }

    if (
      options.secretToken &&
      request.headers["x-telegram-bot-api-secret-token"] !== options.secretToken
    ) {
      response.writeHead(401);
      response.end();
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const update = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    await options.bot.handleUpdate(update);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });

  await new Promise<void>((resolve) => {
    server.listen(options.port, "0.0.0.0", resolve);
  });
  return server;
}

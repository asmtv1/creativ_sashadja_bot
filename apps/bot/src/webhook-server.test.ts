import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { startWebhookServer } from "./webhook-server";

describe("startWebhookServer", () => {
  const servers: Array<{ close(callback?: (error?: Error) => void): void }> = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error?: Error) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          })
      )
    );
    servers.length = 0;
  });

  it("initializes the bot before accepting webhook updates", async () => {
    let initialized = false;
    const bot = {
      init: vi.fn(async () => {
        initialized = true;
      }),
      handleUpdate: vi.fn(async () => {
        if (!initialized) {
          throw new Error("bot was not initialized");
        }
      })
    };

    const server = await startWebhookServer({
      bot,
      port: 0,
      secretToken: "secret"
    });
    servers.push(server);
    await waitForListening(server);

    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/telegram/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "secret"
      },
      body: JSON.stringify({ update_id: 1 })
    });

    expect(response.status).toBe(200);
    expect(bot.init).toHaveBeenCalledOnce();
    expect(bot.handleUpdate).toHaveBeenCalledWith({ update_id: 1 });
  });
});

async function waitForListening(server: { listening: boolean; once(event: string, listener: () => void): void }) {
  if (server.listening) {
    return;
  }
  await new Promise<void>((resolve) => {
    server.once("listening", resolve);
  });
}

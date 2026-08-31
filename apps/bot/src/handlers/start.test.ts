import { describe, expect, it, vi } from "vitest";
import { handleStart } from "./start";
import { BotHandlerContext } from "../types";

function createContext(): BotHandlerContext & {
  replies: Array<{ text: string; options?: unknown }>;
  photos: Array<{ photo: unknown; options?: unknown }>;
} {
  return {
    from: {
      id: 42,
      username: "student",
      first_name: "Ivan",
      last_name: "Petrov",
      language_code: "ru"
    },
    replies: [],
    photos: [],
    async reply(text: string, options?: unknown) {
      this.replies.push({ text, options });
    },
    async replyWithPhoto(photo: unknown, options?: unknown) {
      this.photos.push({ photo, options });
    }
  };
}

describe("handleStart", () => {
  it("always shows the welcome image and both product choices", async () => {
    const ctx = createContext();
    await handleStart(ctx, {
      api: {
        upsertBotUser: vi.fn()
      },
      miniAppUrl: "https://course.example.com"
    });

    expect(JSON.stringify(ctx.photos.at(-1)?.options)).toContain("Смотреть урок");
    expect(JSON.stringify(ctx.photos.at(-1)?.options)).toContain("Попасть в канал с идеями");
  });

  it("shows the buy button when the user has no access", async () => {
    const ctx = createContext();
    await handleStart(ctx, {
      api: {
        upsertBotUser: vi.fn()
      },
      miniAppUrl: "https://course.example.com"
    });

    expect(ctx.photos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Меня зовут Саша Черезова"),
      parse_mode: "HTML"
    });
    expect(JSON.stringify(ctx.photos.at(-1)?.options)).toContain("Смотреть урок");
  });

  it("does not crash /start when the API is temporarily unavailable", async () => {
    const ctx = createContext();
    await expect(
      handleStart(ctx, {
        api: {
          upsertBotUser: vi.fn(async () => Promise.reject(new Error("api down")))
        },
        miniAppUrl: "https://course.example.com"
      })
    ).resolves.toBeUndefined();

    expect(ctx.photos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Меня зовут Саша Черезова"),
      parse_mode: "HTML"
    });
    expect(JSON.stringify(ctx.photos.at(-1)?.options)).toContain("Попасть в канал с идеями");
  });
});

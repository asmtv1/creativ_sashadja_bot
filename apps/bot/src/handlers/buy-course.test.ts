import { describe, expect, it, vi } from "vitest";
import { handleBuyCourse } from "./buy-course";
import { BotHandlerContext } from "../types";

function createContext(): BotHandlerContext & {
  replies: Array<{ text: string; options?: unknown }>;
  videos: Array<{ video: unknown; options?: unknown }>;
} {
  return {
    from: { id: 42, first_name: "Ivan" },
    replies: [],
    videos: [],
    async reply(text: string, options?: unknown) {
      this.replies.push({ text, options });
    },
    async replyWithVideo(video: unknown, options?: unknown) {
      this.videos.push({ video, options });
    }
  } as BotHandlerContext & {
    replies: Array<{ text: string; options?: unknown }>;
    videos: Array<{ video: unknown; options?: unknown }>;
  };
}

describe("buy course handlers", () => {
  it("attaches a direct SBP YooKassa payment button to the lesson post", async () => {
    const ctx = createContext();
    const createCourseCheckout = vi.fn(async () => ({
      orderId: "order_1",
      paymentUrl: "https://yookassa.example/confirm"
    }));

    await handleBuyCourse(ctx, {
      miniAppUrl: "https://course.example.com",
      api: {
        getCourseAccess: vi.fn(async () => ({ hasAccess: false })),
        createCourseCheckout
      }
    });

    expect(createCourseCheckout).toHaveBeenCalledWith("42");
    expect(ctx.videos.at(-1)?.options).toMatchObject({
      caption: expect.stringContaining("Всё об уроке"),
      parse_mode: "HTML",
      width: 1280,
      height: 800,
      supports_streaming: true,
      reply_markup: {
        inline_keyboard: [[{ text: "Оплатить через СБП", url: "https://yookassa.example/confirm" }]]
      }
    });
  });

  it("opens the course rather than creating another payment for an existing student", async () => {
    const ctx = createContext();
    const createCourseCheckout = vi.fn();

    await handleBuyCourse(ctx, {
      miniAppUrl: "https://course.example.com",
      api: {
        getCourseAccess: vi.fn(async () => ({ hasAccess: true })),
        createCourseCheckout
      }
    });

    expect(createCourseCheckout).not.toHaveBeenCalled();
    expect(JSON.stringify(ctx.replies.at(-1)?.options)).toContain("web_app");
  });
});

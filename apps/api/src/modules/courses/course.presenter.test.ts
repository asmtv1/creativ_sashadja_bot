import { describe, expect, it } from "vitest";
import { buildCourseAccessResponse } from "./course.presenter";

describe("course presenter", () => {
  it("does not expose Kinescope embed URLs when the user has no access", () => {
    const response = buildCourseAccessResponse({
      hasAccess: false,
      course: { slug: "basic", title: "Basic", description: "Intro", priceKopecks: 10000 },
      lessons: [
        {
          slug: "lesson-1",
          sortOrder: 1,
          title: "Lesson",
          description: null,
          durationSeconds: 120,
          kinescopeEmbedUrl: "https://kinescope.io/embed/secret",
          posterUrl: null
        }
      ]
    });

    expect(response.hasAccess).toBe(false);
    expect(response.lessons).toBeUndefined();
  });

  it("exposes lesson embed URLs only when access exists", () => {
    const response = buildCourseAccessResponse({
      hasAccess: true,
      course: { slug: "basic", title: "Basic", description: "Intro", priceKopecks: 10000 },
      lessons: [
        {
          slug: "lesson-1",
          sortOrder: 1,
          title: "Lesson",
          description: null,
          durationSeconds: 120,
          kinescopeEmbedUrl: "https://kinescope.io/embed/secret",
          posterUrl: null
        }
      ]
    });

    expect(response.lessons?.[0]?.kinescopeEmbedUrl).toBe("https://kinescope.io/embed/secret");
  });

  it("adds a stable Telegram identifier to Kinescope embed URLs", () => {
    const response = buildCourseAccessResponse({
      hasAccess: true,
      course: { slug: "basic", title: "Basic", description: "Intro", priceKopecks: 10000 },
      lessons: [
        {
          slug: "lesson-1",
          sortOrder: 1,
          title: "Lesson",
          description: null,
          durationSeconds: 120,
          kinescopeEmbedUrl: "https://kinescope.io/embed/secret?autoplay=1",
          posterUrl: null
        }
      ],
      viewer: { telegramId: "123456", username: "ivan" }
    });

    const embedUrl = new URL(response.lessons?.[0]?.kinescopeEmbedUrl ?? "");
    expect(embedUrl.searchParams.get("autoplay")).toBe("1");
    expect(embedUrl.searchParams.get("watermark")).toBe("Telegram: @ivan · ID: 123456");
  });

  it("uses the Telegram ID when a viewer has no username", () => {
    const response = buildCourseAccessResponse({
      hasAccess: true,
      course: { slug: "basic", title: "Basic", description: "Intro", priceKopecks: 10000 },
      lessons: [
        {
          slug: "lesson-1",
          sortOrder: 1,
          title: "Lesson",
          description: null,
          durationSeconds: 120,
          kinescopeEmbedUrl: "https://kinescope.io/embed/secret",
          posterUrl: null
        }
      ],
      viewer: { telegramId: "123456", username: null }
    });

    const embedUrl = new URL(response.lessons?.[0]?.kinescopeEmbedUrl ?? "");
    expect(embedUrl.searchParams.get("watermark")).toBe("Telegram ID: 123456");
  });
});

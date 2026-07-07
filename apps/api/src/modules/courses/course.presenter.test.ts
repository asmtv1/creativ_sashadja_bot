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
});

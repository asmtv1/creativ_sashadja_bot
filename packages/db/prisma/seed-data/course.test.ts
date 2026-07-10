import { describe, expect, it } from "vitest";
import { seedCourse } from "./course";

describe("seed course content", () => {
  it("contains the SMM lesson content and pricing", () => {
    expect(seedCourse.title).toBe("Креативный контент | обучение");
    expect(seedCourse.description).toContain("создавать креативный контент");
    expect(seedCourse.priceKopecks).toBe(59900);
    expect(seedCourse.lessons[0]?.title).toBe("Геймификация в контенте");
    expect(seedCourse.lessons[0]?.durationSeconds).toBe(33 * 60);
    expect(seedCourse.lessons[0]?.kinescopeVideoId).toBe(
      "nAY1GccmG13EoGsGsZAVST"
    );
    expect(seedCourse.lessons[0]?.kinescopeEmbedUrl).toBe(
      "https://kinescope.io/embed/nAY1GccmG13EoGsGsZAVST"
    );
  });
});

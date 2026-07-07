import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("api dev runtime", () => {
  it("loads the repository .env file and declares tsx for local development", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.scripts?.dev).toContain("--env-file-if-exists=../../.env");
    expect(packageJson.devDependencies).toHaveProperty("tsx");
  });
});

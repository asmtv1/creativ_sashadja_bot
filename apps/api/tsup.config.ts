import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts", "src/scripts/npd-bootstrap.ts", "src/scripts/npd-cutover.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  clean: true,
  noExternal: ["@course/shared", "@course/db"],
  external: ["@nestjs/websockets", "@nestjs/microservices", "class-transformer", "class-validator"]
});

import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const workflow = readFileSync(new URL("./deploy.yml", import.meta.url), "utf8");
const compose = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");
const migrateDockerfile = readFileSync(new URL("../../infra/docker/Dockerfile.migrate", import.meta.url), "utf8");

test("production compose project name is stable", () => {
  assert.match(compose, /^name:\s*tgbot$/m);
});

test("deploy starts the tgbot stack after the migration-and-seed container", () => {
  const migrate = workflow.indexOf("docker compose -p tgbot run --rm -T --no-build migrate");
  const start = workflow.indexOf("docker compose -p tgbot up -d --remove-orphans --wait --wait-timeout 180");

  assert.notEqual(migrate, -1);
  assert.notEqual(start, -1);
  assert.ok(migrate < start);
});

test("migration image applies the schema before the idempotent seed", () => {
  assert.match(migrateDockerfile, /pnpm db:migrate:deploy && pnpm db:seed/);
});

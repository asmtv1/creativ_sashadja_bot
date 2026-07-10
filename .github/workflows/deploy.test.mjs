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
  const migrate = workflow.indexOf("docker compose -p tgbot run --rm -T migrate");
  const start = workflow.indexOf("docker compose -p tgbot up -d --remove-orphans --wait --wait-timeout 180");

  assert.notEqual(migrate, -1);
  assert.notEqual(start, -1);
  assert.ok(migrate < start);
});

test("deploy keeps long SSH operations alive and reports server-side failures", () => {
  assert.match(workflow, /ServerAliveInterval=15/);
  assert.match(workflow, /ServerAliveCountMax=20/);
  assert.match(workflow, /docker compose -p tgbot logs --tail=200/);
});

test("deploy publishes current only after the public healthcheck passes", () => {
  const healthcheck = workflow.indexOf('curl -fsS --retry 12 --retry-delay 5 "https://${CADDY_SITE_ADDRESS}/api/health"');
  const publishCurrent = workflow.indexOf('ln -sfn "$release_dir" "$DEPLOY_PATH/current"');

  assert.notEqual(healthcheck, -1);
  assert.notEqual(publishCurrent, -1);
  assert.ok(healthcheck < publishCurrent);
});

test("deploy ships Caddy and reclaims old app images without touching Postgres", () => {
  assert.match(workflow, /docker save[^\n]+caddy:2-alpine/);
  assert.match(workflow, /docker compose -p tgbot stop api bot miniapp caddy/);
  assert.doesNotMatch(workflow, /docker compose -p tgbot stop[^\n]+postgres/);
});

test("migration image applies the schema before the idempotent seed", () => {
  assert.match(migrateDockerfile, /pnpm db:migrate:deploy && pnpm db:seed/);
});

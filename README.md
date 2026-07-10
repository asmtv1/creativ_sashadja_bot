# Telegram Course Bot

TypeScript monorepo for a Telegram bot, NestJS API, Next.js Telegram Mini App, Prisma/PostgreSQL, YooKassa payments through Telegram invoices, and Kinescope lesson playback.

## Architecture

- `apps/api` owns business logic, payments, access grants, Telegram Mini App auth, admin endpoints, and all DB writes.
- `apps/bot` is a grammY worker. It upserts Telegram users, creates orders through the internal API, sends Telegram invoices with the YooKassa provider token, handles `PreCheckoutQuery` and `SuccessfulPayment`, and sends outbox messages.
- `apps/miniapp` is the Telegram Mini App. It sends raw `Telegram.WebApp.initData` to the API and never exposes Kinescope API tokens.
- `packages/db` owns Prisma schema, generated client, and seed content.
- `packages/shared` owns DTO schemas, enums, and money helpers only.

Telegram platform note: digital goods sold inside Telegram apps may require Telegram Stars. YooKassa is isolated behind a provider-shaped boundary so a Stars provider can be added or swapped before public launch.

## Local Setup

```bash
cp .env.example .env
pnpm install
DATABASE_URL="postgresql://course:course@localhost:5432/course?schema=public" pnpm db:generate
```

Edit `packages/db/prisma/seed-data/course.ts` with the real course title, price, Kinescope video IDs, and embed URLs.

For YooKassa payments inside Telegram, connect YooKassa in `@BotFather` through Bot Settings -> Payments and put the returned provider token into:

```bash
TELEGRAM_PAYMENT_PROVIDER_TOKEN=
```

## Development

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Root scripts:

- `pnpm db:generate`
- `pnpm db:migrate`
- `pnpm db:migrate:deploy`
- `pnpm db:seed`

## Docker

```bash
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
docker compose up -d --build
curl -f https://sasha.gafus.ru/api/health
```

To run committed migrations inside Docker, use the dedicated one-shot service:

```bash
docker compose --profile tools run --rm migrate
```

Public routing through Caddy:

- `https://sasha.gafus.ru/` -> Mini App
- `https://sasha.gafus.ru/api/*` -> API
- `https://sasha.gafus.ru/telegram/webhook` -> bot webhook

After deploy:

1. Set Telegram webhook with `secret_token` matching `TELEGRAM_WEBHOOK_SECRET`.
2. Connect YooKassa payments for the bot in `@BotFather` and set `TELEGRAM_PAYMENT_PROVIDER_TOKEN`.
3. Configure BotFather Mini App URL: `https://sasha.gafus.ru`.
4. Configure Kinescope privacy/domain rules for the same domain.

## CI/CD

Pushes to `main` run GitHub Actions CI and then deploy to the VPS over SSH.
Application images (`api`, `bot`, `miniapp`, and `migrate`) are built on the
GitHub Actions runner, exported into `images.tar.gz`, and uploaded to the server
with a small release bundle. The server no longer builds application containers:
it only loads the prebuilt images, writes `.env` from GitHub Secrets, stops
obsolete non-`tgbot` Compose projects, applies pending Prisma schema migrations
through the dedicated prebuilt `migrate` image, and starts Docker Compose from a
release directory with `--no-build`. The production Compose stack owns the
server's public `80` and `443` ports through its bundled Caddy service.

Required GitHub Actions secrets:

- `DEPLOY_HOST`: server IP or hostname.
- `DEPLOY_USER`: SSH user.
- `DEPLOY_SSH_KEY`: private SSH key for the deploy user.
- `DEPLOY_PATH`: base deployment directory on the server, for example `/opt/tgbot`.
- `PUBLIC_BASE_URL`: public HTTPS URL, for example `https://sasha.gafus.ru`.
- `CADDY_SITE_ADDRESS`: Caddy site address, for example `sasha.gafus.ru`.
- `POSTGRES_USER`: production Postgres user.
- `POSTGRES_PASSWORD`: production Postgres password.
- `POSTGRES_DB`: production Postgres database name.
- `TELEGRAM_BOT_TOKEN`: production Telegram bot token.
- `INTERNAL_API_TOKEN`: shared secret for bot-to-API calls.
- `ADMIN_BASIC_USER`: admin panel login.
- `ADMIN_BASIC_PASSWORD`: admin panel password.
- `MINIAPP_SESSION_SECRET`: Mini App session signing secret, at least 16 characters.

Optional GitHub Actions secrets used in the generated production `.env`:

- `TELEGRAM_BOT_USERNAME`
- `TELEGRAM_PAYMENT_PROVIDER_TOKEN`: BotFather payment provider token for Telegram invoices.
- `TELEGRAM_WEBHOOK_SECRET`: Telegram webhook secret token.
- `YOOKASSA_SHOP_ID`
- `YOOKASSA_SECRET_KEY`
- `YOOKASSA_WEBHOOK_SECRET`
- `YOOKASSA_CURRENCY`: defaults to `RUB`.
- `MINIAPP_SESSION_TTL_SECONDS`: defaults to `1800`.
- `KINESCOPE_API_TOKEN`
- `KINESCOPE_PRIVACY_MODE`: defaults to `private_domains`.
- `COURSE_SLUG`: defaults to `basic-course`.

Optional GitHub Actions secret:

- `DEPLOY_PORT`: SSH port. Defaults to `22` when empty.

The workflow generates the production `.env` from these separate secrets.
`DATABASE_URL` is generated automatically from `POSTGRES_USER`,
`POSTGRES_PASSWORD`, and `POSTGRES_DB`. `API_BASE_URL=http://api:3001`,
`BOT_MODE=webhook`, and `NEXT_PUBLIC_API_BASE_URL=` are fixed by the workflow
for the current Caddy routing shape. The workflow also writes the exact image
tags for the current commit into `.env` (`API_IMAGE`, `BOT_IMAGE`,
`MINIAPP_IMAGE`, and `MIGRATE_IMAGE`), so the server starts the same images that
were built in GitHub Actions. Deployment verifies container healthchecks and
then checks `https://$CADDY_SITE_ADDRESS/api/health` through public Caddy.

Server prerequisites:

- Docker with the Compose v2 plugin.
- `curl`, `tar`, `gzip`, and SSH access for the deploy user.
- The deploy user must be able to run `docker compose` and `docker load`.
- Ports `80` and `443` must be free for this project; do not run another public
  reverse proxy on the same host unless `docker-compose.yml` is changed.

Production deployment uses Compose project name `tgbot`, so container names and
named volumes stay stable across release directories. If the server was polluted
by old hash-named Compose stacks, run this from the active release directory:

```bash
KEEP_PROJECT=tgbot sh infra/scripts/prod-cleanup.sh
```

The cleanup script stops Compose projects other than `tgbot` and prunes stopped
containers plus unused images/build cache. It intentionally does not prune named
volumes, so the production database volume is preserved.

Each push to `main` builds the application images in GitHub Actions, uploads the
bundle with SSH keepalives, runs migrations and the idempotent course seed, waits
for all container and public healthchecks, and only then switches the `current`
release symlink. If a server-side step fails, the workflow prints Compose status
and recent service logs directly in the Actions run. The small production VPS
keeps PostgreSQL online while old application containers and images are reclaimed
before the new image bundle is loaded.

Database schema changes are deployed with `prisma migrate deploy` from committed
SQL migration files under `packages/db/prisma/migrations`; the same migration
container then runs the idempotent course seed before the full stack starts, so
required course and lesson rows exist after every deploy.

Ad-hoc local database rows are never deployed. To change the production schema, update
`packages/db/prisma/schema.prisma`, run
`pnpm --filter @course/db prisma:migrate -- --name <change-name>` against a
local/test database, and commit both `schema.prisma` and the generated
`packages/db/prisma/migrations/*/migration.sql`. Do not put test users, orders,
or seed-only data into migration SQL. To change production course content,
update `packages/db/prisma/seed-data/course.ts`; that idempotent seed is applied
by deployment and can still be run manually with `pnpm db:seed`.

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
- `pnpm db:seed`

## Docker

```bash
cp .env.example .env
docker compose up -d postgres
pnpm db:migrate
pnpm db:seed
docker compose up -d --build
curl -f http://localhost/api/health
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

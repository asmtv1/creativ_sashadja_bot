# Telegram channel expiry cleanup — review before activation

Date: 2026-10-20. **Implementation is local only; no bulk removal was executed.**

## Activation status

`CHANNEL_EXPIRY_ENFORCEMENT_ENABLED=false` by default (also the default when unset). The
new 15-minute scheduler calls `ChannelExpiryService.runOnce`, which returns immediately
without DB or Telegram calls when the flag is not exactly `true`. No admin endpoint
can enable it or manually trigger removal. **Do not enable until the production
migration, a full preview, and explicit operator approval.**

## Read-only backlog report

Open Admin → «Продления» → «Проверить просроченные» (or admin-authenticated
`GET /api/admin/channel-expiry-preview?limit=20&offset=0`). Page through all
`hasMore` pages. This is a dry run: it does not issue `banChatMember`, change
subscriptions, create cleanup tasks, revoke invite links, or mark users removed.
It only reads DB and calls Telegram `getChatMember` for individually eligible users.

Report scope: subscriptions with `periodEnd <= snapshot time`. It includes unpaid,
already-removed and exempt rows, which receive explicit skip reasons, plus
Telegram-admin and owner status verified from `getChatMember`. A missing
`ChannelMembership` record is **not** grounds to conclude the user is not a member:
paid invitation flow has no reliable membership join record. There is no attempted
subtraction of channel member count minus paid subscriptions; the Bot API does
not supply a complete auditable member roster for that operation.

| Reason | Preview action | Meaning |
| --- | --- | --- |
| `ACCESS_EXPIRED` | Candidate | Paid term and any grace expired; Telegram confirms present non-admin |
| `GRACE_PERIOD`, `ACCESS_ACTIVE` | Skip | Still entitled by time |
| `PAYMENT_PENDING` | Skip | An unresolved payment could succeed; retry after 15 minutes |
| `INVITE_STILL_ACTIVE` | Skip | An unrevoked, unexpired invite exists; wait until expiry |
| `EXEMPT` | Skip | Explicit exemption |
| `CHANNEL_ADMIN` | Skip | Telegram owner or administrator |
| `NOT_A_MEMBER` | Skip | Telegram confirms left/restricted non-member |
| `TELEGRAM_CHECK_FAILED` | Skip | Cannot verify role/participation; fail closed |
| `NO_CONFIRMED_PAYMENT` | Skip | No succeeded payment and no MANUAL entitlement |
| `ALREADY_REMOVED`, `MEMBERSHIP_ALREADY_REMOVED` | Skip | Already processed or manually revoked |
| `CHANNEL_NOT_BOUND`, `NO_EXPIRY` | Skip | Insufficient data to remove |

The displayed remove/skip counters refer to **this page**, whereas `total`
is the count of all expired-subscription records. The report is a snapshot:
**live execution rechecks** eligibility inside the shared subscription payment
lock; never treat a preview as irreversible authorization or a durable delete list.

## Runtime processing (disabled until approval)

At most 25 due records per tick, oldest expiry first. Payment webhook finalization,
creation of new checkout/renewal payments, and manual extension coordinate through
Postgres `channel-payment:${subscriptionId}` advisory transaction locks. The worker
acquires a nonblocking transaction lock, then reloads the subscription including
payments, invite expiration, exemption, membership, and current product grace.
The worker checks actual Telegram role and status before any ban.

Paid access is eligible only after `periodEnd + gracePeriodMinutes`, including
canceled-autorenewal paid plans. MANUAL access uses its `periodEnd` exactly,
without a paid renewal grace. `EXEMPT` is never removed. Missing success evidence,
pending provider payments, still-valid invites, absent Telegram member, and
unknown Telegram responses are not authorized for removal. After `banChatMember`,
the worker calls `unbanChatMember` (so the person may rejoin when eligible) and
`getChatMember` to confirm `left`. Only then may it set `ChannelMembership.removedAt`
and `ChannelRemovalTask.REMOVED`. If a previous attempt left the person `kicked`,
retry proceeds with unban and verification, without blindly banning again.

`ChannelRemovalTask` persists failures (`RETRY`, attempts, sanitized lastError,
nextAttemptAt), with 15m, 30m, 60m … up to 8h backoff. The transaction-level
lock prevents simultaneous processing of the same subscription across service
instances; a busy lock skips without marking removal. An in-process `running`
guard prevents overlapping scheduled scans on one instance. Errors in manual
revocation are no longer swallowed: a Telegram API failure causes the admin
operation to fail and no successful-removal DB status or audit event is written.

## Deployment prerequisites — not performed

1. Review the dry-run report and any `TELEGRAM_CHECK_FAILED`, missing payment
   evidence, `EXEMPT`, stale invites, and unresolved `PAYMENT_PENDING` rows.
2. Apply **only after deployment approval** the new migration
   `20261020160000_channel_removal_tasks` before deploying new API code.
3. Verify the bot has sufficient Telegram channel admin permissions for
   `getChatMember`, `banChatMember` and `unbanChatMember`; test a controlled
   disposable user with a verified expired subscription before enabling any batch.
4. Keep `CHANNEL_EXPIRY_ENFORCEMENT_ENABLED=false` for the first deployment and
   review the report on production data; **enable separately only by explicit
   authorization** and monitor persisted RETRY rows.
5. If enabled later, review members removed after renewed/recovered access;
   invitation delivery for former removed users may need an explicit rejoin path
   after a late successful renewal. Confirm the operational policy for these cases.

## Local verification

`pnpm --filter @course/db prisma:generate` — generates client locally (no DB writes).
`pnpm --filter @course/db exec prisma validate --schema prisma/schema.prisma` — schema validation.
`pnpm --filter @course/api test`, `pnpm --filter @course/miniapp test` — test suites.
`pnpm --filter @course/api typecheck`, `pnpm --filter @course/miniapp typecheck` — typechecks.
`pnpm --filter @course/api build`, `pnpm --filter @course/miniapp build` — production builds.

**No live backlog numbers were fetched at implementation time.** The local `.env`
uses a container-only PostgreSQL hostname `postgres` and the local Docker service
was not running. The report endpoint requires the new DB migration; using an
arbitrary difference between participant totals and active subscriptions would
risk targeting unrelated people. Do not infer a deletion candidate list without
reading actual subscription/payment records and Telegram member roles.

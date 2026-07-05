---
spec_id: MS-notifications
status: implemented
risk_class: product-analytics
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - lib/notifications/**
  - app/api/cron/notifications/**
  - app/api/notifications/**
  - micro-specs/platform/**
  - supabase/migrations/20260630121000_claim_due_notification_events.sql
  - tests/db/notifications*.test.mjs
implementation_surfaces:
  - lib/notifications/events.ts
  - lib/notifications/delivery-worker.ts
  - lib/notifications/frequency-cap.ts
  - app/api/cron/notifications/route.ts
  - app/api/notifications/push/subscribe/route.ts
  - app/api/notifications/push/unsubscribe/route.ts
  - app/api/notifications/readback/route.ts
  - supabase/migrations/20260630121000_claim_due_notification_events.sql
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/pwa.md
  - micro-specs/customer/home.md
related_tests:
  - tests/micro-specs/notification-queue-claims.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-notifications — Enqueue → cron claim → dispatch → readback

## Intent

Customer notifications run as a durable queue. Events are enqueued (subject to
preferences, frequency cap, and marketing consent), a cron worker **atomically
claims** due events with `FOR UPDATE SKIP LOCKED` so no event is delivered
twice, dispatches them to enabled push subscriptions, records each delivery, and
retries transient failures with backoff. A daily per-customer cap and quiet
hours keep the volume humane, and a readback endpoint exposes the journal.

## Scope (in)

- Enqueue (`enqueue_notification_event` + eligibility), the cron worker
  (`/api/cron/notifications` → `runPushNotificationDeliveryWorker`), the claim
  RPC (`claim_due_notification_events`), delivery recording
  (`record_notification_delivery`), the frequency cap, quiet hours, retries.
- The push-subscription API (`/api/notifications/push/{subscribe,unsubscribe}`)
  and `push_subscriptions`, plus the readback endpoint.

## Scope (out)

- The PWA service worker that displays the push (owned by [MS-pwa]); the customer
  marketing-consent UI (owned by [MS-customer-home]); email/SMS channels (future).
  No schema/RLS change.

## Decisions already made

- The cron route requires a `CRON_SECRET` bearer token.
- `claim_due_notification_events(p_limit, p_now)` flips `queued → delivering`
  under `FOR UPDATE SKIP LOCKED`; event status is `queued | delivering | sent |
  failed | cancelled`; delivery status is `sent | retryable_failure |
  permanent_failure | skipped`.
- The daily cap is `CUSTOMER_DAILY_NOTIFICATION_CAP = 6` over a rolling 24h for
  non-operational categories; quiet hours default to 21:00–09:00 Europe/London.
- Retries: up to 3 attempts with backoff [5min, 30min], deferring the event back
  to `queued` with an updated `due_at`.

## EARS requirements

- **N-1 (auth cron):** IF `/api/cron/notifications` is called without a valid
  `CRON_SECRET`, THEN THE system SHALL reject it.
- **N-2 (atomic claim):** THE worker SHALL claim due events with `FOR UPDATE SKIP
  LOCKED`, so a concurrently-running worker never claims the same event and no
  event is dispatched twice.
- **N-3 (consent/eligibility):** IF a customer has not consented to a marketing
  channel (or a preference is off), THEN THE system SHALL NOT enqueue/dispatch
  that notification to them.
- **N-4 (frequency cap):** THE system SHALL deliver at most
  `CUSTOMER_DAILY_NOTIFICATION_CAP` non-operational notifications per customer per
  rolling 24 hours.
- **N-5 (quiet hours):** WHILE the current Europe/London time is within a
  customer's quiet hours, THE system SHALL defer rather than dispatch.
- **N-6 (record + retry):** WHEN a delivery is attempted, THE system SHALL record
  it (`record_notification_delivery`); a retryable failure SHALL be retried up to
  3 times with backoff, a permanent failure SHALL stop, and the event SHALL be
  marked `sent`/`failed`/`cancelled` accordingly.
- **N-7 (subscription lifecycle):** WHEN a customer subscribes/unsubscribes, THE
  system SHALL register/disable their `push_subscriptions` row; disabled/revoked
  subscriptions SHALL NOT receive deliveries.
- **N-8 (readback):** THE readback endpoint SHALL return the customer's own
  notification journal with delivery rows, and no other customer's.

## Verification method

`tests/micro-specs/notification-queue-claims.test.mjs` asserts the claim RPC uses
`FOR UPDATE SKIP LOCKED` (N-2) and that the worker enforces quiet hours, retry
backoff, the frequency cap, and per-channel consent (N-3…N-6). A live-DB test
can prove the atomic claim by racing two workers over one due event (only one
claims it). Cron auth (N-1) and readback scoping (N-8) are route-boundary guards.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test`.

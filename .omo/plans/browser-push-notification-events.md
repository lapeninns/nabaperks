# browser-push-notification-events - Work Plan

## TL;DR (For humans)
**What you'll get:** Opt-in browser push notifications for the loyalty moments that matter: one stamp away, next stamp available, reward unlocked, reward ready, profile needed, reward expiring, reward collected/new cycle, dormant progress, and venue announcements where consent allows.

**Why this approach:** Push is built as an auditable server-side notification subsystem rather than inline UI code, so loyalty mutations remain source-of-truth and every send is deduped, preference-checked, and recoverable.

**What it will NOT do:** It will not background-track customers near venues, send marketing without consent, or replace server-confirmed stamps/rewards with browser state.

**Effort:** Large
**Risk:** High - this touches PWA service worker behavior, DB/RLS schema, consent boundaries, scheduled jobs, reward expiry semantics, and customer-facing UX.
**Decisions to sanity-check:** Default reward expiry duration, quiet hours, and whether venue announcements ship in the first implementation or stay feature-flagged/admin-only.

Your next move: approve this plan for implementation with `$start-work browser-push-notification-events`, or request a high-accuracy review first. Full execution detail follows below.

---

> TL;DR (machine): Large/high-risk TDD implementation adding Web Push subscription, preferences, event ledger, expiry, transactional/reminder triggers, scheduled delivery, and full QA evidence.

## Scope
### Must have
- Add a browser Web Push notification subsystem for Nabaperks customer PWA/web sessions.
- Keep server-side loyalty state as the source of truth; push only mirrors confirmed server events or scheduled due-event scans.
- Introduce a new micro-spec and traceability coverage because current customer specs explicitly exclude push/reminders.
- Add VAPID env contract and `web-push` or equivalent standards-based sender.
- Extend the existing service worker with `push`, `notificationclick`, and `pushsubscriptionchange` while preserving current offline/network-only safety for server-state paths.
- Treat Web Push as progressive enhancement: denied, unsupported, stale, or platform-limited browsers keep full loyalty functionality.
- Persist browser push subscriptions, customer notification preferences, notification events, and delivery attempts.
- Support these notification/event types:
  - `push_permission_prompt_viewed`
  - `push_permission_granted`
  - `push_subscription_created`
  - `push_subscription_disabled`
  - `push_subscription_failed`
  - `one_stamp_away`
  - `next_stamp_available`
  - `reward_unlocked_waiting`
  - `reward_ready`
  - `profile_required_to_collect`
  - `reward_expiring_soon`
  - `reward_expired`
  - `reward_collected_cycle_started`
  - `dormant_progress`
  - `venue_announcement`
- Add real reward expiry state: merchant/card/reward configuration plus `reward_events.expires_at` snapshot at assignment time.
- Keep 10-minute reward scan-token expiry separate from assigned reward expiry; never use `reward_scan_tokens.expires_at` for customer expiry notifications.
- Send `reward_expiring_soon` before expiry and never after redemption/expiration.
- Require explicit browser permission and customer-enabled preference before any send.
- Require explicit marketing consent plus push marketing preference for `venue_announcement` and `dormant_progress`.
- Maintain idempotency and dedupe for every event by event type, customer, membership/reward/cycle, and due window.
- Provide customer controls to enable, disable, and inspect notification preferences.
- Record product events and operational logs without raw phone numbers, raw coordinates, push endpoint leakage, tokens, or PII.
- TDD: each micro-spec requirement gets failing tests before production implementation.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Do not add native mobile apps, Firebase Cloud Messaging, OneSignal, SMS, WhatsApp, or email.
- Do not implement passive "near venue" background geofencing or background GPS.
- Do not store raw coordinates for notification targeting.
- Do not block stamps or rewards because push is unsupported, denied, stale, or failed.
- Do not send venue announcements, offers, dormant/winback prompts, or merchant campaigns without marketing consent.
- Do not expand existing marketing consent silently by adding `push` to `consent_records` unless the new legal/micro-spec explicitly requires it and SQL tests cover it.
- Do not cache or replay stamp/reward mutations in the service worker.
- Do not weaken reward ownership, profile gate, one-stamp-per-UK-business-day, RLS, or server-confirmed redemption.
- Do not mutate hosted Supabase for verification unless the user explicitly approves it.
- Do not confuse reward scan-token expiry with actual reward expiry.

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD with Vitest, SQL tests against local/disposable Supabase where available, Playwright mocked-browser checks, and static service-worker assertions.
- Evidence: `.omo/evidence/task-<N>-browser-push-notification-events.<ext>` for every todo.
- Minimum gates:
  - `pnpm governance`
  - `pnpm typecheck`
  - targeted `pnpm test -- tests/micro-specs/<new-and-touched-tests>.test.ts`
  - targeted `pnpm db:verify`
  - targeted `pnpm db:test:rls` only against a confirmed local/disposable DB
  - targeted Playwright checks for notification settings unsupported/denied/granted states
  - `pnpm build`
- If local Supabase is absent or unsafe, record an explicit skip artifact instead of touching hosted data.
- Before writing Next.js route handlers/server actions, the executor must read the relevant local Next.js 16 docs in `node_modules/next/dist/docs/` per `AGENTS.md`.
- Before writing browser/platform-specific push behavior, the executor must check current MDN Push/Notification API docs, WebKit iOS/iPadOS Web Push docs, and Vercel Cron/runtime docs and cite them in the task evidence.

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.
- Wave 1: Specification/schema contracts and tests. Todos 1-5 can start with careful coordination; Todo 5 depends on expiry decisions in Todo 1 but can draft failing tests early.
- Wave 2: Server implementation and worker delivery. Todos 6-9 depend on the schema and notification contract.
- Wave 3: Customer/merchant/admin surfaces and observability. Todos 10-12 depend on server APIs and event contract.
- Wave 4: Integrated QA and hardening. Todo 13 plus final verification.

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 | none | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 | none |
| 2 | 1 | 8, 10, 13 | 3, 4, 5 |
| 3 | 1 | 6, 7, 8, 9, 10, 11, 12 | 2, 4, 5 |
| 4 | 1 | 6, 7, 8, 9, 13 | 2, 3, 5 |
| 5 | 1 | 6, 7, 8, 9, 10, 13 | 2, 3, 4 |
| 6 | 2, 3, 4, 5 | 7, 8, 9, 13 | none |
| 7 | 3, 4, 5, 6 | 9, 10, 13 | 8 after contracts align |
| 8 | 2, 3, 4, 5, 6 | 10, 13 | 7 after contracts align |
| 9 | 3, 4, 5, 6, 7 | 13 | 10, 11 |
| 10 | 2, 3, 8 | 13 | 9, 11 |
| 11 | 3, 4, 6 | 13 | 9, 10, 12 |
| 12 | 3, 4, 6 | 13 | 9, 10, 11 |
| 13 | all implementation todos | final verification | none |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Add the notification micro-spec and traceability contract
  What to do / Must NOT do: Create a new micro-spec for browser push notifications, update traceability artifacts, and explicitly supersede the current push/reminder out-of-scope language only for this lane. Define categories: transactional, reminder, marketing, operational. Define the complete event list and consent/preference requirements. Include reward expiry requirements and the no-passive-geofence guardrail. Do not hand-wave legal consent; keep loyalty participation independent from marketing.
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2-13
  References (executor has NO interview context - be exhaustive): `micro-specs/03-customer/02-digital-stamp-card.md:67-72`, `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md:70-74`, `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md:80-83`, `micro-specs/README.md`, `micro-specs/GLOBAL_CONTEXT.md`, `Instructions_tdd.md`
  Acceptance criteria (agent-executable): `pnpm governance` passes and traceability includes the new requirements with tests initially failing before implementation.
  QA scenarios (name the exact tool + invocation): Vitest governance/static assertions for new spec and out-of-scope deltas; Evidence `.omo/evidence/task-1-browser-push-notification-events.md`
  Commit: Y | `docs(push): add browser push notification micro-spec`

- [x] 2. Extend the PWA service worker for Web Push
  What to do / Must NOT do: Add `push`, `notificationclick`, `pushsubscriptionchange`, and safe notification payload parsing to `public/sw.js`; focus/open destination URLs on click; preserve existing network-first behavior for server-state paths and current offline fallback. Add tests that assert no stamp/reward route is cached for mutation and push payloads always show a notification. Do not cache loyalty mutations or put secrets in the worker.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 8, 10, 13
  References: `public/sw.js:23-61`, `components/pwa/app-pwa.tsx:139-157`, `app/manifest.ts:6-74`, `docs/IMPLEMENTED_USER_STORIES.md:179`
  Acceptance criteria: targeted Vitest/static SW tests fail first, then pass; service worker still preserves `NETWORK_ONLY_PREFIXES`.
  QA scenarios: `pnpm test -- tests/micro-specs/pwa-web-push.test.ts`; Playwright unsupported/browser click target mock later in Todo 10; Evidence `.omo/evidence/task-2-browser-push-notification-events.md`
  Commit: Y | `feat(pwa): handle web push notifications`

- [x] 3. Add push subscriptions and notification preferences schema/RLS
  What to do / Must NOT do: Add migrations for `push_subscriptions`, `notification_preferences`, and any helper RPCs needed to register/disable a subscription for the signed-in customer. Store endpoint, encrypted keys, device metadata, permission state, enabled/revoked timestamps, last seen/success/failure timestamps, and failure reason. Keep endpoints and auth secrets out of product analytics/logs. Direct table access should be service-role only or tightly customer-scoped via RPC; add SQL tests for tenant isolation and opt-out. Do not expand `consent_records` casually.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6, 7, 8, 9, 10, 11, 12
  References: `lib/customer/consent.ts:6-12`, `supabase/migrations/20260606142000_initial_schema_rls.sql:210-220`, `components/customer/profile-marketing-consent.tsx:41-45`, `lib/customer/profile.ts:216-263`, `supabase/tests/customer_marketing_consent.sql`
  Acceptance criteria: local/disposable SQL tests prove customer A cannot read/disable customer B subscriptions and opt-out disables future sends.
  QA scenarios: `pnpm db:verify`; `pnpm db:test:rls` only after confirming local/disposable DB; Evidence `.omo/evidence/task-3-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): store push subscriptions and preferences`

- [x] 4. Add notification event/delivery ledger with idempotency
  What to do / Must NOT do: Add `notification_events` and `notification_deliveries` or equivalent. Include `event_type`, `category`, `customer_id`, `merchant_id`, `membership_id`, `reward_event_id`, `cycle_number`, `business_date`, `due_at`, `dedupe_key`, `status`, `payload`, `metadata`, `created_at`, `sent_at`, `cancelled_at`, and delivery attempt rows. Add unique indexes that prevent duplicate sends for reward-ready, one-away, next-stamp-available, expiring, and collected-cycle events. Do not use PostHog/product_events as the notification source of truth.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6, 7, 8, 9, 13
  References: `lib/analytics/events.ts:40-58`, `supabase/migrations/20260606142000_initial_schema_rls.sql:161-180`, `docs/ARCHITECTURE.md:99-124`
  Acceptance criteria: SQL tests show duplicate enqueue attempts return/reuse a single event and deliveries are append-only.
  QA scenarios: `pnpm db:verify`; targeted SQL test file under `supabase/tests/`; Evidence `.omo/evidence/task-4-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): add durable notification ledger`

- [x] 5. Implement reward expiry as assigned reward state
  What to do / Must NOT do: Add merchant/card/reward expiry configuration and snapshot `expires_at` on `reward_events` at assignment. Default to `null`/no automatic expiry unless configured. Update reward terms display, reward list/card read models, and redemption checks to show/block/mark expired rewards only after `reward_events.expires_at`; preserve existing `redeemable_from` behavior. Add scheduled expiration job support but do not expire old rewards without explicit fields. Do not derive expiry from mutable reward terms text or from `reward_scan_tokens.expires_at`.
  Parallelization: Wave 1 | Blocked by: 1 | Blocks: 6, 7, 8, 9, 10, 13
  References: `supabase/migrations/20260606142000_initial_schema_rls.sql:167-168`, `micro-specs/04-staff-rewards/02-reward-unlock-and-redemption.md:70-74`, `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md:80-83`, `lib/customer/rewards.ts:43-89`, `lib/customer/card.ts`, `supabase/migrations/20260617110000_backend_hardening.sql:18-40`, `supabase/migrations/20260617110000_backend_hardening.sql:116-227`, `supabase/migrations/20260615120000_customer_profile_completion.sql:97-131`
  Acceptance criteria: tests cover no expiry, future expiry, expiring soon, expired redemption block, and reward pool edits not moving assigned expiry.
  QA scenarios: `pnpm test -- tests/micro-specs/reward-expiry.test.ts tests/micro-specs/reward-redemption-cycles.test.ts`; local SQL expiry tests if DB is available; Evidence `.omo/evidence/task-5-browser-push-notification-events.md`
  Commit: Y | `feat(rewards): snapshot reward expiry`

- [x] 6. Build notification enqueue domain logic
  What to do / Must NOT do: Add `lib/notifications/events.ts` or equivalent domain helpers to enqueue canonical notification events with preference/consent eligibility checks and dedupe keys. Include payload builders for all event types. For `venue_announcement` and `dormant_progress`, require marketing consent and marketing push preference; for reward/stamp transactional reminders, require push permission/preference but not marketing opt-in. Do not send from these helpers; only enqueue.
  Parallelization: Wave 2 | Blocked by: 2, 3, 4, 5 | Blocks: 7, 8, 9, 13
  References: `lib/customer/consent.ts:24-50`, `lib/customer/profile.ts:216-263`, `lib/analytics/events.ts:94-99`
  Acceptance criteria: Vitest tests prove each event builds a sanitized payload, dedupes correctly, and refuses ineligible marketing sends.
  QA scenarios: `pnpm test -- tests/micro-specs/browser-push-notifications.test.ts`; Evidence `.omo/evidence/task-6-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): enqueue loyalty push events`

- [x] 7. Wire confirmed loyalty triggers into enqueueing
  What to do / Must NOT do: After a confirmed stamp, enqueue `one_stamp_away`, `reward_unlocked_waiting`, or `reward_ready` as appropriate. After confirmed reward collection, enqueue `reward_collected_cycle_started`. When reward is ready but profile gate blocks token creation, enqueue `profile_required_to_collect` once. Ensure trigger code uses server-confirmed data, not client optimism. Do not enqueue on failed/blocked stamp attempts or mere camera scans.
  Parallelization: Wave 2 | Blocked by: 3, 4, 5, 6 | Blocks: 9, 10, 13
  References: `app/card/[membershipId]/actions.ts:35-62`, `lib/customer/stamp.ts:49-70`, `supabase/migrations/20260617110000_backend_hardening.sql:116-227`, `supabase/migrations/20260617110000_backend_hardening.sql:379-445`, `supabase/migrations/20260615120000_customer_profile_completion.sql:122-131`
  Acceptance criteria: tests prove blocked stamps/failed scans enqueue nothing, final stamp enqueues exactly one due event, and redemption collection enqueues a new-cycle event only after server-confirmed mutation.
  QA scenarios: `pnpm test -- tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/reward-profile-gate.test.ts tests/micro-specs/merchant-scanned-reward.test.ts tests/micro-specs/browser-push-notifications.test.ts`; Evidence `.omo/evidence/task-7-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): enqueue from loyalty transitions`

- [x] 8. Add subscription API routes/actions and VAPID env contract
  What to do / Must NOT do: Add public-key, subscribe, unsubscribe, refresh, and preference update routes/actions. Add `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, and `WEB_PUSH_VAPID_SUBJECT` to env validation/docs/scripts. Read local Next.js docs before writing route handlers. Check current Vercel runtime support before choosing Node/Edge runtime, because Web Push encryption must run where the dependency is supported. Ensure route handlers authenticate the customer session, rate-limit writes if existing helpers are available, and never log endpoints/keys. Do not expose private VAPID key to client bundles.
  Parallelization: Wave 2 | Blocked by: 2, 3, 4, 5, 6 | Blocks: 10, 13
  References: `package.json:86-110`, `docs/ENV_KEYS.md`, `lib/env/validate.ts`, `components/pwa/app-pwa.tsx:139-157`, `AGENTS.md` Next.js docs rule
  Acceptance criteria: route/action tests cover public key shape, authenticated subscribe/unsubscribe, denied unauthenticated writes, malformed subscription rejection, and env validation.
  QA scenarios: `pnpm test -- tests/micro-specs/push-subscription-routes.test.ts tests/micro-specs/vercel-env-guard.test.ts`; Evidence `.omo/evidence/task-8-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): add push subscription endpoints`

- [x] 9. Add scheduled delivery worker and cron route
  What to do / Must NOT do: Implement a protected cron route or scheduled handler that selects due notification events, checks current eligibility, sends via Web Push, records delivery attempts per subscription/device, and disables subscriptions on permanent 404/410 failures. Include due-event producers for `next_stamp_available`, `reward_ready`, `reward_expiring_soon`, `reward_expired`, and `dormant_progress`. Apply quiet hours and rate caps. Do not send if reward is redeemed/expired, customer opted out, subscription revoked, merchant inactive, or marketing consent missing.
  Parallelization: Wave 2 | Blocked by: 3, 4, 5, 6, 7 | Blocks: 13
  References: `lib/customer/rewards.ts:76-82`, `lib/customer/card-stamps.ts`, `lib/customer/uk-date.ts`, `lib/observability/logger.ts`, `docs/OBSERVABILITY.md`
  Acceptance criteria: worker tests mock Web Push sends, cover success, retryable failure, permanent unsubscribe, dedupe, quiet-hours deferral, and cancellation after redemption/expiry.
  QA scenarios: `pnpm test -- tests/micro-specs/push-delivery-worker.test.ts`; local cron route invocation with `CRON_SECRET` mock; Evidence `.omo/evidence/task-9-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): deliver due push events`

- [x] 10. Build customer notification settings and permission UX
  What to do / Must NOT do: Add a customer-facing notification settings component to the profile/home surface. Show supported, unsupported, denied, granted, installed-required, and subscribed states. Request browser permission only after user intent. Register/update subscription through the server API and let customers disable reminders/marketing categories. Do not auto-prompt on first page load or block loyalty workflows if denied.
  Parallelization: Wave 3 | Blocked by: 2, 3, 8 | Blocks: 13
  References: `components/customer/profile-marketing-consent.tsx:41-45`, `app/home/(authed)/profile`, `components/pwa/app-pwa.tsx:115-245`, `DESIGN.md`
  Acceptance criteria: Vitest/Playwright tests cover unsupported, denied, granted but unsubscribed, subscribed, unsubscribe, and marketing preference copy.
  QA scenarios: `playwright test tests/e2e/customer-notification-settings.spec.ts`; `pnpm test -- tests/micro-specs/home-profile.test.ts`; Evidence `.omo/evidence/task-10-browser-push-notification-events.md`
  Commit: Y | `feat(customer): add push notification settings`

- [x] 11. Add venue announcement surface with strict consent gates
  What to do / Must NOT do: Add a minimal merchant/admin-triggered venue announcement path if product chooses to ship it now; otherwise feature-flag it and leave the event type ready. Require marketing consent, push marketing preference, merchant ownership/admin permission, message length limits, rate limits, audit/product events, and preview before send. Do not allow free-form spam or send to customers without explicit marketing eligibility.
  Parallelization: Wave 3 | Blocked by: 3, 4, 6 | Blocks: 13
  References: `app/app`, `app/admin`, `lib/analytics/events.ts:5-25`, `micro-specs/07-observability-compliance/02-consent-legal-pages-and-data-requests.md:107-113`
  Acceptance criteria: tests prove ineligible customers are excluded, announcements are rate-limited, and audit/product events are recorded.
  QA scenarios: `pnpm test -- tests/micro-specs/venue-announcement-push.test.ts`; optional Playwright merchant/admin preview; Evidence `.omo/evidence/task-11-browser-push-notification-events.md`
  Commit: Y | `feat(notifications): gate venue announcements`

- [x] 12. Add analytics, observability, and admin/support readback
  What to do / Must NOT do: Add sanitized product event names for permission, subscription, enqueue, delivered, clicked, failed, disabled, and expired flows. Add support/admin readback for notification status where useful. Add structured logs with request/trace ids but no endpoint/key/phone/raw-location leakage. Do not treat PostHog as delivery truth.
  Parallelization: Wave 3 | Blocked by: 3, 4, 6 | Blocks: 13
  References: `lib/analytics/events.ts:5-25`, `lib/analytics/events.ts:94-99`, `docs/OBSERVABILITY.md:49-59`, `docs/ARCHITECTURE.md`
  Acceptance criteria: tests verify allowed event names and metadata sanitization; admin/support readbacks omit secrets and PII.
  QA scenarios: `pnpm test -- tests/micro-specs/analytics-dashboard-pilot.test.ts tests/micro-specs/browser-push-notifications.test.ts`; Evidence `.omo/evidence/task-12-browser-push-notification-events.md`
  Commit: Y | `feat(observability): track push notification lifecycle`

- [x] 13. Integrated QA, migration proof, and product-flow proof
  What to do / Must NOT do: Run the integrated verification pass against the final implementation. Exercise stamp-to-one-away, next-stamp-available, reward waiting, reward ready, profile required, expiring soon, expired, collected/new-cycle, dormant, and venue announcement cases with mocked Web Push and real server-state assertions. Confirm denied/unsupported browsers never block loyalty. Do not claim hosted push delivery unless actually tested on a controlled staging account.
  Parallelization: Wave 4 | Blocked by: 1-12 | Blocks: final verification
  References: `docs/QA_MATRIX.md`, `docs/MANUAL_TEST_SCENARIOS.csv`, `tests/e2e/customer-home-surfaces.spec.ts`, `tests/e2e/a11y.spec.ts`, `package.json:54-64`
  Acceptance criteria: all targeted gates pass or have explicit evidence-backed local-infra skips; no unrelated dirty-worktree changes are bundled.
  QA scenarios: `pnpm governance`; `pnpm typecheck`; targeted `pnpm test`; `pnpm db:verify`; local-only `pnpm db:test:rls`; targeted Playwright; `pnpm build`; Evidence `.omo/evidence/task-13-browser-push-notification-events.md`
  Commit: Y | `test(notifications): verify browser push flows`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit
- [x] F2. Code quality review
- [x] F3. Real manual QA
- [x] F4. Scope fidelity

## Commit strategy
- Prefer one commit per todo or small cluster if the implementation tool can keep changes clean.
- Keep spec/schema/server/UI/test changes coherent; do not bundle unrelated dirty worktree files.
- Do not stage `.omo/evidence` unless this repo convention expects those artifacts for the lane. Ask if uncertain before final commit.
- Suggested final branch name if a branch is needed: `codex/browser-push-notification-events`.

## Success criteria
- The app supports browser Web Push subscriptions for capable browsers and remains graceful for unsupported/denied browsers.
- Customers can opt in/out by category; marketing-style notifications require marketing consent and push marketing preference.
- All notification sends are backed by durable server events, delivery attempts, and idempotency keys.
- Reward expiry is real server state with assigned reward snapshots, customer-visible copy, redemption blocking after expiry, and expiring-soon notifications.
- Passive near-venue push is explicitly absent; location remains in-app and soft.
- Stamp/reward flows preserve server authority, one-stamp-per-UK-business-day, reward profile gates, and merchant-scan confirmation.
- Agent-executed verification has durable `.omo/evidence` artifacts for every todo and final gate.

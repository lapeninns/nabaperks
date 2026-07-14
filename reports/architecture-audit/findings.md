# Architecture Audit — Fix Tickets

Detailed, actionable findings from the verified architecture audit (2026-06-30). Each ticket is self-contained: evidence (file:line), the fix, and acceptance criteria (definition of done). Tick the box when shipped. See [README.md](./README.md) for the dashboard, the verified-strong invariants (do not break these), the debunked claims (do not re-open), and the dynamic-verification checklist.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done. Ticked boxes reflect repo-side source/migration remediation; live Supabase/provider proof is tracked separately in `docs/architecture-flows/11-remediation-log.md`.

## Remediation Status — 2026-06-30

| Ticket | Status | Repo evidence now present                                                                                                                                                                                                                                                                                 | Remaining proof                                                                                                                                                                           |
| ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1     | `[x]`  | GDPR export/erasure/anonymization RPCs, stale PII purge RPC, admin dispatch wiring, scheduled retention cron route, and local authenticated browser proof for admin privacy opt-out/access-request submission.                                                                                                | Apply migrations to target Supabase and make `pnpm smoke:supabase:migrations`, `pnpm env:check:production`, and `pnpm smoke:providers` pass against the target RPCs; the migration smoke currently shows the remote still lacks `20260628120000` plus the `20260630120000`-`20260630131000` remediation batch, and dry-run shows the eventual push must use `--include-all`.            |
| H2     | `[x]`  | Global CSP/security headers in `proxy.ts`, nonce-backed `strict-dynamic` script policy, dedicated `script-src-elem` for parser-loaded Next chunks, request-side nonce forwarding, nonce propagation into next-themes/JSON-LD, plus SRI in `next.config.ts`; local production curl and Playwright QR smoke passed without CSP console errors. | Recheck on Vercel preview/production after deploy.                                                                                                                                        |
| H3     | `[x]`  | CI now runs lint/tests, the DB-free Playwright e2e harness tier, and a dedicated DB behavioral moat job; local DB tests passed for concurrent double-scan, concurrent double-collect, billing fail-close, and tenant RLS/JWT-context isolation, and the architecture harness gate covers core remediated merchant routes at desktop/mobile. | Re-run DB moat on target/staging Supabase if the migration set or runtime settings differ from local CI; run a real PostgREST/JWT pentest on target before treating tenant isolation as production-proven. Re-run the e2e harness on preview when browser proof must match deployed assets. |
| M1-M9  | `[x]`  | Threshold reconciliation, OTP hardening, masked customer reads, frequency caps, dead SQL removal/decision doc, fraud resolution with authenticated browser proof, clean page-level admin-gate denial proof, disabled QR reuse, and redirect hardening with local browser proof are implemented.             | Apply SQL migrations and run target-environment smoke where DB behavior is involved.                                                                                                      |
| L1-L10 | `[x]`  | Quiet-hour threading, auth pinning, reward-pool minimum guard, webhook replay ordering, partial push retry, rate-limit upsert, wallet stamp honesty, proof disclosure, analytics taxonomy, and DB metadata sanitization are implemented.                                                                  | `pnpm env:check:production` currently blocks on `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`, `CRON_SECRET`, and `SUPABASE_SEND_EMAIL_HOOK_SECRET`; `pnpm smoke:providers` proves Stripe price, Twilio Verify, Resend API, and PostHog config only; Vercel production env names exist but local pull returned blank sensitive values, and `pnpm smoke:supabase:migrations` proves target Supabase is behind the local migration batch, so send/replay/cron/Web Push/auth-hook proof remains. |

---

## 🔴 High

### `[x]` H1 — No functional GDPR right-to-erasure or data export

- **Severity:** High · **Effort:** M–L · **Areas:** 53 / 40 / 35 / 10
- **What's wrong:** `admin_log_data_request` only inserts an `audit_logs` row tagged `manual_email_required`; it accepts `request_type='deletion'` but performs **no** delete/anonymize/export for any type. No customer-facing erasure/export affordance exists. The only `delete from public.customers` lives in dev scripts.
- **Evidence:** `supabase/migrations/20260606142000_initial_schema_rls.sql:2461-2528` · `app/admin/privacy/page.tsx:43` · `app/admin/actions.ts:165-196` · `app/home/(authed)/profile/page.tsx:28-63`
- **Fix:** Add an **erasure RPC** that anonymizes/nulls `customers` PII (`full_name`, `date_of_birth`, `email`, `phone`, `phone_hmac`, `phone_ciphertext`, `phone_last4`, `phone_country`) behind a stable surrogate so the append-only ledger survives; add a **portability/export RPC** for SAR (Art. 15/20). Gate both behind `requireAdminAction` and ideally a customer self-service request flow. Add a retention/auto-purge job for stale PII.
- **Acceptance criteria:**
  - A deletion request actually nulls/anonymizes all PII columns; ledger rows remain (linked via surrogate); action is audit-logged.
  - An export request returns the customer's data (Art. 15/20) in a portable format.
  - A retention job purges stale PII on a schedule.
  - Behavioral test proves PII is gone post-erasure and the ledger is intact.
- **Note:** A _documented_ manual process is a defensible interim Art. 17 posture — confirm legal sign-off on the interim before launch; this is High for legal expense, not Critical.

### `[x]` H2 — Zero HTTP security headers

- **Severity:** High · **Effort:** S · **Area:** 54
- **What's wrong:** No CSP / HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy anywhere. `next.config.ts` `headers()` sets only caching/SW headers; the Next-16 proxy runs on all routes but sets only `x-request-id`. Repo-wide grep for any security header = 0 matches.
- **Evidence:** `next.config.ts:8-37` · `proxy.ts:15-26` (runs on all routes via `config.matcher` — the ideal hook)
- **Fix:** Set headers in `proxy.ts` (`response.headers.set(...)`) for all routes: CSP (nonce / `strict-dynamic` for scripts), `Strict-Transport-Security`, `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'`) on the loyalty-card + `/admin` surfaces, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive `Permissions-Policy`.
- **Acceptance criteria:**
  - `curl -I` on app, admin, and loyalty-card routes shows all six header families.
  - CSP has no `unsafe-inline` for scripts.
  - Admin + card surfaces deny framing.
  - A test asserts the headers are present.

### `[x]` H3 — Tests never run in CI (and ~90% are source-grep, not behavioral)

- **Severity:** High · **Effort:** S (wire) + M (behavioral tests) · **Areas:** 46 / 60 / 6
- **What's wrong:** `ci.yml` runs only `typecheck`, `tokens:check`, `claims:check`, `build`, `jsonld:check` — **no `pnpm test`**. The contract test suite is `readFileSync + assert.match` on source/SQL text; it never _executes_ `issue_self_service_stamp` / redemption / billing gates. Only the 3 `tests/unit/*` are behavioral (app-layer).
- **Evidence:** `.github/workflows/ci.yml:36-43` · `package.json:11-13` · `tests/contracts/*.test.mjs`
- **Fix:** Add `- run: pnpm test` (and `pnpm lint`) to `ci.yml`. Then add DB-backed / pgTAP behavioral tests that execute the moat.
- **Acceptance criteria:**
  - CI runs `pnpm test` and fails the build on a red test.
  - Behavioral tests cover: double-scan → one-stamp-per-UK-day; double-collect → single-use redemption; billing fail-close. (These would catch a regression of the `unique_violation` handler / lock scope that the grep tests miss.)

---

## 🟡 Medium

### `[x]` M1 — Lowering `stamps_required` mid-cycle bricks existing members

- **Severity:** Medium (real bug) · **Effort:** M · **Area:** 7
- **What's wrong:** `save_loyalty_card` updates `stamps_required` with no reconciliation of in-flight memberships. A member already at/over the new threshold never gets a minted reward (the only `reward_events` INSERT is gated on `new_stamp_count >= stamps_required` _after_ an increment) and hits "a reward is already ready to redeem" on every future stamp. Code already detects this (`logger.warn('customer_full_card_without_reward')`) and renders a terminal dead state.
- **Evidence:** `supabase/migrations/20260624120000_remove_minimum_spend.sql:111-119` · `supabase/migrations/20260626090000_require_merchant_billing.sql:634-636,810,849` · `lib/customer/experience/load-card.ts:113-124`
- **Fix:** On lowering `stamps_required`, reconcile in-flight memberships — clamp/forbid lowering below the max active-cycle count, **or** mint the pending `reward_events` row for members at/over the new threshold (and/or auto-advance their cycle). At minimum, fail-closed with a merchant warning instead of silently bricking.
- **Acceptance criteria:** Lowering the threshold never dead-states a member; members at/over the new threshold get a redeemable reward; merchant sees a warning when a lower value would strand members.

### `[x]` M2 — 4-digit merchant email-OTP is brute-forceable

- **Severity:** Medium · **Effort:** S · **Areas:** 2 / 51
- **What's wrong:** The user-facing OTP alias is 4 digits (10k space, 60-min window). Only throttle is `merchant-verify` 5/15min keyed `${email}:${ip+ua-hash}` — no IP-independent per-email cap and no failed-attempt lockout in the consume RPC (unlike the staff PIN's 3-fails/10min). `verifyOtp` is never reached on a wrong guess, so Supabase's own token throttle doesn't apply.
- **Evidence:** `lib/auth/merchant-email-otp-alias.ts:7-9,89-93` · `app/(auth)/actions.ts:356-377` · `supabase/config.toml:234` (already `otp_length=6`)
- **Fix:** Switch the alias to **6 digits** and/or add an **IP-independent per-email attempt counter + lockout** in `consume_merchant_email_otp_alias` (mirror the staff PIN lockout).
- **Acceptance criteria:** Alias is 6 digits; N failed attempts for one email locks further attempts for M minutes regardless of source IP.

### `[x]` M3 — Merchants get full raw-PII read via RLS; masking is app-layer only

- **Severity:** Medium · **Effort:** M · **Areas:** 40 / 25
- **What's wrong:** `customers_select_scoped` permits a full-row SELECT (incl. raw `email`, `phone`, `phone_ciphertext`) when `merchant_can_access_customer(id)`; RLS can't restrict columns and `authenticated` keeps default full-column SELECT. Safe only because every loader masks in app code.
- **Evidence:** `supabase/migrations/20260606142000_initial_schema_rls.sql:2747-2752` · `lib/merchant/customer-readback.ts:74-77` · `lib/merchant/dashboard.ts:89-94`
- **Fix:** Add a DB backstop — expose merchant reads through a masked view (`customers_masked`) or column-level GRANTs that withhold `email`/`phone`/`phone_ciphertext` from `authenticated`; point `getMerchantCustomers` at it.
- **Acceptance criteria:** A raw merchant-role SELECT on `customers` cannot return `email`/`phone`/`phone_ciphertext`; all merchant loaders read from the masked source.

### `[x]` M4 — No per-customer notification frequency cap

- **Severity:** Medium · **Effort:** S–M · **Area:** 49
- **What's wrong:** Only idempotency guard is per-event-type dedupe (`on conflict (dedupe_key)`); there is no global per-customer ceiling, so a multi-venue member with concurrent lifecycle events can be flooded. Only default quiet hours brakes it.
- **Evidence:** `supabase/migrations/20260622140000_notification_ledger_reward_expiry.sql:228-252` · `lib/notifications/events.ts:231-269` · `lib/notifications/delivery-worker.ts:133-136`
- **Fix:** Add a per-customer daily/weekly notification ceiling (and optional inter-event cooldown) checked at enqueue and delivery, especially for reminder/marketing categories.
- **Acceptance criteria:** A customer cannot receive more than N notifications/day across all venues; cap is enforced at enqueue and delivery.

### `[x]` M5 — Dead counter-handshake + staff-PIN subsystem (~700 lines)

- **Severity:** Medium (maintainability / auditability) · **Effort:** S · **Areas:** 14 / 38
- **What's wrong:** `counter_handshake.sql` creates stations/staff_sessions/token columns + ~10 RPCs, dropped one migration later, never recreated, zero app references. It misled the structural spec into believing token-id ledger-replay protection exists — it does not.
- **Evidence:** `supabase/migrations/20260613090000_counter_handshake.sql` vs `supabase/migrations/20260613100000_self_service_stamping.sql:41-74`
- **Fix:** Delete the orphaned `counter_handshake.sql` body (or squash the create+drop pair). Document that self-service stamping has **no token-id idempotency layer** (one-per-day index is the replay guard).
- **Acceptance criteria:** Dead SQL removed/squashed; a short note in the stamping docs states the actual replay-protection mechanism.

### `[x]` M6 — Self-serve stamping can be earned off-premises

- **Severity:** Medium · **Effort:** M (or decision) · **Area:** 15
- **What's wrong:** The only mandatory presence signal is a non-empty `qr_id` matching an active join QR — but `qr_id` is a deterministic, human-readable, photographable venue slug with no nonce/expiry. Geofence only evaluates on cycle-stamp #3 and is flag-only. _Mitigated_ by a hard one-per-UK-day-per-location cap + rate (10/15min) + velocity flags.
- **Evidence:** `supabase/migrations/20260626090000_require_merchant_billing.sql:999-1054` · `supabase/migrations/20260626120000_venue_slug_qr_id.sql:140` · `supabase/migrations/20260620110000_soft_geofence_precision_tuning.sql:226-302`
- **Fix (if the moat needs it):** Rotate/sign the QR token (short-TTL nonce) so a photographed code expires; consider geo-flagging stamps #1–2. **Or** explicitly accept as a deliberate frictionless trade-off and document the decision.
- **Acceptance criteria:** Either a photographed code expires within the TTL, or a written decision records the accepted trade-off and its bounding controls.

### `[x]` M7 — Fraud review queue is write-only

- **Severity:** Medium (process maturity) · **Effort:** S–M · **Area:** 16
- **What's wrong:** `fraud_flags.status` defaults `open`; `'reviewed'/'dismissed'` appear only in the CHECK constraint, never in a mutation. The UPDATE policy + `updated_at` trigger exist but are never exercised; `/admin/fraud` is read-only.
- **Evidence:** `supabase/migrations/20260606142000_initial_schema_rls.sql:190-201` · `app/admin/fraud/page.tsx:19-35` · `lib/admin/data.ts:139-174`
- **Fix:** Build the triage loop the schema anticipates — a `requireAdminAction` RPC to set status to `reviewed`/`dismissed` plus UI actions on `/admin/fraud`.
- **Acceptance criteria:** An admin can resolve a flag from the UI; status persists; the action is audit-logged.
- **Repo evidence now present:** The fraud route renders a colocated `FraudFlagsPanel`; that panel owns the reviewed/dismissed forms, calls `resolveFraudFlagAction`, and is covered by the architecture hardening source contract plus authenticated browser proof.

### `[x]` M8 — `create_or_get_join_qr` can mint a new slug when a disabled join QR exists

- **Severity:** Medium (latent) · **Effort:** S · **Area:** 17
- **What's wrong:** The "return existing" SELECT filters `and qr_codes.is_active`, so a disabled row is skipped → the function INSERTs a new active row; the slug collision check (no `is_active` filter) then suffixes it (e.g. `old-crown-2`), orphaning posters printed with the original URL. _Not currently reachable_ (the app routes disabled rows to `set_qr_active`), but the invariant is call-site-only.
- **Evidence:** `supabase/migrations/20260630120000_require_three_rewards_for_join_qr.sql:52,66-113` · `supabase/migrations/20260626120000_venue_slug_qr_id.sql:61-66`
- **Fix:** Make the RPC self-defending — include disabled rows in the "return existing" lookup (re-enable in place), or block the INSERT when any join row already exists for the location.
- **Acceptance criteria:** Calling the RPC when a disabled join row exists re-enables it with the same slug; it never mints a second/ suffixed slug.

### `[x]` M9 — `safePath` open-redirect bypass via embedded tab/whitespace

- **Severity:** Medium · **Effort:** S · **Areas:** 21 / 44
- **What's wrong:** The shared guard rejects only `//`, `/\`, non-`/` prefixes, and auth-loop paths; an interior tab (`/\t/evil.com`) passes because `value()`/`trim()` strips only leading/trailing whitespace. WHATWG repro: `new URL('/\t/evil.com', origin)` → `https://evil.com/`. Three live `redirect()` sinks. `auth/confirm` already does the correct full-URL same-origin parse — the shared helper is the inconsistent weak point.
- **Evidence:** `lib/navigation/safe-next-path.ts:21-31` · `app/(auth)/actions.ts:202,254` · `app/home/actions.ts:129,163` · (correct pattern: `app/auth/confirm/route.ts:14-24`)
- **Fix:** In the shared helper, strip/reject all interior control/whitespace (tab/CR/LF) before the `//` check, **or** adopt `new URL(value, origin)` + `url.origin === origin` so every caller is hardened uniformly.
- **Acceptance criteria:** `/\t/evil.com` (and CR/LF variants) are rejected; a unit test covers the payloads; all three sinks use the hardened helper.

---

## ⚪ Low

### `[x]` L1 — Delivery worker ignores customer-configured quiet hours

- **Effort:** S · **Area:** 50 — `isWithinQuietHours(now)` is called with no args → always hardcoded `21:00`–`09:00`; `getPreferences` reads the columns but never threads them in; DB default is `20:00` (1h disagreement); RPC/API/UI only handle 3 booleans (no time picker). `lib/notifications/delivery-worker.ts:183-186,156-159` · `supabase/migrations/20260622130000_browser_push_notifications.sql:6`. **Fix:** thread `state.quietHours*` into the call + add write/display paths, **or** remove the vestigial columns/state and align the default to `20:00`. **AC:** custom quiet hours honored end-to-end, or dead plumbing removed and default aligned.

### `[x]` L2 — Immutability trigger doesn't pin `auth_user_id`

- **Effort:** S · **Area:** 1 — The contact-immutability trigger guards email/phone/hmac/ciphertext/last4/country/verified_at but not `auth_user_id`; customer profile UPDATEs use the service-role client (bypasses the RLS with-check), so the trigger is the sole DB defense. `supabase/migrations/20260617120000_customer_contact_immutability.sql:7-26`. **Fix:** add `auth_user_id` to the guarded columns. **AC:** a service-role attempt to re-point `auth_user_id` on an existing customer is blocked. _(Currently unreachable — cheap insurance for a takeover-adjacent invariant.)_

### `[x]` L3 — Reward-pool mutation RPCs don't enforce the ≥3 minimum

- **Effort:** S · **Area:** 8 — `upsert_reward_pool_item`/`delete_reward_pool_item` have no post-mutation active-count re-check and never disable the QR; the ≥3 gate is lazy (raised at the unlocking stamp = fail-closed). `supabase/migrations/20260624120000_remove_minimum_spend.sql:162-287` · `app/app/card/actions.ts:181-272`. **Fix:** warn (or block) when an edit drops the active pool below 3 for a live join QR, and/or auto-disable the QR. **AC:** dropping below 3 surfaces a merchant warning. _(Fail-closed today — UX gap, no over-issuance.)_

### `[x]` L4 — Stripe webhook double-inserts analytics on a transient mark-processed error

- **Effort:** S · **Area:** 30 — `recordProductEvent` runs _before_ `markStripeWebhookEventProcessed`; if mark-processed throws, the retry re-runs the handler and re-inserts analytics (no idempotency key on `product_events`). Billing stays correct (`syncStripeSubscription` is an idempotent upsert); only analytics counts inflate. `app/api/stripe/webhook/route.ts:53-58` · `lib/analytics/events.ts:51-60`. **Fix:** move `recordProductEvent` after mark-processed, or add a `stripe_event_id` dedupe key. **AC:** a replayed event doesn't double-count analytics.

### `[x]` L5 — Partial multi-subscription push marks event terminally "sent"

- **Effort:** S · **Area:** 49 — If any subscription succeeds, the event is marked `sent`, so a retryable failure on a sibling endpoint is recorded but never requeued (`attemptNumber` is per-event, not per-subscription). `lib/notifications/delivery-worker.ts:227-236,262-285`. **Fix:** track delivery state per subscription, or requeue when any endpoint hits a retryable failure. **AC:** a retryable secondary-endpoint failure is retried. _(Low — most users have one subscription; state-based producers re-enqueue later.)_

### `[x]` L6 — `enforce_rate_limit` cold-bucket first-insert race

- **Effort:** S · **Area:** 38 — `select … for update` then an unguarded INSERT on `if not found`; two concurrent first-callers for a new bucket both INSERT → the second raises `23505`, which falls through to a generic Error (fail-closed, self-heals on retry). `supabase/migrations/20260613120000_fix_rate_limit_current_time.sql:30-40`. **Fix:** `insert … on conflict (bucket_key) do update set count = count + 1`. **AC:** concurrent cold-bucket first calls never raise `23505`.

### `[x]` L7 — Wallet shows dateless "phantom" stamp dots on counter-vs-ledger drift

- **Effort:** S · **Area:** 32 — `reconcileCardStampCount` uses `Math.max(membershipCount, stampDateCount)`, biasing to the higher counter; surplus dots render with `date=undefined` yet are asserted as "earned". The single-card detail view pads differently (inconsistency). `lib/customer/card-stamps.ts:129` · `lib/customer/home.ts:195-206` · `components/loyalty/stamp-grid.tsx:137,154`. **Fix:** prefer the ledger count (or pad like the detail view) so "N of M" never asserts a stamp the event log can't substantiate. **AC:** wallet never shows a dateless earned dot. _(Honesty wrinkle; rare precondition.)_

### `[x]` L8 — Landing "venue proof" pairs real venues with venue-voiced quotes, no "illustrative" disclosure

- **Effort:** S · **Area:** 55 — Blockquotes under "In their words" / "Real words from … venues" with a "From the team" signoff use real venue names+postcodes, but the quote _wording_ is editorial copy; the anti-fake guard forbids inventing a name, not a quote. `components/marketing/landing/venue-proof-reviews.tsx:124,145-147` · `venue-proof-data.ts`. **Fix:** add an "illustrative operator voice / paraphrased" disclosure, or source verified quotes. **AC:** the section discloses provenance or uses verified testimony. _(The exact soft pattern the "no fake social proof" theme targets.)_

### `[x]` L9 — Analytics event-name taxonomy has drifted (no enforcing guard)

- **Effort:** S · **Area:** 58 — `ProductEventName = (canonical names) | string` — the `| string` escape hatch defeats compile-time enforcement; ≥6 emitted names are absent from the canonical list; funnels/pilot-report read fixed arrays so drifted events persist invisibly. `lib/analytics/events.ts:5-36`. **Fix:** remove `| string` (force all emit sites into the union) or add a CI/test guard that fails on out-of-list names. **AC:** emitting an uncanonical event name fails typecheck or CI.

### `[x]` L10 — `product_events` DB insert isn't PII-sanitized

- **Effort:** S · **Area:** 58 / 40 — `recordProductEvent` inserts `metadata` verbatim; `sanitizeMetadata` is applied only to the PostHog body, not the persisted row. No current call site carries PII, and the highest-PII path is independently scrubbed — latent gap. `lib/analytics/events.ts:51-60,94`. **Fix:** apply `sanitizeMetadata` inside the DB insert too + add a test. **AC:** a call site adding a phone/email/coordinate key cannot persist it into `product_events` (which would also complicate erasure once H1 ships).

---

_Generated from the 2026-06-30 verified audit (102-agent workflow). Per-domain area detail and the full adversarial verdict set are in the workflow output; this file captures the actionable confirmed subset._

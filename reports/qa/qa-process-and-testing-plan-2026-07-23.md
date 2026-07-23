# Nabaperks — QA Process & Testing Plan

**Date:** 23 July 2026
**Basis:** Static inspection of the repository at commit `46ae53a7` (branch point of `claude/codebase-qa-testing-plan-2b4488`). No application code was modified. **No test suite was executed for this report** — every statement about an existing test describes its presence and design in the repository, not a fresh pass/fail result. Where a check runs in CI, that is stated as CI behaviour, not as a result observed by this assessment.
**Evidence convention:** every material claim cites a repo-relative path (with line numbers where load-bearing). Items that could not be verified from the repository are marked **UNVERIFIED** and collected in §30.

---

## 1. Executive summary

Nabaperks is a multi-tenant, QR-first digital loyalty platform for UK hospitality (pubs, cafés, bars, takeaways) operated by Lapen Inns. Customers scan a venue QR, verify a phone number by Twilio OTP, accept terms, and collect one stamp per Europe/London calendar day; completing a card unlocks a weighted "mystery reward" that is redeemed next business day via a short-lived QR token scanned by the merchant. Merchants run a £49/month (£490/year) Stripe subscription with a 30-day trial; billing lapse fails the loyalty programme closed. The stack is Next.js 16 App Router + React 19 on Vercel (region `lhr1`), Supabase Postgres 17 with forced RLS and SECURITY DEFINER RPCs, Stripe, Twilio Verify, Resend, and Web Push.

**QA maturity is unusually high for a pre-launch product.** The repository already contains five proof layers (~98 contract, ~120 unit, ~61 live-DB, ~92 Playwright spec files, 2 k6 load scripts — roughly 2,100 grep-counted cases), a 12-job CI pipeline with five stable required gates, mutation testing, Lighthouse budgets, bundle budgets, an OWASP ZAP baseline, CodeQL, a 15-minute production smoke monitor that auto-files incident issues, and nine bespoke governance gates (design tokens, banned claims, JSON-LD, env contract, feature-flag lifecycle, migration hygiene, debt markers, dead code, duplication). The database is the enforcement boundary: every loyalty mutation runs through ownership-checked RPCs, all 37 tables force RLS, and function EXECUTE was revoked-then-allowlisted (`supabase/migrations/20260711090000_rpc_execute_privilege_containment.sql`) with a live catalogue proof test (`tests/db/rpc-execute-privilege-containment.test.mjs`).

**The gaps are therefore structural, not volumetric.** The highest-impact findings of this assessment:

1. **The default test gate proves no behaviour.** `pnpm test` = contracts + unit only; contracts are grep-style source-shape assertions and units are pure functions. All customer-behaviour proof lives in the `db` and browser CI jobs (`docs/architecture-flows/customer-coverage-matrix.md:19-21`).
2. **The DB behavioural moat is not a required merge gate.** CI's `db` job (live Postgres invariants: RLS, races, GDPR, referral, billing fail-closed) has no rollup gate job, unlike e2e/a11y/visual/lighthouse (`.github/workflows/ci.yml`). A broken ledger invariant may not block merge. _(Branch-protection config itself is UNVERIFIED from the repo.)_
3. **The five live-DB Playwright specs silently skip in every CI browser job** (`SUPABASE_DB_URL` is only set in the `db` job), so browser-over-real-database join/QR coverage never runs in CI.
4. **Two production cron route handlers have zero end-to-end tests** (`app/api/cron/notifications/route.ts`, `app/api/cron/referral-bonus-drain/route.ts`) despite running every 15 minutes in production.
5. **No CAPTCHA of any kind exists** — bot/abuse defence is durable rate limiting only, and rate-limit client identity trusts only `x-vercel-forwarded-for` (`lib/security/rate-limit-core.ts:21-26`).
6. **Admin MFA was deliberately removed** (`supabase/migrations/20260720100000_remove_admin_aal2_requirement.sql`) — destructive admin powers (stamp adjustment, reward cancellation, PII erasure) sit behind a password-only Supabase session plus an `internal_admins` row.
7. **Recovery is unproven:** Supabase daily backups exist but point-in-time recovery is disabled and no restore drill has been run (`docs/operations/production-runbook.md:98-103`).
8. **Provider acceptance is external:** live Stripe/Twilio/Resend/Web Push/cron behaviour, Supabase migration parity, and physical QR scanning cannot be proven from source; the repo ships the verifiers (`pnpm smoke:providers`, `pnpm smoke:supabase:migrations`, the runbook's Stripe live-acceptance gate) but their execution must be evidenced before launch.

One feared Critical defect was **investigated and refuted during this assessment**: redeeming an issued (birthday/merchant-direct) reward does _not_ drain the customer's stamp cycle — `supabase/migrations/20260704091000_issued_reward_source_gates.sql:378-395` branches the membership update by reward source, and `tests/db/issued-rewards-*.test.mjs` cover it. The episode is itself instructive: RPC bodies are redefined across many migrations, so **catalogue-vs-intent drift is a first-class QA risk** (§8, R-04).

The launch-blocking work (§29 "Immediate") is: make the DB moat a required gate; add cron route handler tests; run the provider-acceptance and restore-drill evidence gates; wire (or consciously retire) the live-DB browser lane; resolve four product-owner decisions (admin MFA, `past_due` grace, telemetry-without-consent, referral qualification via invite stamps); and execute the manual device/print matrix that no automation covers (camera scanning, printed QR, real OTP delivery, push on real devices).

---

## 2. Product and architecture understanding

### 2.1 What the product does

- **Merchant side** (`/app/*`): guided launch (venue → card → ≥3 rewards → billing → permanent QR), printable A4 posters and table tents with the live QR (`components/merchant/qr-poster/**`, `lib/notifications/poster-pdf-*.ts`), dashboard KPIs and activity readback with masked PII, member list, direct reward sending, bulk two-stamp email invitations, push announcements, reward scanner, Stripe billing and portal, account/profile.
- **Customer side** (phone-first, no app store): `/q/[qrId]` scan router → `/m/[slug]/join` wizard (phone OTP → terms) → `/card/[membershipId]` stamp card → `/reward/[rewardId]` redemption with profile/age/email gate → merchant collects via `/r/[token]` → `/app/rewards/scan/[scanToken]`. A wallet at `/home` (cards, rewards, activity, profile, marketing consent, push settings) with phone-OTP login.
- **Admin side** (`/admin/*`): pilot reporting, merchant/customer/QR intervention, stamp adjustment, reward cancellation, fraud flags, referral ops, billing readback, GDPR (consent log, export, erasure, unaffiliated lookup), audit log. Every action requires an operator reason and is audit-logged.
- **System side**: 6 Vercel crons (notification drain, referral bonus drain, loyalty-invite drain, birthday rewards, weekly merchant digest, privacy retention — `vercel.json`), Stripe/Resend/Supabase-auth webhooks, first-party `product_events` analytics, web-vitals collection, PWA with offline shell.

### 2.2 Architectural principle: server state is authoritative

Loyalty balances, stamps, rewards, billing entitlement, consent, identity, and admin interventions are controlled by server actions → SECURITY DEFINER RPCs → RLS-protected tables (`AGENTS.md:48-50`). Browser storage is cache/continuity only. Direct table writes from clients are impossible for ledgers (insert policies are admin-only; writes go through service-role RPCs — `supabase/migrations/20260606142000_initial_schema_rls.sql`). Query parameters are UI hints and never grant state. Consequence for QA: **the trust mechanics must be tested at the database layer (live-DB tier), not through the browser**, and browser tests exist mainly to prove markup, gates, and journeys.

### 2.3 Route families

| Family           | Routes                                                                                                                    | Shell              | Gate                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------- |
| Marketing/SEO    | `/`, `/pricing`, `/about`, `/how-it-works`, `/loyalty-for-*` ×4, `/guides/*` ×3, `/demo`                                  | `MarketingLayout`  | public; outside proxy matcher (CDN-cacheable, static CSP)     |
| Legal            | `/privacy`, `/terms`, `/cookies`, `/merchant-terms`, `/data-processing`, `/merchant/[slug]/terms`                         | Legal/Customer     | public                                                        |
| Merchant auth    | `/signup`, `/signup/verify`, `/login`, `/reset-password`, `/auth/confirm`                                                 | focused marketing  | anti-enumeration server actions (`app/(auth)/actions.ts`)     |
| Merchant console | `/app/*` (17 pages + 3 redirects)                                                                                         | `MerchantAppShell` | `app/app/layout.tsx:25-27` redirect via `getCurrentUser`      |
| Customer         | `/q/[qrId]`, `/m/[slug]`, `/m/[slug]/join`, `/card/*`, `/reward/*`, `/claim/*`, `/invite/*`, `/scan`, `/start`, `/home/*` | Customer shells    | signed customer-session cookie + DB session row               |
| Reward handoff   | `/r/[token]` → `/app/rewards/scan/[scanToken]`                                                                            | —                  | UUID guard then merchant session                              |
| Admin            | `/admin/*` (9 pages)                                                                                                      | `AdminShell`       | `getAdminAccess` (`lib/admin/auth.ts:19`) + `internal_admins` |
| APIs             | 23 `app/api/**` routes + 5 non-api handlers                                                                               | —                  | per-route (see §11)                                           |
| Dev harness      | `/dev/*` (~20 pages)                                                                                                      | real shells        | `notFound()` in production (`app/dev/layout.tsx:31-33`)       |

### 2.4 Two independent identity systems

Merchants/admins use Supabase Auth (email+password, email OTP via a Resend-backed send-email hook, `@supabase/ssr` cookies). Customers use a custom system: Twilio Verify phone OTP → signed HttpOnly cookie **plus** a revocable DB session row (`lib/customer/session.ts:153-231`) — a cookie alone is insufficient. This split doubles the authentication test surface (§13).

---

## 3. Confirmed technology stack

All confirmed from the repository (files cited); nothing below is assumed.

| Layer                 | Technology                                                                                                                                                                                | Evidence                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Framework             | Next.js 16.2.10, App Router, webpack build (`next build --webpack`)                                                                                                                       | `package.json:9,108`; `next.config.ts`                                                           |
| UI                    | React 19.2.7, Tailwind CSS 4, shadcn-style primitives, Radix, `motion`, sonner toasts                                                                                                     | `package.json:95-121`; `components/ui/*`                                                         |
| Language              | TypeScript 6, strict; ESLint 9 zero-warnings; Prettier                                                                                                                                    | `tsconfig.json`; `eslint.config.mjs`; `package.json:31`                                          |
| Middleware            | `proxy.ts` (Next 16 middleware): session refresh, CSP nonce, request-id, security headers, join/device cookies                                                                            | `proxy.ts:40-209`                                                                                |
| Database              | Supabase Postgres 17; 122 forward-only migrations; RLS enabled+forced on all 37 live tables; SECURITY DEFINER RPCs                                                                        | `supabase/config.toml`; `supabase/migrations/**`                                                 |
| Auth (merchant/admin) | Supabase Auth (password + 6-digit email OTP, confirmations on, hook-delivered via Resend)                                                                                                 | `supabase/config.toml:228`; `app/api/auth/hooks/send-email/route.ts`                             |
| Auth (customer)       | Twilio Verify phone OTP + custom signed cookie + DB session registry                                                                                                                      | `lib/customer/verification.ts`; `lib/customer/session.ts`                                        |
| Billing               | Stripe SDK v22, hosted Checkout (30-day trial), Customer Portal, signed webhook, pinned API `2026-06-24.dahlia`                                                                           | `lib/stripe/server.ts:7-13`; `lib/stripe/checkout.ts`; `app/api/stripe/webhook/route.ts`         |
| Email                 | Resend REST API (OTP, rewards, invites, digest, poster PDF); Svix-signed delivery webhook                                                                                                 | `lib/notifications/resend.ts`; `app/api/resend/webhook/route.ts`                                 |
| Push                  | `web-push` (VAPID), SW `push`/`pushsubscriptionchange` handlers, delivery worker + outbox                                                                                                 | `lib/notifications/push-sender.ts`; `public/sw.js:68-77`                                         |
| QR                    | `qrcode` (generation), `html5-qrcode` (camera scan), `pdf-lib` posters/tents                                                                                                              | `lib/qr/assets.ts`; `components/*/­*-scanner.tsx`                                                |
| Hosting               | Vercel, single region `lhr1`, 6 crons, env-gated build                                                                                                                                    | `vercel.json`                                                                                    |
| Observability         | Sentry (server/edge/client, DSN+flag gated, PII-scrubbed URLs, 0.1 traces), structured JSON logger, request IDs, `/api/health` + secret-gated `/api/readiness`                            | `instrumentation.ts`; `lib/observability/*`; `app/api/{health,readiness}/route.ts`               |
| Analytics             | First-party `product_events` (Supabase) + `web_vital_samples`; optional server-side pseudonymous PostHog (off by default)                                                                 | `lib/analytics/events.ts:99-186`; `app/api/analytics/*`                                          |
| PWA                   | Hand-written `public/sw.js` (v3), network-only for all authed surfaces, offline shell, install prompt                                                                                     | `public/sw.js`; `components/pwa/app-pwa.tsx`                                                     |
| Test runners          | node:test (contracts/unit/db), Playwright 1.61 (+axe), fast-check, Stryker, k6, Lighthouse CI, ZAP                                                                                        | `package.json:13-30`; `playwright.config.ts`; `stryker.conf.json`; `.lighthouserc.json`; `.zap/` |
| CI                    | GitHub Actions: `ci.yml` (12 jobs, 5 required gates), `nightly.yml`, `production-smoke.yml` (15-min probes → incident issues), `codeql.yml`, `dependency-review.yml`, `release-notes.yml` | `.github/workflows/*`                                                                            |
| Env contract          | 45-entry `config/env-contract.json` + profile-aware validator (entropy, VAPID pair-match, prod-required set)                                                                              | `scripts/check-env.mjs`                                                                          |

**Notable absences (confirmed, do not test for):** no CAPTCHA/Turnstile (only a commented `[auth.captcha]` block in `supabase/config.toml`), no browser Stripe.js/Payment Element, no browser PostHog SDK, no cookie-consent banner, no Supabase Storage buckets, no Sentry tunnel/Replay, no generic third-party developer API.

---

## 4. User roles and permissions

### 4.1 Roles

| Role                            | Authentication                                                                                                                                  | Resolver                                                          | Can                                                                                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor               | none                                                                                                                                            | —                                                                 | Marketing/legal pages, `/q/[qrId]` scan, `/m/[slug]` preview, analytics beacons, `/api/health`                                                                   |
| Prospective customer (pre-join) | pending-phone signed cookie (10 min)                                                                                                            | `lib/customer/session.ts:40-123`                                  | OTP request/verify in join wizard                                                                                                                                |
| Customer                        | phone OTP → signed 30-day cookie + DB session                                                                                                   | `getCurrentCustomer` (`lib/customer/identity.ts:32`)              | Own cards/stamps/rewards/activity/profile/consent/push; self-stamp with QR proof; mint own reward token                                                          |
| Merchant owner                  | Supabase email+password (+email OTP verify/reset)                                                                                               | `getCurrentMerchant` (`lib/auth/session.ts:19`)                   | Own venue config, QR, posters, members readback (masked), send reward, invites, announcements, scanner, billing                                                  |
| Venue staff                     | _no separate role_ — uses the merchant session; staff-PIN subsystem excised (`supabase/migrations/20260707092000_staff_subsystem_excision.sql`) | —                                                                 | Same as merchant owner                                                                                                                                           |
| Internal admin                  | merchant Supabase session **+** active `internal_admins` row; **no MFA requirement** (`20260720100000`)                                         | `getAdminAccess`/`requireAdminAction` (`lib/admin/auth.ts:19,64`) | All `/admin/*`; audited RPCs: stamp adjust, reward cancel, QR toggle/regenerate, fraud resolve, consent opt-out, GDPR export/erase, referral review, pilot notes |
| Cron/system worker              | `Bearer CRON_SECRET` (timing-safe, fail-closed)                                                                                                 | `lib/security/cron-auth.ts:10-28`                                 | The 6 cron endpoints                                                                                                                                             |
| Monitor                         | `Bearer PRODUCTION_MONITOR_SECRET` (must differ from CRON_SECRET — `scripts/check-env.mjs:249-251`)                                             | `app/api/readiness/route.ts:20-24`                                | `/api/readiness` only                                                                                                                                            |
| Webhook callers                 | Stripe signature / Svix HMAC / Standard-Webhooks HMAC                                                                                           | per-route                                                         | `/api/stripe/webhook`, `/api/resend/webhook`, `/api/auth/hooks/*`                                                                                                |

### 4.2 Permission matrix (enforcement points)

| Capability                                 | Anon                                     | Customer                          | Merchant                                   | Admin               | Enforced at                                                                                                         |
| ------------------------------------------ | ---------------------------------------- | --------------------------------- | ------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| View venue preview `/m/[slug]`             | ✅                                       | ✅                                | ✅                                         | ✅                  | public page                                                                                                         |
| Join venue (create membership)             | via OTP flow                             | ✅ own                            | ❌                                         | via RPC             | `join_customer_membership` requires verified phone/email (`20260713110000`)                                         |
| Self-stamp                                 | ❌                                       | ✅ own membership + live QR proof | ❌                                         | —                   | service-role RPC + app session check (`app/card/[membershipId]/actions.ts:32`; 8-arg RPC `20260710180000:521-553`)  |
| Mint reward scan token                     | ❌                                       | ✅ own, eligible                  | ❌                                         | ❌                  | `create_reward_scan_token` (service-role only; ownership+gates in body)                                             |
| Collect/redeem reward                      | ❌                                       | ❌ (no authenticated grant)       | ✅ own-merchant token                      | via cancel          | `collect_reward_scan_token` service-role; merchant ownership re-checked (`lib/merchant/reward-collection.ts:81-92`) |
| Edit venue/card/rewards                    | ❌                                       | ❌                                | ✅ own (`p_merchant_id` re-checked in RPC) | ✅ audited          | RPC `insufficient_privilege` raises (`20260626090000:109,371,579`)                                                  |
| Read members/activity                      | ❌                                       | own only                          | ✅ own venue, masked DTOs                  | ✅                  | RLS `owned_merchant_ids()` (`20260710090000`); masking `lib/merchant/*readback*`                                    |
| Billing checkout/portal                    | ❌                                       | ❌                                | ✅ own                                     | read-only           | `app/app/billing/actions.ts:40,104`                                                                                 |
| Adjust stamps / cancel rewards / erase PII | ❌                                       | ❌                                | ❌                                         | ✅ + reason + audit | `requireAdminAction` + in-RPC `is_internal_admin()` (`lib/admin/auth.ts:64`; `20260630130000:17`)                   |
| Execute privileged RPCs directly           | ❌ (anon fully revoked `20260606165000`) | only 23-function allowlist        | same list                                  | same list           | ACL proof: `tests/db/rpc-execute-privilege-containment.test.mjs:27-80`                                              |
| Call crons / readiness                     | ❌                                       | ❌                                | ❌                                         | ❌                  | bearer secrets only                                                                                                 |

Every row above must have at least one negative test (attempt by a disallowed role); §21 maps them.

---

## 5. Critical user journeys

Derived from routes, actions, and RPCs. Priority: P0 = launch-blocking correctness, P1 = must work before launch, P2 = important.

### J1 — Merchant signup and email verification (P1)

- **Role:** anonymous → merchant. **Entry:** `/signup`. **Preconditions:** none.
- **Steps:** submit name/email/password (`signUpAction`, `app/(auth)/actions.ts:84`) → Supabase creates unconfirmed user → send-email hook wraps OTP in alias, delivers via Resend (`app/api/auth/hooks/send-email/route.ts:60-79`) → `/signup/verify` submits 6-digit code (`signupOtpAction`) → session established → redirect `/app/onboarding`.
- **Outcome/data:** `auth.users` row confirmed; `merchant_email_otp_aliases` consumed. **Services:** Supabase Auth, Resend.
- **Failure risks:** hook secret unset (500 → no email); alias attempt limits; enumeration via copy differences; rate limit 3/15 min per email+IP (`:783`).
- **Tests:** exists — e2e `merchant-signup-verify.spec.ts`, `auth-hook-routes.desktop.spec.ts`, unit `merchant/email-otp-*`; missing — live Resend inbox proof (manual/provider smoke).

### J2 — Onboarding → launch readiness (P1)

- **Role:** merchant. **Entry:** `/app/onboarding`. **Preconditions:** J1.
- **Steps:** business name + address (Google Places optional) → `complete_merchant_onboarding` (atomic merchant+location+card, advisory-locked, idempotent — `20260710100000`) → `/app/launch` tabs: venue (geofence optional), card (stamps 1–99), ≥3 active rewards, billing, QR.
- **Outcome:** `buildLaunchReadiness` gates all-green (`lib/merchant/launch-readiness-core.ts:200-213`); join QR provisionable only after billing (`lib/merchant/ensure-join-qr.ts`).
- **Failure risks:** readiness predicate duplication (TS vs DB `loyalty_availability_reason`); `trial`↔`trialing` normalization; QR activated bypassing gates (guarded `20260630132000`, `20260710110000` trigger).
- **Tests:** exists — db `merchant-onboarding-transaction`, `reward-pool-lifecycle`; e2e `merchant-launch-setup`, `merchant-onboarding-continuity`; unit launch-readiness. Missing: cross-layer availability-parity test (§12).

### J3 — Stripe checkout, webhook, entitlement (P0)

- **Role:** merchant. **Entry:** `/app/account?tab=billing`. **Preconditions:** J2 partial.
- **Steps:** `startCheckoutAction` → durable attempt claim (`claim_billing_checkout_attempt`) → hosted Checkout (30-day trial, `trial_period_days:30`, `lib/stripe/checkout.ts:339`) → return verified against exact session+subscription (`confirmBillingCheckoutReturn:593`) → webhook events claimed/leased/applied (`apply_stripe_subscription_event`, `applied|stale`).
- **Outcome/data:** `billing_customers` mirrors subscription; `billing_checkout_attempts`, `stripe_webhook_events` ledgers. **Services:** Stripe.
- **Failure risks:** duplicate/reordered/replayed webhooks; checkout-return spoofing (query string must not grant entitlement); metadata/ownership mismatch; oversized payloads (1 MiB cap, 413).
- **Tests:** exists — db `billing-state-durability`, unit `stripe-webhook-events`, `billing-checkout-core/return`; e2e billing-recovery visuals. Missing: live-mode acceptance (runbook gate, `docs/operations/production-runbook.md:24-44`), out-of-order event sequence test.

### J4 — Customer QR scan → join → first stamp (P0)

- **Role:** anonymous → customer. **Entry:** printed QR → `/q/[qrId]`.
- **Steps:** QR resolved service-role-side; rate-limited (identity 120/60 s, code 60/60 s — `lib/customer/join.ts:100-111`); availability = active QR+card+merchant+billing; new visitor → `/m/[slug]/join?step=welcome` → phone (`requestCustomerIdentityAction`) → Twilio OTP (`verifyCustomerOtp`) → terms+optional consent (`joinRewardsAction`) → `join_customer_membership_with_first_stamp` (join + first stamp atomic; immutable terms snapshot SHA-256; `20260713110000:21-283`).
- **Outcome/data:** `customers` (phone HMAC+ciphertext+last4), `customer_sessions`, `customer_memberships`, first `stamp_events`, `customer_loyalty_terms_acceptances`, optional `consent_records`.
- **Failure risks:** Twilio unavailable (fail-closed `lib/customer/verification.ts:60-69`); first stamp best-effort → 0-stamp card (recovery: `retryJoinFirstStampAction`, `customer_join_stamp_recoveries`); paused/billing-blocked QR must render safe states; OTP bypass envs must be inert outside local (`verification.ts:196-215`).
- **Tests:** exists — db `customer-lifecycle`, e2e join flows + 5 live-DB specs (skip in CI), `public-qr-router*`. Missing: CI execution of live-DB browser specs; real-device Twilio proof (manual).

### J5 — Returning visit stamp, one per UK day (P0)

- **Role:** customer. **Entry:** scan venue QR → `/card/[id]/stamp`.
- **Steps:** `selfStampAction` re-derives QR context (`app/card/[membershipId]/actions.ts:32-43`) → 8-arg `issue_self_service_stamp` (QR proof required; membership `FOR UPDATE`; billing entitled; one-per-`(membership,location,earned_business_date)` partial unique index; 10/15 min rate bucket; velocity fraud flag ≥20/15 min; soft geofence evidence).
- **Outcome:** `stamp_events` +1; counters advance; reward unlock on completion (weighted pool, first cycle deterministic).
- **Failure risks:** double-tap/concurrent double stamp (index + lock must win); London-midnight and BST/GMT boundary; bonus/invite stamps use NULL business date by design — must not collide nor double-issue; counters vs ledger desync.
- **Tests:** exists — db `customer-card-stamp`, `customer-stamp-edges`, `architecture-moat` (committed race), e2e stamp choreography. Missing: DST-boundary cases, counter-vs-ledger reconciliation assertion (§12).

### J6 — Card completion → mystery reward → next-business-day gate (P0)

- **Steps:** completing stamp draws from ≥3-item pool (raises otherwise); `reward_events` `status=unlocked`, `redeemable_from = next_uk_business_date` (skips Sat/Sun); UI states derived from server facts only.
- **Failure risks:** pool edited below 3 with live QR (DB-guarded `20260710110000`); weighted draw fairness; Friday-completion → Monday redeemable; snapshot of name/terms must survive later pool edits.
- **Tests:** exists — db `reward-pool-lifecycle`, `customer-lifecycle` (next-day redeem), unit `uk-date`/`uk-calendar` (+property tests). Missing: explicit weekend/bank-holiday expectation record (bank holidays are _not_ skipped — confirm intent, §30-Q6).

### J7 — Redemption: profile gate → scan token → merchant collect → next cycle (P0)

- **Steps:** `/reward/[id]` completes name/DOB (18+) and email verification (`app/reward/[rewardId]/actions.ts`; DB backstop `20260703120000:119-122,281-284`) → mint token (`create_reward_scan_token`: ownership, unlocked, redeemable-from passed, stamps≥required for stamp_cycle only, 10-min expiry, reuse window >5 min) → `/reward/[id]/qr.png` (private, no-store) → merchant scans `/r/[token]` → `/app/rewards/scan/[scanToken]` → `confirmMerchantRewardCollectionAction` → `collect_reward_scan_token` (single consume, merchant ownership, source-aware cycle advance `20260704091000:378-395`).
- **Failure risks:** double redemption (conditional `WHERE status='unlocked'` + idempotent early return); cross-merchant token; expired token; admin-cancelled reward between mint and collect; customer poll endpoint leaking state (404-collapse verified `app/reward/[rewardId]/status/route.ts:32-36`).
- **Tests:** exists — db `reward-scan-single-use`, `reward-redemption-edges`, `issued-rewards-*`, `reward-billing-moat`; e2e reward-scan + redemption-second-factor. Missing: cancel-between-mint-and-collect race (§21 RWD-06).

### J8 — Issued rewards: direct gift & birthday (P1)

- **Steps:** `issue_merchant_direct_reward` (caps 1/membership/day, 100/merchant/day UK-date; billing fail-closed; expiry 1–365 d) or birthday cron (≤1/merchant/customer/year partial-unique across all statuses). Redemption shares J7 but leaves stamp cycle untouched.
- **Failure risks:** London-midnight cap boundary; gift to under-18 unredeemable (silent dead reward); cancelled birthday blocks re-issue for the year; expiry sweep flips status (`expire_due_reward_events`).
- **Tests:** exists — db `issued-rewards-*`, e2e send-reward + birthday-config/prompt. Missing: cap-boundary clock tests; expiry-sweep e2e.

### J9 — Referral "Bring a Regular" (P1)

- **Steps:** share `/m/[slug]?ref=CODE` → join records `attributed` (dupe-silent trigger) → friend's first genuine earned stamp → `qualified` → settle: velocity cap 2/day → `held(daily_bonus_limit)`, full card → `held(card_full)`, pool empty → `held(reward_unavailable)`; award = bonus stamp (NULL business date); drains via 15-min cron + pre-stamp self-drain; concentration >5/24 h → auto-reject + flag; admin review/clear; code rotate/pause.
- **Failure risks:** held-edge stranding (backoff vs cadence); qualification via `loyalty_invite`-source stamps not excluded (`qualify_referral_on_stamp` excludes only `referral_bonus|imported|manual_adjustment` — owner decision §30-Q4); rotation must not break attributed edges.
- **Tests:** exists — db referral suite ×8 (state machine, settlement, fraud, retry outbox, ops visibility), e2e attribution + bonus-stamp. Missing: cron route e2e (drain via HTTP), invite-stamp qualification case.

### J10 — Bulk loyalty invitations (P0 — newest surface)

- **Steps:** `/app/customers/invite`: paste ≤2000 emails → parse/dedupe → draft (eligibility: not member/suppressed/previously invited; 2000/24 h cap; advisory-locked one-active-campaign) → confirm (legal basis + 30-day link expiry) → 5-min cron drains ≤800 (skip-locked lease, ≤4 req/s Resend, per-recipient idempotency key) → Svix webhook maps delivered/bounced/complained (bounce/complaint suppress **globally**) → `/invite/[token]` sets cookie → claim at terms step → `claim_loyalty_invite` (single-consumer `FOR UPDATE`, card ≥3 stamps required, email identity binding, exactly 2 `loyalty_invite` stamps NULL-dated, recipient scrubbed).
- **Failure risks:** forwarded-link double claim; claim-vs-cancel race; `CUSTOMER_SESSION_SECRET` rotation invalidates all outstanding token hashes (no key versioning — `lib/loyalty-invites/tokens.ts`); Resend response without `id` strands status at `sent`; member-precedence (existing member claiming — fixed in `20260722100500`); campaign lifecycle (cancel from completed allowed).
- **Tests:** exists — e2e `merchant-invite-customers` (3 flows), db loyalty-invite RPC coverage via migrations' companion tests, unit `loyalty-invite-*`, webhook unit `standard-webhook`. Missing: cron drain route e2e; secret-rotation blast-radius test; stuck-`sent` reconciliation.

### J11 — Customer wallet login and profile (P1)

- **Steps:** `/home/login` phone OTP (enumeration-neutral copy `app/home/actions.ts:116,195`) → `/home` dashboard → rewards/activity → profile (name/DOB, marketing consent, push settings via `/api/notifications/push/*`) → sign-out revokes DB session (`/home/session/reset`).
- **Failure risks:** revoked session honoured over valid cookie; recycled-number takeover (accepted risk SEC-RISK-001, `docs/operations/security-risk-register.md`); push permission vs marketing consent separation.
- **Tests:** exists — e2e customer-login, home-dashboard/readback, notification-settings; db `customer-profile` (verified-contact immutability). Missing: multi-device session revocation e2e.

### J12 — Admin operations and GDPR (P0 for GDPR correctness)

- **Steps:** admin adjusts stamps / cancels reward / resolves fraud / toggles QR (reason + audit each); GDPR: `logDataRequestAction` → export download (`admin_export_customer_data` + invitations export) or erasure (`admin_erase_customer_pii` under `app.customer_erasure` GUC; sessions revoked, push disabled, invites scrubbed — `20260711093000`, `20260721100000`).
- **Failure risks:** non-admin calling admin RPCs directly (in-body `is_internal_admin()` must reject); erasure partial-failure ordering (invitation scrub before HMAC null — `app/admin/actions.ts:283-291`); export over-disclosure across venues (§30-Q7); ledger metadata retaining PII.
- **Tests:** exists — db `customer-erasure(+related-records)`, `customer-consent`, admin e2e (gates, redaction, privacy-export, authenticated-actions); contract shape checks on `lib/admin/auth.ts`. Missing: direct-RPC negative test as plain authenticated user for each admin\_\* function (partially covered by ACL test; add behavioural probe §21 ADM-03).

### J13 — Billing lapse fails loyalty closed (P0)

- **Steps:** Stripe marks subscription cancelled/suspended → webhook applies → entitlement triggers block stamp insert and reward unlock/redeem under per-merchant advisory lock (`20260713190000`); QR router renders unavailable state; `past_due` currently _keeps_ stamping/redeeming while failing launch-readiness (`lib/merchant/launch-readiness-core.ts` excludes `past_due`; RPCs block only `cancelled|suspended`).
- **Tests:** exists — db `reward-billing-moat`, `architecture-moat` billing-fails-closed, `billing-state-durability`. Missing: explicit `past_due` behaviour record + owner sign-off (§30-Q2).

### J14 — Announcements and push delivery (P2)

- **Steps:** `/app/announcements` POST `/api/notifications/venue-announcements` (merchant session; status+billing gates; daily London-date limit) → consent/preference/subscription-filtered enqueue (dedup keys) → 15-min cron leases (5-min visibility timeout, reclaim) → web-push send → 404/410 prunes subscription → customer readback.
- **Failure risks:** worker crash mid-batch (lease reclaim); marketing sent without consent (eligibility core); CSRF on the fetch-POST route (SameSite-lax only — §15); readback `limit` unclamped (`app/api/notifications/readback/route.ts:14-18`).
- **Tests:** exists — db notification durability suite ×5, unit frequency-cap/quiet-hours/eligibility, e2e announcements + notification-settings. Missing: cron route e2e; crash-mid-drain reclaim proof at HTTP level.

---

## 6. Codebase QA inventory

Risk: **C**ritical / **H**igh / **M**edium / **L**ow. "Existing tests" names representative suites, not exhaustive lists.

| Area                 | Relevant files                                                                                             | Purpose                                           | Risk | Existing tests                                                                                    | Missing tests                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| QR scan router       | `app/q/[qrId]/page.tsx`; `lib/customer/join.ts:90-291`                                                     | Resolve QR, rate-limit, route join vs stamp       | H    | e2e `public-qr-router*` (incl. 1 live-DB, CI-skipped); db `tenant-rls`                            | live-DB spec in CI; header-spoof rate-identity test                      |
| Join wizard + OTP    | `app/m/[merchantSlug]/join/**`; `lib/customer/verification.ts`; `lib/customer/session*.ts`                 | Phone OTP, terms, membership+first stamp          | C    | e2e join flows ×6; db `customer-lifecycle`; unit otp-rate-limit, session-cookie (property)        | Twilio live proof (manual); OTP-bypass-inert-in-prod probe               |
| Self-stamp           | `app/card/[membershipId]/actions.ts`; RPC `issue_self_service_stamp` (`20260710180000:498-601`)            | One stamp/UK-day, QR proof, velocity              | C    | db `customer-card-stamp`, `customer-stamp-edges`, `architecture-moat` races                       | DST boundary; counter-vs-ledger reconciliation                           |
| Reward unlock/redeem | RPCs in `20260703120000`, `20260704091000`; `lib/customer/reward*.ts`; `lib/merchant/reward-collection.ts` | Two-rail rewards, token redemption, cycle advance | C    | db `reward-scan-single-use`, `reward-redemption-edges`, `issued-rewards-*`, `reward-billing-moat` | mint→admin-cancel→collect race; weekend/holiday `redeemable_from` record |
| Issued rewards       | `20260704090000-096000`; `lib/rewards/*`; `app/app/customers/send-reward/**`                               | Gifts, birthday, invites, caps, expiry            | H    | db issued-rewards suite; e2e send-reward, birthday                                                | London-midnight cap boundary; expiry sweep e2e                           |
| Referrals v2         | `20260708090000`–`20260712100000`; `lib/customer/referral-*`                                               | State machine, holds, drain, fraud                | H    | db referral suite ×8; e2e attribution/bonus                                                       | drain cron route e2e; invite-stamp qualification decision test           |
| Bulk loyalty invites | `20260722100000-100500`; `lib/loyalty-invites/**`; `app/app/customers/invite/**`; `app/invite/**`          | Campaigns, HMAC tokens, claim +2 stamps           | C    | e2e `merchant-invite-customers`; unit token/import/webhook cores; db claim precedence             | drain cron e2e; secret-rotation; stuck-`sent` reconciliation             |
| Billing              | `lib/stripe/**`; `app/api/stripe/webhook/route.ts`; `20260710150000`, `20260713150000-190000`              | Checkout, webhook idempotency, entitlement        | C    | db `billing-state-durability`, `reward-billing-moat`; unit webhook/checkout cores                 | out-of-order event sequences; live acceptance (runbook)                  |
| Merchant auth        | `app/(auth)/**`; `lib/auth/**`; `app/api/auth/hooks/**`                                                    | Password+OTP alias, reset, enumeration hygiene    | H    | e2e signup-verify, auth-recovery, password-policy, hook routes; unit email-otp                    | brute-force lockout behaviour beyond copy (rate-bucket assertion)        |
| Customer session     | `lib/customer/session.ts`; `proxy.ts:86-161`                                                               | Signed cookie + DB registry, device cookie        | C    | unit session-cookie-core (property); db session registration; e2e login                           | multi-device revocation e2e                                              |
| Admin console        | `app/admin/**`; `lib/admin/**`; admin RPCs                                                                 | Audited interventions, GDPR ops                   | C    | e2e admin ×7; db erasure/consent; ACL containment test                                            | per-RPC non-admin behavioural probes; MFA decision (§30-Q1)              |
| GDPR/privacy         | `20260630129000`, `20260711093000`, `20260713120000`, `20260722100300`; cron `privacy-retention`           | Export, erasure, retention purges                 | C    | db `customer-erasure*`, `phone-plaintext-retirement`; e2e privacy-export                          | retention-cron route e2e; 365-day boundary cases; export scope decision  |
| Notifications        | `lib/notifications/**`; `20260622140000`, `20260712090000/091000`; `app/api/cron/notifications`            | Outbox, lease, push, digest                       | H    | db notifications ×5; unit drain-plan/caps/quiet-hours                                             | **cron route handler e2e (none)**; burst backlog load                    |
| Push subscriptions   | `app/api/notifications/push/*`; `public/sw.js:68-338`                                                      | Subscribe/refresh/disable, SW events              | M    | e2e notification-settings; unit payloads                                                          | real-device push (manual); `pushsubscriptionchange` SW test              |
| Announcements        | `app/api/notifications/venue-announcements/route.ts`                                                       | Merchant broadcast, consent filter                | M    | e2e merchant-announcements; unit eligibility                                                      | CSRF probe; daily-cap boundary                                           |
| Analytics            | `app/api/analytics/{funnel,web-vitals}`; `lib/analytics/**`                                                | First-party events, PII allowlists                | M    | contract `analytics-funnel-privacy`, wire tests; e2e privacy                                      | consent posture decision (§30-Q3)                                        |
| Marketing/SEO        | `app/(marketing pages)`; `lib/marketing/facts.ts`; `lib/seo/**`                                            | Claims single-source, JSON-LD, sitemap            | M    | contracts (claims/legal/copy ~30 files); `jsonld:check`; visual+a11y sweeps                       | stray-price grep beyond banned list                                      |
| Legal pages          | `lib/legal/content.ts`; `app/{privacy,terms,...}`                                                          | Versioned terms, snapshots                        | H    | contracts legal-\*; db terms-acceptance                                                           | human legal review (outside QA)                                          |
| Posters/PDF          | `lib/notifications/poster-pdf-*`, `tent-pdf-*`; `app/app/qr/poster/**`                                     | Print assets embedding live QR                    | M    | unit poster/tent-pdf render; e2e poster/tent visual+print; `posters:verify-pdfs`                  | physical print+scan check (manual); per-design A4 renderer units         |
| PWA/offline          | `public/sw.js`; `components/pwa/app-pwa.tsx`; `app/offline`                                                | Network-only auth surfaces, offline shell         | M    | e2e `pwa-offline.desktop`                                                                         | SW update-flow (v3→v4) test; iOS installed-mode manual                   |
| Proxy/middleware     | `proxy.ts`                                                                                                 | Session refresh, CSP nonce, cookies, headers      | H    | contracts security-shape; e2e headers implicitly                                                  | direct unit/integration of matcher exclusions                            |
| Env/config           | `config/env-contract.json`; `scripts/check-env.mjs`; `lib/env/**`                                          | 45-var contract, prod profile                     | H    | unit env-file; CI `env:check:production`                                                          | `.env.example` missing `CUSTOMER_EMAIL_HMAC_SECRET` (fix + parity test)  |
| Health/readiness     | `app/api/{health,readiness}`; `lib/observability/readiness.ts`                                             | Probes, revision, DB check                        | M    | contract `api-health-contract`; db `production-readiness-probe`; prod-smoke workflow              | none significant                                                         |
| Cron auth            | `lib/security/cron-auth.ts`                                                                                | Timing-safe bearer, fail-closed                   | H    | unit cron-auth                                                                                    | route-level 401/200 e2e per cron                                         |
| Rate limiting        | `lib/security/rate-limit*.ts`; RPC `enforce_rate_limit`                                                    | Durable buckets                                   | H    | unit rate-limit-core, qr-rate-limit; db (cold-bucket race fix `20260630126000`)                   | unknown-identity collapse scenario                                       |
| Dev harness          | `app/dev/**`                                                                                               | DB-free UI states                                 | M    | e2e `architecture-harness-gate`, `dev-route-production-guard` contract; prod-404 in runbook smoke | none                                                                     |
| Deployment           | `vercel.json`; `next.config.ts`; workflows                                                                 | Build gate, headers, crons, smoke                 | H    | CI itself; `production-smoke.yml`                                                                 | restore drill; rollback rehearsal (runbook, manual)                      |

---

## 7. Existing test assessment

### 7.1 Inventory (static count; nothing executed)

| Tier       | Runner                                                                                       | Files | ~Cases | Proves                                                                                                                                                                                                                       | CI job                                                  |
| ---------- | -------------------------------------------------------------------------------------------- | ----- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Contracts  | `node --test tests/contracts`                                                                | 98    | ~459   | Source/SQL **shape** (regex/substring/order over files, incl. 13 reading migrations) — not behaviour                                                                                                                         | `fast` (required via build-gate)                        |
| Unit       | `node --test` + ESM alias hook (`tests/support/alias-hook.mjs:49-68`, `server-only` stubbed) | 120   | ~632   | Pure `lib/**` logic; 3 property-based (fast-check): `phone-pii`, `scanner`, `session-cookie-core`                                                                                                                            | `fast` (coverage 80/80/70 over `lib/**`)                |
| Live DB    | `node --test --test-concurrency=1 tests/db`                                                  | 61    | ~320   | Real Postgres invariants: RLS moat, RPC ACL, races, GDPR, referral, billing, notifications. GUC service-role parity + always-rollback wrapper (`tests/db/helpers/db.mjs:58-97`); 4 files use committed connections for races | `db` (**not** in any required gate)                     |
| Playwright | 92 specs + 13 flows + 20 helpers                                                             | —     | ~737   | Rendered journeys, route gates, a11y (axe WCAG2 A/AA), visual baselines (darwin + `-linux` twins)                                                                                                                            | `e2e`/`a11y`/`visual` gates (required), 16-shard matrix |
| Load       | k6 ×2 (`tests/load`)                                                                         | 2     | —      | Public-route throughput; stamp/redeem race (guarded)                                                                                                                                                                         | nightly only                                            |

Config anchors: `playwright.config.ts` (4 projects: `mobile-safari` iPhone 14 for everything non-desktop, chromium/firefox/webkit for `*.desktop.spec.ts` + visual; retries 1 + `failOnFlakyTests` on CI; workers pinned to 1; dev-server webServer on `:3146` with baked env incl. `CUSTOMER_DEV_OTP_CODE=424242`); `scripts/run-playwright.mjs` (distDir isolation `.next-e2e`).

### 7.2 Strengths

- **Live-DB tier is the crown jewel:** rollback-wrapped, UUID-isolated, serialized, skip-guarded (52/61 files skip cleanly without a DB), and it proves the things that matter — forced RLS on every core table (`tests/db/rls-db.test.mjs:14-25`), RPC ACL from `pg_proc` (`rpc-execute-privilege-containment.test.mjs:12-49`), committed-connection race tests (`architecture-moat`), erasure completeness, referral state machine, billing fail-closed.
- **Deterministic UI testing** via the prod-gated dev harness (`tests/e2e/helpers/harness.ts:14-63` hydration gating) removes DB flake from the browser tier.
- **Flake hygiene is good:** zero `networkidle`, zero raw sleeps, 5 `waitForTimeout` total, `forbidOnly`, explicit hydration signals.
- **Governance depth:** append-only migration check, env-contract entropy checks, flags lifecycle with expiry, claims/tokens/jsonld gates, OpenAPI docs drift check, AGENTS.md freshness.

### 7.3 Weaknesses and risks

| Finding                                                           | Evidence                                                                                                                                                                | Consequence                                                                                                                                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contracts are shape, not behaviour, and dominate the "test" count | e.g. `tests/contracts/security-hardening.test.mjs:12-43` regexes over migrations                                                                                        | Green `pnpm test` ≠ working product; brittle to benign refactors; blind to logic bugs. The coverage matrix itself labels rows "partial (grep only)" (`docs/architecture-flows/customer-coverage-matrix.md`) |
| DB job outside required gates                                     | `ci.yml` gate jobs list; `db` has no rollup                                                                                                                             | Behavioural moat can go red without blocking merge (**verify branch protection**, §30-U2)                                                                                                                   |
| Live-DB Playwright specs never run in CI                          | `SUPABASE_DB_URL` only in `db` job (`ci.yml:352`); specs `test.skip(!sql,…)`                                                                                            | 5 specs (`customer-join-*-live-db`, `public-qr-router-live-db`) are dead weight in CI                                                                                                                       |
| Cron route handlers untested                                      | grep: no test references `app/api/cron/{notifications,referral-bonus-drain}/route.ts`                                                                                   | Auth wiring + budget behaviour of two 15-min production crons unproven end-to-end                                                                                                                           |
| e2e runs against `next dev --webpack`                             | `playwright.config.ts:25-35`; workers pinned to 1 because parallel dev-server 500s (`ci.yml:146-151`)                                                                   | Latent flake source; prod-build behaviour (minification, caching) untested in browser tier                                                                                                                  |
| Mutation testing is report-only                                   | `stryker.conf.json`: 8 files, `break: 0`                                                                                                                                | No enforcement; unit-test strength unmeasured for most of `lib/**`                                                                                                                                          |
| Untested security-sensitive lib modules                           | no direct test imports for `lib/admin/auth.ts`, `lib/supabase/{server,update-session}.ts`, `lib/auth/session.ts`, `lib/observability/*`, per-design poster A4 renderers | Gate logic only shape-checked                                                                                                                                                                               |
| Fixture/factory gap                                               | only 2 static fixtures (`tests/fixtures/*.csv`); live-DB state built ad hoc per helper                                                                                  | Drift between helpers; harder to add new DB tests                                                                                                                                                           |
| Own-connection DB files run outside rollback                      | `architecture-moat`, `billing-state-durability`, `production-readiness-probe`, `rls-db`                                                                                 | Crash mid-race can leave committed rows on shared/local DBs                                                                                                                                                 |
| `pnpm audit` as a required PR step                                | `ci.yml:67` (`--ignore-registry-errors`); `pnpm.overrides` pin history (`package.json:79-93`)                                                                           | Time-fragile gate: new upstream advisories redden PRs with no code change                                                                                                                                   |
| Manual traceability                                               | `customer-coverage-matrix.md` hand-maintained (dated 2026-06-30)                                                                                                        | Matrix can rot vs the actual suite; no automated check                                                                                                                                                      |

### 7.4 Tests to rewrite / retire

- **Retire or CI-wire the 5 live-DB Playwright specs** (currently unreachable in CI) — decide per §29.
- **Demote pure-copy contracts** that duplicate `claims:check` (several `customer-*-p2/p3-polish` files assert copy that the banned-claims script also guards) — consolidate to one owner per string.
- **Convert the highest-value shape contracts to behavioural probes** where a live-DB equivalent exists (e.g. `deepsec-consistency-closure` migration-wording asserts → catalogue asserts in `tests/db`).
- No test was found that asserts something false; none require deletion for correctness reasons.

---

## 8. Risk assessment

Ranked by (impact × likelihood), with the mitigation the plan assigns. Severity per §27.

| #    | Risk                                                                                                                                                                                                                                                                                         | Sev                  | Evidence                                                                     | Mitigation in this plan                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| R-01 | **Merge-gate hole:** ledger/RLS regression merges because `db` job isn't required                                                                                                                                                                                                            | Critical             | `ci.yml` (no db gate job)                                                    | §24: add `DB behavioral moat` rollup gate; verify branch protection                    |
| R-02 | **Provider acceptance unproven** (Stripe live, Twilio, Resend inbox, push devices, cron execution, migration parity)                                                                                                                                                                         | Critical (launch)    | dossier §17-18; runbook gates                                                | §28 checklist items 12–16; `pnpm smoke:providers`, runbook Stripe gate                 |
| R-03 | **Recovery unproven:** PITR disabled, no restore drill                                                                                                                                                                                                                                       | Critical (launch)    | `docs/operations/production-runbook.md:98-103`                               | §28 item 18; §29-I7 restore drill on disposable project                                |
| R-04 | **RPC catalogue drift:** `create or replace` across 122 migrations; overload sprawl (`issue_self_service_stamp` ×4 signatures); repair migration precedent (`20260713090000`)                                                                                                                | High                 | migration set; two-rail scare in §1                                          | §12: add live catalogue-parity test (functions, signatures, grants vs intent manifest) |
| R-05 | **No CAPTCHA + IP identity trusts one header** → OTP/SMS pumping, signup abuse if rate identity collapses to `"unknown"`                                                                                                                                                                     | High                 | `lib/security/rate-limit-core.ts:21-26`; agent grep                          | §15 SEC cases; §30-Q5 owner decision on bot defence                                    |
| R-06 | **Admin MFA removed**; destructive powers behind password-only session                                                                                                                                                                                                                       | High                 | `20260720100000`; `lib/admin/auth.ts:44-52`                                  | §30-Q1 owner decision; §21 ADM tests meanwhile                                         |
| R-07 | **CSRF exposure on cookie-authed JSON POSTs** relying solely on SameSite=lax (push routes, venue-announcements, readback)                                                                                                                                                                    | Medium-High          | routes lack origin checks vs `bounded-json-request.ts` beacons               | §15 CSRF probes; recommend origin check parity (report-only)                           |
| R-08 | **Cron subsystem silently stops** if `CRON_SECRET` unset/rotated (all 6 crons 401 fail-closed)                                                                                                                                                                                               | High                 | `lib/security/cron-auth.ts:13`                                               | §20 alerting case OBS-04: cron-staleness monitor; readback of last-run evidence        |
| R-09 | **Bulk-invite token blast radius:** claim/unsubscribe links derive from `CUSTOMER_SESSION_SECRET` (v1, no rotation window)                                                                                                                                                                   | Medium-High          | `lib/loyalty-invites/tokens.ts`                                              | §21 INV-07; ops note in §25 secret-rotation runbook                                    |
| R-10 | **Availability predicate triplicated** (DB triggers, RPC reason fn, TS launch/UI) incl. `trial/trialing` and `past_due` divergence                                                                                                                                                           | Medium-High          | `lib/merchant/launch-readiness-core.ts:200-213` vs RPC bodies                | §12 parity test matrix (status × surface); §30-Q2                                      |
| R-11 | Recycled-phone account takeover (accepted, review due 21 Oct 2026)                                                                                                                                                                                                                           | Medium (accepted)    | `docs/operations/security-risk-register.md`                                  | §28: confirm acceptance still stands at launch                                         |
| R-12 | e2e tier depends on dev server; prod-build browser behaviour unproven                                                                                                                                                                                                                        | Medium               | `playwright.config.ts`; `ci.yml:146-151`                                     | §23: nightly e2e-against-`next start` lane                                             |
| R-13 | Telemetry (web-vitals/funnel) not consent-gated; no cookie banner                                                                                                                                                                                                                            | Medium (legal)       | `app/api/analytics/*` (origin+rate-limit only)                               | §30-Q3 owner/legal decision; §16/§20 verify no PII regardless                          |
| R-14 | `CUSTOMER_EMAIL_HMAC_SECRET` is in `config/env-contract.json` but omitted from `.env.example` (used by `lib/customer/email-pii-core.ts`); if it's a call-time-optional var, a fresh `.env.local` copied from the template silently lacks it and email matching/suppression breaks at runtime | Medium               | env-contract vs `.env.example`; `lib/customer/email-pii-core.ts`             | §29 fix (add to `.env.example`) + template-vs-contract parity test                     |
| R-15 | Notification/invite drains: burst backlog (500/tick budget), stuck-`sent` when provider omits id                                                                                                                                                                                             | Medium               | `lib/loyalty-invites/delivery-worker.ts`; worker budgets                     | §18 load case PERF-06; §21 INV-06                                                      |
| R-16 | Global suppression on bounce (merchant_id NULL) suppresses an address across all venues                                                                                                                                                                                                      | Low-Medium (product) | `20260722100000` suppressions                                                | §30-Q8 owner confirmation                                                              |
| R-17 | Visual baseline twin maintenance (darwin + `-linux`) blocks unrelated PRs when stale                                                                                                                                                                                                         | Low (process)        | snapshot template `playwright.config.ts:43-107`; memory of past force-merges | §24 bless-runbook; keep twins refreshed per `reports/` runbooks                        |

---

## 9. Complete QA strategy

### 9.1 Model: five proof layers, each with a distinct job

The repository already encodes the right model (`docs/product/nabaperks-comprehensive-product-dossier.md` §17); this plan keeps it and closes its gaps:

1. **Static gates** (lint, typecheck, contracts, governance scripts) — repo shape and copy. Never treated as behaviour.
2. **Unit** (node:test + fast-check) — pure domain logic in `lib/**`: dates/calendars, PII cores, rate-limit math, payload builders, readiness derivations.
3. **Live DB** (node:test over real Postgres) — the _trust mechanics_: RLS, RPC ACL, ownership, races, idempotency, ledgers, GDPR. This is where tenant isolation, duplicate-redemption, and billing fail-closed are proven — not in the browser.
4. **Browser** (Playwright) — journeys, gates, a11y, visual, over the DB-free harness by default; a small live-DB browser lane for join/QR truth (to be CI-wired).
5. **Provider/production** — `smoke:providers`, `smoke:supabase:migrations`, runbook acceptance gates, 15-minute production probes, and the manual device/print matrix.

**Placement rule:** every business rule is tested at the _lowest layer that can prove it_, plus exactly one journey-level test that exercises it end-to-end. Duplicating DB invariants in the browser tier is explicitly avoided (slow, flaky, and weaker).

### 9.2 Manual vs automated

Automate: everything in layers 1–4; provider smokes are scripted but run on demand. **Manual (cannot be automated from this repo):** camera scanning on real iOS/Android (html5-qrcode), printed-poster QR scans (all 8 poster + 5 tent designs at print size), real Twilio SMS receipt incl. expired/throttled codes, Resend inbox rendering across clients (Gmail/Outlook/Apple Mail, mobile), Web Push permission lifecycle on iOS Safari (installed PWA) / Android Chrome / desktop, Stripe live-mode acceptance per the runbook script, restore drill, rollback rehearsal, and exploratory testing of the admin console with a support mindset.

### 9.3 Area coverage map (Phase-4 areas → sections)

Functional →§10; API →§11; Database/data integrity + business rules →§12; AuthN →§13; AuthZ/roles + multi-tenancy →§14; Security →§15; Accessibility →§16; UI/responsive/browser/device →§17; Performance →§18; Integrations →§19; Email/analytics/observability + privacy →§20. Deployment/infrastructure controls are folded into §24 (gates), §25 (environments), §28 (release checklist) — the runbook (`docs/operations/production-runbook.md`) is the operational source and this plan cross-references rather than duplicates it.

### 9.4 Entry/exit criteria per release

- **Entry to release QA:** all required CI gates green on the release SHA; `db` job green; no open Critical/High defects on core journeys (J3–J7, J10, J12, J13).
- **Exit (launch gate):** §28 checklist complete, including provider acceptance evidence, restore-drill record, and the four product-owner decisions in §30 resolved in writing.

---

## 10. Functional test plan

Organised by the Phase-4-A checklist, mapped to this codebase. "L" = recommended layer (U=unit, DB=live-DB, E=e2e, M=manual).

### 10.1 Happy paths, validation, required fields

- Every form in the forms inventory (§ frontend, 25+ forms) has server-action validation; client mirrors it. Test: required-field omission returns field-scoped errors with `aria-invalid` (E — harness has empty/error fixtures at `app/dev/app-harness/states`); server rejects even when client bypassed (DB/action — e.g. `joinRewardsAction` requires accepted terms `app/m/[merchantSlug]/join/actions.ts:424-429`).
- Boundary values: stamps_required 1–99 (`loyalty_cards` CHECK), reward_terms 12–500 chars, weight 1–1000, invite batch ≤2000, direct-gift expiry 1–365 (U for pure validators; DB for CHECK rejection).

### 10.2 Duplicate submissions, repeated clicks, refresh mid-submit

- All server-action forms use `useFormStatus` pending disabling (`components/forms/submit-button.tsx`) — test double-click is a no-op (E). At the DB layer, idempotency backs the important ones: onboarding (advisory lock + unique owner), checkout (attempt ledger), webhook (event PK), notification enqueue (dedupe_key), invite claim (`FOR UPDATE`). Test: fire two concurrent submits, assert one effect (DB).
- **Refresh during OTP/checkout:** pending cookies (10-min) survive refresh; Stripe return is verified server-side, not from query string (DB/E).

### 10.3 Back/forward, session expiry

- Browser Back into an authed route after logout must re-gate (E: `app/home/(authed)/layout.tsx:24-34` redirects). Customer session revoked server-side must beat a stale cookie (DB: `getCustomerSession` checks the row; add multi-device E).
- Merchant session refresh at the edge (`proxy.ts:74`) — test token rotation doesn't log a user out mid-session (E, harness can't; needs live-auth E or manual).

### 10.4 Empty / loading / error states

- Harness seeds these deterministically: `states`, `skeletons`, `?state=` variants on launch/invite, `?mode=` on home stamp (`app/dev/home-harness/stamp/page.tsx:5-14`). Cover each with a visual+a11y assertion (E — already partly in `visual.spec.ts`).
- Error boundaries: root/segment `error.tsx` and `global-error.tsx` — force a thrown error and assert branded recovery (E; `stream-error-boundary` for dashboard streams).

### 10.5 Data persistence, updates, deletion/deactivation

- Card/reward edits persist and snapshot onto issued rewards (DB: `reward_events` name/terms snapshot). Deactivating a reward pool item below 3 must be blocked while QR active (DB trigger `20260710110000`). QR pause vs delete (DB: pause keeps memberships).

### 10.6 Concurrency, idempotency, transaction consistency

- The high-value set (DB, committed-connection style like `architecture-moat`): concurrent stamp on same day → exactly one `stamp_events` row; concurrent redeem → one `redeemed`; concurrent invite claim of one forwarded link → one join; two checkout attempts → one subscription binding; reordered webhook events → no status regression (`applied|stale`).
- **Counter/ledger reconciliation (new):** after any stamp/redeem sequence assert `current_stamp_count`, `total_stamps_earned`, `total_rewards_redeemed`, `active_cycle_number` equal the ledger aggregates (DB) — closes R-04's desync class (repair migrations `20260630127000`, `20260713100000` exist because this has broken before).

### 10.7 Dates, time zones, locale, currency

- Europe/London business date is the spine: one-stamp-per-day, `redeemable_from = next_uk_business_date` (Sat/Sun skipped; **bank holidays not skipped** — confirm §30-Q6), birthday-month expiry, daily caps. Test around 23:00–01:00 BST and GMT and across a DST transition (U on `uk-date`/`uk-calendar` — property tests exist; add explicit DST fixtures; DB for `redeemable_from`).
- Currency is GBP-only, formatted from `lib/marketing/facts.ts`; assert £49/£490 render and no stray hardcoded prices (contract + grep, R-13 note).

### 10.8 File uploads, pagination, search, filtering, sorting

- **No user file uploads exist** (posters are server-generated PDFs; no upload form found) — do not write upload tests; note as N/A.
- Pagination: `/app/customers?page=`, `/app/activity?filter=&q=&limit=` (E: harness populated fixtures; assert masked search only, no raw email — DB masking + contract). Admin lookups (`/admin/customers?...`) — assert tenant/όwnership scoping and masked DTOs.

---

## 11. API test plan

23 `app/api/**` route handlers + 5 non-api handlers. For each important endpoint: positive, authn-fail, authz-fail, validation-fail, and (where stateful) idempotency/concurrency. Table gives method, auth, and the negative cases that must exist.

| Endpoint                                                                              | Method   | Auth                        | Positive                   | Must-have negatives                                                                                           |
| ------------------------------------------------------------------------------------- | -------- | --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `/api/stripe/webhook`                                                                 | POST     | Stripe sig                  | valid event → applied, 200 | missing sig→400; bad sig→400; duplicate→`{duplicate}`; busy→503+Retry-After; >1 MiB→413; reordered→no regress |
| `/api/resend/webhook`                                                                 | POST     | Svix HMAC                   | delivered/bounce mapped    | secret unset→503; bad sig→401; replay >5 min→reject; missing `email_id`→no crash                              |
| `/api/auth/hooks/send-email`                                                          | POST     | hook secret                 | OTP delivered via Resend   | secret unset→500; bad envelope→verify fail                                                                    |
| `/api/auth/hooks/send-sms`                                                            | POST     | hook secret                 | (legacy)                   | secret unset→500 (subsystem disabled in config)                                                               |
| `/api/cron/notifications`                                                             | GET      | `CRON_SECRET`               | drains ≤500, 200           | no/blank secret→401; wrong secret→401; **(no test today — add)**                                              |
| `/api/cron/referral-bonus-drain`                                                      | GET      | `CRON_SECRET`               | drains due bonuses         | 401 unauth; **(no test today — add)**                                                                         |
| `/api/cron/{birthday-rewards,loyalty-invite-drain,merchant-digest,privacy-retention}` | GET      | `CRON_SECRET`               | idempotent run             | 401 unauth; idempotent re-run no double effect                                                                |
| `/api/readiness`                                                                      | GET      | `PRODUCTION_MONITOR_SECRET` | 200 ready + revision       | 401 unauth; 503 when DB down; must NOT accept `CRON_SECRET` (distinctness)                                    |
| `/api/health`                                                                         | GET      | none                        | 200 liveness               | no secret leakage in body                                                                                     |
| `/api/notifications/push/subscribe`                                                   | POST     | customer session            | 200 stores sub             | 401 no session; invalid sub→validation; rate 12/min; **CSRF: cross-origin cookie replay**                     |
| `/api/notifications/push/{unsubscribe,disable,refresh,preferences,prompt-viewed}`     | POST/GET | customer session            | 200                        | 401; rate limits; scope from session not body (`disable-subscription-handler.ts:15-17`)                       |
| `/api/notifications/push/public-key`                                                  | GET      | none                        | VAPID public key           | none (public by design)                                                                                       |
| `/api/notifications/venue-announcements`                                              | POST     | merchant session            | 200 recipient counts       | 401; status∉{active,trial}→403; billing-not-ready→403; empty text→validation; daily cap; **CSRF**             |
| `/api/notifications/readback`                                                         | GET      | customer session            | 200 history                | 401; **unclamped `limit`** (min/max) — R-14-adjacent; no rate limit (add)                                     |
| `/api/analytics/funnel`                                                               | POST     | none (anon)                 | 200 beacon                 | non-same-origin→reject; non-JSON→reject; >max body→reject; rate 30/min                                        |
| `/api/analytics/web-vitals`                                                           | POST     | none (anon)                 | 200 beacon                 | same-origin; >2 KB→reject; rate 120/min; no PII persisted                                                     |
| `/app/qr/image/[qrCodeId]`                                                            | GET      | merchant cookie             | owner QR PNG               | non-owner→404; dev bypass only when `NODE_ENV!=production`                                                    |
| `/reward/[rewardId]/qr.png`                                                           | GET      | customer session            | private no-store QR        | non-owner→404/blocked; profile-incomplete→blocked; `Cache-Control: private,no-store`                          |
| `/reward/[rewardId]/status`                                                           | GET      | customer session            | status JSON                | not-found≡unauthorized→404 (anti-probe); no cross-customer leak                                               |
| `/auth/confirm`                                                                       | GET      | Supabase code               | session + safe redirect    | open-redirect `next` sanitised to same-origin (`app/auth/confirm/route.ts:10-29`)                             |
| `/home/session/reset`                                                                 | GET      | —                           | revoke + redirect          | `next` sanitised                                                                                              |
| `/r/[token]`                                                                          | page     | UUID guard                  | redirect to merchant scan  | malformed token→notFound                                                                                      |

Cross-cutting API cases (apply to all mutation routes): unexpected extra fields ignored/rejected, missing content-type, oversized payload bounded, injection strings in text fields stored inert (parametrised RPCs), and uniform error envelope `{error}` with `no-store` (`lib/http/no-store-json.ts:13`). Contract tests already assert route shapes (`tests/contracts/*route-contract*`); the negatives above are the behavioural additions.

---

## 12. Database and data-integrity plan

The live-DB tier is the right home for almost all of this; it already exists and skips cleanly without a database. Additions are marked **[new]**.

### 12.1 Constraints and invariants to assert (DB)

- **Forced RLS on every tenant table** — already `tests/db/rls-db.test.mjs:14-25`; extend the asserted list to the full 37 tables (§ database inventory) **[new]**.
- **Uniqueness:** one active card/location, one primary location, one active join QR/location, one membership per (merchant,customer), one earned stamp per (membership,location,UK-day), one birthday reward per (merchant,customer,year), invite lifetime-once per (merchant,email_hmac), referral (venue,referred_customer), `stripe_event_id` PK, invite `claim_token_hash`, phone_hmac. Assert each rejects the duplicate (DB — mostly covered; audit for completeness).
- **FK/cascade behaviour:** `stamp_events`/`reward_events` FK to card = `ON DELETE restrict` (ledger protected); membership FKs cascade; referral membership FKs `SET NULL` (survive churn). Test deletes behave as declared (DB).
- **Append-only ledgers:** `notification_deliveries` UPDATE/DELETE blocked by trigger; verified-contact immutability trigger except under `app.customer_erasure` GUC (DB — covered by `customer-profile`; extend).

### 12.2 Race conditions (committed-connection DB tests, `architecture-moat` style)

Double stamp; duplicate redeem; concurrent invite claim; two checkout attempts; reordered/duplicate webhook; concurrent referral settle + visit stamp in one txn; concurrent billing flip vs stamp (advisory lock `billing-state:` — `20260713190000`). Each asserts the DB-declared winner and no ledger/counter corruption.

### 12.3 Catalogue-parity test **[new, high value — mitigates R-04]**

A live-DB test that enumerates `pg_proc` for the loyalty-critical functions and asserts, against a checked-in manifest: (a) exactly one definition per intended signature (no stale overload of `issue_self_service_stamp`, `join_customer_membership_with_first_stamp`, `award_referrer_bonus_stamp`, `redeem_self_service_reward`, `collect_reward_scan_token`); (b) EXECUTE grants match the allowlist (extends `rpc-execute-privilege-containment.test.mjs`); (c) each `authenticated`-callable RPC's granted signature matches the app `.rpc()` call site's arg shape. This turns "migration drift" from a latent hazard into a red test.

### 12.4 Availability-predicate parity **[new — mitigates R-10]**

A table-driven test over {status ∈ trialing/active/past*due/cancelled/suspended/unknown} × {requires_billing true/false} asserting the \_same* verdict from: the entitlement trigger (`loyalty_billing_entitled`), the RPC reason fn (`loyalty_availability_reason`), and the TS predicate (`launch-readiness-core`/`loyaltyAvailability`). Records the intended `past_due` behaviour (currently: stamps/redeems allowed, launch-not-ready) pending §30-Q2.

### 12.5 Two-rail redemption (confirmed correct; keep as regression)

`redeem`/`collect` must decrement stamps + advance cycle **only** for `source='stamp_cycle'` (`20260704091000:378-395,590-591`). Existing `issued-rewards-*` cover it; pin it as a named invariant so a future edit can't silently reintroduce the drain.

### 12.6 GDPR data integrity

Export bundle completeness and no-PII-in-ledger-metadata; erasure nulls PII + surrogates email + retains ledger + revokes sessions/push + scrubs invites (DB — `customer-erasure*` exist; add metadata-PII scan and 365-day retention boundary **[new]**).

### 12.7 Migration safety (CI + DB)

`check-supabase-migrations.mjs` enforces no duplicate versions + append-only + linked drift; keep it required. Add a disposable-DB "apply from empty → seed → test:db" smoke as the migration-parity proof for release (the `db` CI job already does apply+seed on ephemeral Supabase — promote its green to a release gate, §24).

---

## 13. Authentication and authorisation plan

Two identity systems ⇒ two authn suites.

### 13.1 Merchant/admin (Supabase)

- Registration (unconfirmed → OTP-confirmed), login (generic error on bad creds `:231`), email-not-confirmed branch, password reset (request→OTP→set, failed-recovery cleanup `:308-379`), logout, session refresh at edge, protected-route redirect (`/app/*`, `/admin/*`).
- Rate limits: signup 3/15 min, signin 5/15 min, verify 5/15 min + resend cooldown (assert the bucket, not just copy — R-05). Account enumeration: signup/signin/reset copy is uniform (contract + E).
- Admin: session + `internal_admins` active row required; **MFA currently not required** (record decision §30-Q1). Direct admin\_\* RPC call by a plain authenticated non-admin must raise `insufficient_privilege` (DB — extend beyond ACL test).

### 13.2 Customer (Twilio + custom session)

- Phone OTP send/verify (Twilio Verify), unavailable→fail-closed, wrong/expired code, anti-enumeration (existence checked only after OTP proof), pending-phone cookie 10-min TTL.
- Session: signed cookie **and** DB session row both required; revocation beats cookie; 30-day expiry; device cookie feeds rate identity. Multi-device: revoke on device A invalidates A while B persists (**[new] E**).
- **OTP bypass safety:** `CUSTOMER_OTP_BYPASS_MODE`/`CUSTOMER_DEV_OTP_CODE` gated by `isLocalDevelopment()` — assert inert when `VERCEL_ENV=production` (U + env-contract check `check-env.mjs:260-268`; add a production-profile probe).

### 13.3 Authorisation / roles

Build the §4.2 matrix into tests: for each capability, one positive (allowed role) and one negative (each disallowed role) at the enforcement layer named. Priority negatives (Critical): customer minting another customer's reward token; merchant editing another merchant's card; non-admin calling admin\_\* RPC; anon calling any privileged RPC (globally revoked — assert `permission denied`); customer self-redeeming without merchant scan (grant exists on `redeem_self_service_reward` — confirm UI never exposes and/or intended, §30-Q9).

---

## 14. Multi-tenant isolation plan

Every isolation failure = Critical. The moat is RLS (`owned_merchant_ids()`/`owned_customer_ids()` hashed policies, `20260710090000`) + ownership-checked RPCs. Tests (DB tier, mostly present in `tenant-rls`, `architecture-moat`, `rls-hashed-policies`):

- Merchant A cannot **read** B's merchants/locations/cards/qr/memberships/stamps/rewards/members/activity/billing (RLS SELECT).
- Merchant A cannot **write** B's rows (RPC `p_merchant_id` ownership raises; direct table write blocked by RLS/insert-policy).
- Merchant A cannot reach B via modified URL/ID (`/app/customers?highlight=<B's id>`, `/app/qr/image/<B's qrCodeId>` → 404) or via API/RPC param (pass B's ids to an owned RPC → `insufficient_privilege`).
- **Background jobs preserve isolation:** crons operate service-role but scope by merchant/customer id in RPC bodies — assert digest/notification/referral drains never cross tenants (DB).
- **Reports/search/exports preserve isolation:** merchant readback masks and scopes; admin export returns a customer's cross-merchant data by design — **confirm admin scope** (§30-Q7). Search indexes masked labels only.
- **Caches preserve isolation:** authed surfaces are `force-dynamic`/network-only (SW `NETWORK_ONLY_PREFIXES`); no shared cache key carries tenant data — assert no `Cache-Control: public` on authed responses (E/contract).
- **Analytics preserve isolation:** `product_events` carry merchant/customer ids; pseudonymised PostHog rejects raw ids (unit `analytics-privacy`).
- **File storage:** no Supabase Storage buckets; poster PDFs generated per-request from owned QR context — assert non-owner cannot fetch a poster/QR image (E, covered by qr-image-route).

---

## 15. Security test plan

Reference: OWASP Top 10 / WSTG. Defensive verification only. Existing infra: CodeQL (`security-extended`), ZAP baseline (PR) + full (nightly), dependency-review (fail-on-high, deny copyleft), `pnpm audit` gate, forced RLS, RPC ACL, timing-safe secrets, security headers + dynamic CSP with nonce.

| OWASP area                   | Codebase-specific test                                                                                                                                                                                                          | Layer        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Broken access control / IDOR | §14 matrix; membershipId/rewardId/qrCodeId manipulation → 404; status endpoint 404-collapse                                                                                                                                     | DB+E         |
| Auth bypass                  | OTP bypass inert in prod; session revocation authoritative; cookie-alone insufficient                                                                                                                                           | DB+U         |
| Cross-tenant                 | §14 (Critical)                                                                                                                                                                                                                  | DB           |
| SQL injection                | all writes via parametrised RPCs / supabase-js; inject strings in name/terms/search stored inert                                                                                                                                | DB+E         |
| XSS                          | React escaping; dynamic CSP nonce + `strict-dynamic` (`lib/security/csp.ts:55-66`); assert no `dangerouslySetInnerHTML` with user data (grep/contract); static marketing CSP weaker (`unsafe-inline`) — verify no session there | E+contract   |
| CSRF                         | server actions get Next origin check; **cookie-authed fetch POSTs (push, announcements, readback) lack explicit origin check** — probe cross-origin cookie replay; recommend `isSameOriginRequest` parity (R-07)                | E            |
| SSRF                         | Google Places/Nominatim are the only outbound-from-user-input; assert server controls the URL, not client                                                                                                                       | U/inspection |
| Open redirect                | `safeMerchantNextPath`/`next` sanitisation on `/auth/confirm`, `/home/session/reset` (`app/auth/confirm/route.ts:10-29`)                                                                                                        | U+E          |
| Secret exposure              | env-contract forbids server secrets with `NEXT_PUBLIC_`; CI fixtures must never reach real env (R-2 note); source-map upload gated                                                                                              | contract+CI  |
| Weak cookies                 | HttpOnly + SameSite=lax + signed on customer/join/device cookies; assert flags (E/inspection); confirm Supabase auth cookie SameSite (R-07)                                                                                     |
| CORS                         | no permissive CORS found; APIs same-origin                                                                                                                                                                                      | inspection   |
| Rate limiting / brute force  | assert buckets fire (auth, OTP multi-key, push, announcements, invite, poster, geocode); unknown-identity collapse scenario (R-05)                                                                                              | DB+E         |
| Enumeration                  | uniform copy across signup/signin/reset/customer-login/send-reward; status 404-collapse                                                                                                                                         | contract+E   |
| Webhook security             | signature required + replay window + idempotency (Stripe/Svix); §11 negatives                                                                                                                                                   | U+E          |
| Sensitive data in logs       | structured logger + `sanitizeMetadata` blocklist; Sentry `sendDefaultPii:false` + URL scrub — assert no phone/email/token in a captured error (U on sanitisers)                                                                 |
| Dependency/debug/source-map  | dependency-review + audit; `/dev/*` 404 in prod (runbook smoke); source maps deleted after upload                                                                                                                               | CI+E         |

Manual/periodic: run the nightly ZAP full scan before launch and triage; review CodeQL alerts; confirm HSTS preload and headers on the live origin (curl in runbook).

---

## 16. Accessibility test plan

Target WCAG 2.2 AA. Existing: `@axe-core/playwright` sweeps (`a11y.spec.ts` + `.desktop`) over marketing + `/dev/app-harness`, Lighthouse a11y ≥0.95 gate, design-token contrast rules, 44px touch-target design contract, `reducedMotion: reduce` in Playwright, min-text-size gate (`check-design-tokens.mjs` 10px floor).

Automated additions:

- Extend the axe sweep to **customer journey states** the harness can seed (join wizard steps, stamp states `?mode=`, reward states, home tabs) — currently marketing + app-harness heavy; add customer-harness routes.
- Assert form error announcement (`role="alert"`, `aria-invalid`, `aria-atomic` status) on each form's invalid state (E — password policy already contract-checked).

Manual (screen-reader + keyboard, cannot automate fully):

- Keyboard-only traversal of join → stamp → redeem and merchant launch; visible focus (Wet Ink focus treatment); focus order and modal focus-trapping in Radix `Sheet`/dialog (present-QR, legal-sheet); skip links; heading hierarchy (legal pages contract-checked); screen-reader names for icon-only controls (scanner, tab bar); colour-independent meaning for stamp/reward status (not colour-only); 200% zoom reflow to 410px customer column and 1152px merchant; reduced-motion honoured by the server-led stamp animation; table accessibility on members/activity/audit.

---

## 17. UI, responsive, browser, and device plan

### 17.1 Responsive

Customer column ≈410px thumb zone; merchant/marketing to ≈1152px (dossier §15.3). Representative viewports to test: **360×640** (small Android), **390×844** (iPhone 14 — Playwright `mobile-safari` default), **768×1024** (tablet), **1280×800** (desktop), **1440×900** (wide merchant). Assert no horizontal overflow (body never scrolls x), text truncation, long venue/reward names, large counts, empty vs populated (harness fixtures), landscape, mobile keyboard not covering inputs, tab bar safe-area inset, install prompt above tab bar.

### 17.2 Visual regression

Existing `@visual` baselines (marketing, harness dashboard/onboarding/qr/launch-billing, posters ×7, tents ×5, billing receipts) with darwin + `-linux` twins. Keep single-worker; maintain both twins via the bless runbook (`reports/` runbooks; R-17). Add customer-journey visual states as harness fixtures grow.

### 17.3 Browser/device matrix

Audience = UK hospitality customers on personal mobiles + merchants on phone/tablet/laptop. CI runs chromium, desktop-firefox, desktop-safari (webkit), mobile-safari. Recommended manual matrix before launch:

| Browser/device                | Why                                                                 | Priority |
| ----------------------------- | ------------------------------------------------------------------- | -------- |
| iOS Safari (iPhone, latest−1) | primary customer device; camera scan, PWA install, Web Push nuances | P0       |
| Android Chrome (mid-range)    | primary customer device; camera, push                               | P0       |
| Desktop Chrome                | merchant console                                                    | P0       |
| Desktop Safari                | merchant on Mac; webkit quirks                                      | P1       |
| Desktop Firefox               | coverage; known linux Firefox scrollHeight +3 (memory)              | P1       |
| iPad Safari/Chrome            | merchant scanner on tablet                                          | P1       |
| Edge                          | coverage                                                            | P2       |

Compatibility risks in code: `html5-qrcode` camera API (permissions, iOS constraints, `BarcodeDetector` absent on some platforms — repo decodes proofs via jsqr in Node), Web Push (no iOS push unless installed PWA), `navigator.sendBeacon` fallback, service-worker update timing, `motion` animations under reduced-motion.

---

## 18. Performance test plan

Existing budgets: Lighthouse (mobile, 4 URLs: `/`,`/pricing`,`/loyalty-for-pubs`,`/signup`; a11y≥0.95, perf≥0.70, FCP≤2500ms, LCP≤4000ms, TBT≤300ms — all error-level gates), bundle budget (root first-load ≤950 KB, per-route ≤900 KB, chunk ≤450 KB), k6 nightly (public routes; stamp/redeem race).

| #       | Target                           | Test                                                                                           | Tool                                             | Budget                                     |
| ------- | -------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| PERF-01 | Marketing LCP/CLS/INP            | Lighthouse gate                                                                                | LHCI                                             | existing                                   |
| PERF-02 | Bundle first-load                | `bundle:check`                                                                                 | script                                           | existing                                   |
| PERF-03 | Members page at scale            | RLS query cost at 100k rows (hashed policies fixed 936 ms→materialised once, `20260710090000`) | `EXPLAIN ANALYZE` in DB suite + `db:seed:stress` | no N+1; buffer hits bounded                |
| PERF-04 | Dashboard streams                | streamed Suspense TTFB                                                                         | manual/Lighthouse on authed (needs live auth)    | LCP≤4 s                                    |
| PERF-05 | Stamp/redeem under contention    | k6 race script                                                                                 | k6 nightly                                       | no duplicate; p95 latency recorded         |
| PERF-06 | Notification/invite drain burst  | enqueue > budget (500/tick) then measure backlog drain time                                    | k6 + DB                                          | backlog clears within N cron cycles (R-15) |
| PERF-07 | QR image + reward status polling | response time, no-store correctness                                                            | k6/E                                             | fast; private no-store                     |
| PERF-08 | Slow-network / low-end mobile    | throttled Lighthouse + manual on mid-range Android                                             | LHCI/manual                                      | usable                                     |

Add authed-route Lighthouse (dashboard, card, reward) via a live-auth lane or manual, since current LHCI only covers anonymous routes.

---

## 19. Integration test plan

For each external integration: success, failure, timeout, invalid credentials, rate-limit, duplicate callback, delayed response, partial failure, signature failure, retry, outage, reconciliation. Existing resilience: per-service circuit breaker + backoff (`lib/observability/resilience.ts`, breakers `resend`/`twilio`), fail-closed secret gates, idempotency ledgers.

| Integration                 | Success                       | Failure/edge to test                                                                                                      | Existing                                                     | Layer         |
| --------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------- |
| **Stripe**                  | checkout→webhook→entitlement  | bad sig, duplicate, reorder, >1 MiB, portal return, subscription lapse fail-closed, live-mode acceptance                  | db billing-state-durability, unit webhook; runbook live gate | DB+U+M        |
| **Twilio Verify**           | OTP send/check                | unavailable→fail-closed, wrong/expired code, throttle, bypass-inert-in-prod                                               | unit verification cores; manual device                       | U+M           |
| **Resend (email)**          | send OTP/reward/invite/digest | 5xx→retry via breaker, no idempotency dupe, webhook delivered/bounce/complaint→suppress, missing `email_id`→no stuck-sent | unit standard-webhook, resend cores; db invite delivery      | U+DB+M(inbox) |
| **Web Push**                | send to subscription          | 404/410→prune, VAPID pair, quiet hours/frequency caps, permission lifecycle                                               | unit push cores; manual device                               | U+M           |
| **Supabase**                | RPC/RLS/auth                  | service-role scoping, migration parity, readiness probe                                                                   | db suite; smoke:supabase:migrations                          | DB            |
| **Google Places/Nominatim** | address autocomplete          | key absent (optional), timeout, malformed → graceful                                                                      | (light)                                                      | E/M           |
| **Sentry**                  | capture request error         | DSN unset→no-op, flag kill-switch, PII scrubbed, release tag present                                                      | unit sanitisers; instrumentation                             | U+M           |
| **PostHog** (optional)      | pseudonymous mirror           | disabled by default, PII rejected when enabled                                                                            | unit analytics-privacy                                       | U             |

Reconciliation cases: Stripe subscription vs `billing_customers` after webhook (runbook step 5); Resend delivery receipts vs `notification_deliveries`/invite status; queued event ≠ delivered (dossier §13 caution).

---

## 20. Email, analytics, and observability plan

### 20.1 Email/notifications

- Templates: OTP, reward, invitation, poster (PDF attach), weekly digest, birthday, direct reward, referral milestones (`lib/notifications/*-email.ts`, HTML in-code). Test: sender = `RESEND_FROM` verified; subject/from/reply-to correct; mobile rendering (manual); links resolve and honour expiry (invite 30-day, OTP 1h); unsubscribe link works and suppresses; duplicate-send prevented by dedupe/idempotency; failed delivery → suppression (bounce/complaint). No customer marketing email without consent (marketing category gate).
- OTP delivery paths: merchant email OTP (Supabase hook→Resend), customer phone OTP (Twilio), customer email verify (Resend). Test expired/duplicate for each.

### 20.2 Analytics

- Event correctness: `product_events` names fire at the right points (join, stamp, reward, billing, referral) with `sanitizeMetadata` blocklist (no auth/email/endpoint/lat/long/phone/token). No duplicate events (dedupe on notification side; product events are best-effort — assert not double-recorded on retry). Tenant attribution present. Web-vitals persisted with route_key only, no URL/IP/PII (`web_vital_samples` has no such columns). Prod vs staging separation via `VERCEL_ENV`.
- **Consent posture:** telemetry beacons are not consent-gated (only same-origin + rate-limit). Decision for owner/legal (§30-Q3); regardless, assert no PII leaves (unit allowlists + a captured-payload inspection).

### 20.3 Observability

- Health/readiness probes return correct shape + revision; readiness secret-gated + DB check (contract + prod-smoke). Structured logs one-JSON-line with request-id correlation. Sentry captures request errors with route tags, scrubbed URLs, release = commit SHA; kill-switch flag works.
- **Alerting gaps to close:** production-smoke covers liveness/readiness/revision and files incident issues — but **cron execution and provider-delivery failures are not alerted** (dossier §6.8/§14 note "operator-facing provider failure visibility remains an improvement area"). Add: cron last-success staleness monitor (OBS-04, R-08) and a notification/invite failure-rate check. Verify Sentry has no tunnel (ad-block may drop client events — accept or add).

---

## 21. Detailed test case catalogue

Critical and high-priority cases. Columns: ID · Area · Role · Preconditions · Steps · Expected · Type · Priority · Automation candidate · Related files. Type: U/DB/E/M as before. Many already exist (noted "✓ exists" in Expected); the catalogue is exhaustive enough to execute without reading the codebase.

### Join & identity

| ID      | Role            | Preconditions              | Steps                                                                     | Expected                                                                                               | Type       | Pri | Auto                                       | Files                                                                      |
| ------- | --------------- | -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- | --- | ------------------------------------------ | -------------------------------------------------------------------------- |
| JOIN-01 | new customer    | active venue QR            | Scan `/q/[qrId]`, complete phone OTP, accept terms                        | Membership + first stamp created atomically; terms snapshot (SHA-256) written; `customer_joined` event | DB+E       | P0  | yes (✓ `customer-lifecycle`, live-DB spec) | `20260713110000`; `app/m/[merchantSlug]/join/actions.ts`                   |
| JOIN-02 | new customer    | Twilio down                | Request OTP                                                               | Fail-closed "unavailable", no membership, no enumeration                                               | U+E        | P0  | yes                                        | `lib/customer/verification.ts:60-69`                                       |
| JOIN-03 | new customer    | wrong code ×N              | Enter bad OTP repeatedly                                                  | Rejected; multi-key rate limits fire (phone 5, IP 30/day, verify 5)                                    | DB         | P0  | yes                                        | `lib/customer/otp-rate-limit-core.ts`                                      |
| JOIN-04 | prospect        | prod env                   | Set `CUSTOMER_OTP_BYPASS_MODE=any-4-digits` in a production-profile check | Rejected/ignored (inert outside local)                                                                 | U+contract | P0  | yes                                        | `check-env.mjs:260-268`; `verification.ts:196-215`                         |
| JOIN-05 | new customer    | card misconfigured         | Join where first-stamp raises                                             | Membership created, `first_stamp_issued=false`, `join_first_stamp_pending` event; retry recovers       | DB+E       | P1  | yes                                        | `card/[membershipId]/actions.ts:112-139`; `customer_join_stamp_recoveries` |
| JOIN-06 | existing member | has membership             | Scan same venue QR                                                        | Redirect to `/card/[id]/stamp`, no duplicate membership                                                | E          | P1  | yes (✓)                                    | `app/q/[qrId]/page.tsx:100-102`                                            |
| JOIN-07 | new customer    | paused QR / lapsed billing | Scan QR                                                                   | Safe unavailable state, no raw error, no membership                                                    | E          | P1  | yes                                        | `lib/customer/join.ts:139-142`                                             |

### Stamping

| ID       | Role         | Preconditions                | Steps                                          | Expected                                                           | Type           | Pri | Auto                           | Files                              |
| -------- | ------------ | ---------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | -------------- | --- | ------------------------------ | ---------------------------------- |
| STAMP-01 | customer     | membership, <full card       | Self-stamp with valid QR                       | +1 stamp, counters advance, `self_service_qr` source               | DB+E           | P0  | yes (✓ `customer-card-stamp`)  | `20260710180000:498-601`           |
| STAMP-02 | customer     | already stamped today        | Stamp again same UK day                        | Refused, no double count (partial-unique index)                    | DB             | P0  | yes (✓ `customer-stamp-edges`) | stamp_events index                 |
| STAMP-03 | 2 concurrent | same membership, same day    | Two simultaneous self-stamps                   | Exactly one `stamp_events` earned row                              | DB (committed) | P0  | yes (✓ `architecture-moat`)    | `architecture-moat.test.mjs`       |
| STAMP-04 | customer     | no QR proof                  | Call stamp action without valid `qrId`         | "Venue QR scan proof required"                                     | DB+E           | P0  | yes                            | `20260710180000:521-553`           |
| STAMP-05 | customer     | across DST / London-midnight | Stamp at 23:55 then 00:05 BST/GMT              | Two different business dates → two stamps allowed; same date → one | DB+U           | P1  | yes (**new**)                  | `uk-date`, `uk-calendar`           |
| STAMP-06 | customer     | full card                    | Self-stamp                                     | "Reward already ready", refused                                    | DB             | P0  | yes (✓)                        | redemption-cycles RPC              |
| STAMP-07 | customer     | out-of-range geo             | Stamp with far coords                          | Stamp still succeeds; `geo_flagged=true` + fraud flag; not blocked | DB             | P1  | yes                            | `record_self_service_geo_flag`     |
| STAMP-08 | system       | any stamp sequence           | After sequence, compare counters to ledger sum | Counters == aggregates (no desync)                                 | DB             | P0  | yes (**new**, R-04)            | `20260630127000`, `20260713100000` |

### Rewards & redemption

| ID     | Role         | Preconditions                      | Steps                                      | Expected                                                                     | Type | Pri | Auto                             | Files                              |
| ------ | ------------ | ---------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- | ---- | --- | -------------------------------- | ---------------------------------- |
| RWD-01 | customer     | completes card Friday              | Complete final stamp                       | Reward unlocked, `redeemable_from=Monday` (weekend skipped)                  | DB+U | P0  | yes (✓ `customer-lifecycle`)     | `next_uk_business_date`            |
| RWD-02 | customer     | reward not yet redeemable          | Try to mint token before `redeemable_from` | Blocked                                                                      | DB   | P0  | yes                              | `create_reward_scan_token`         |
| RWD-03 | customer     | eligible, profile incomplete       | Open `/reward/[id]`                        | Profile gate (name/DOB 18+/verified email) blocks QR                         | DB+E | P0  | yes (✓ redemption-second-factor) | `20260703120000:119-122`           |
| RWD-04 | merchant     | valid token                        | Scan `/r/[token]`, confirm collect         | Reward redeemed once; stamp_cycle → cycle advances; issued → cycle untouched | DB+E | P0  | yes (✓ `issued-rewards-*`)       | `20260704091000:378-395`           |
| RWD-05 | 2 concurrent | one unlocked reward                | Two collect attempts                       | One `redeemed`, other "already redeemed"                                     | DB   | P0  | yes (✓ `reward-scan-single-use`) | collect RPC                        |
| RWD-06 | merchant B   | token minted for merchant A        | B scans A's token                          | Rejected (wrong merchant)                                                    | DB+E | P0  | yes                              | reward-collection ownership        |
| RWD-07 | merchant     | token minted, admin cancels reward | Mint → admin cancel → collect              | Collect re-validates state, refuses                                          | DB   | P1  | yes (**new**)                    | `admin_cancel_reward`; collect RPC |
| RWD-08 | customer     | expired token (>10 min)            | Collect                                    | Refused, fail-closed                                                         | DB   | P1  | yes                              | reward_scan_tokens expiry          |
| RWD-09 | customer A   | reward of customer B               | GET `/reward/B-id/status`                  | 404 (not-found≡unauthorized)                                                 | E    | P0  | yes (✓)                          | `status/route.ts:32-36`            |

### Issued rewards & referrals

| ID      | Role             | Preconditions                 | Steps                                            | Expected                                                   | Type | Pri | Auto                              | Files                          |
| ------- | ---------------- | ----------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ---- | --- | --------------------------------- | ------------------------------ |
| GIFT-01 | merchant         | active billing                | Send direct gift twice same UK day to one member | 2nd blocked (cap 1/membership/day)                         | DB   | P1  | yes                               | `issue_merchant_direct_reward` |
| GIFT-02 | merchant         | near London midnight          | Send at 23:00 then 01:00                         | Counts as two dates (confirm intended)                     | DB   | P1  | yes (**new**)                     | uk_business_date               |
| BDAY-01 | system           | birthday month                | Cron issues; run twice same year                 | ≤1 per (merchant,customer,year), incl. cancelled           | DB   | P1  | yes (✓)                           | reward_events birthday index   |
| REF-01  | referrer/referee | share link                    | Referee joins via `?ref`                         | `attributed` edge, no bonus yet                            | DB+E | P1  | yes (✓ `referral-attribution`)    | `20260710170000`               |
| REF-02  | referee          | attributed                    | Referee earns first genuine stamp                | Edge → `qualified`                                         | DB   | P1  | yes (✓)                           | `qualify_referral_on_stamp`    |
| REF-03  | referrer         | 3 referrals settle same day   | Settle bonuses                                   | Cap 2/day → 3rd `held(daily_bonus_limit)`, drains next day | DB   | P1  | yes (✓ `referral-settlement`)     | settlement RPC                 |
| REF-04  | referrer         | full card                     | Referral settles                                 | `held(card_full)`, retries on reward replenish             | DB   | P1  | yes (✓)                           | settlement RPC                 |
| REF-05  | attacker         | >5 qualified/24h              | Concentration                                    | Newest `rejected` + `referral_concentration` flag          | DB   | P1  | yes (✓ `referral-fraud-controls`) | `20260710220000`               |
| REF-06  | referee          | joins via loyalty_invite only | Invite-stamp received                            | Does it qualify a referral? Record + owner decision        | DB   | P1  | yes (**new**, §30-Q4)             | `qualify_referral_on_stamp`    |

### Bulk invitations

| ID     | Role            | Preconditions                     | Steps                                      | Expected                                                                                         | Type | Pri | Auto                     | Files                           |
| ------ | --------------- | --------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---- | --- | ------------------------ | ------------------------------- |
| INV-01 | merchant        | —                                 | Paste 2001 emails, confirm                 | Cap enforced; ≤2000 eligible; invalid/dupe reported                                              | DB+E | P0  | yes (✓ e2e)              | `create_loyalty_invite_draft`   |
| INV-02 | merchant        | active campaign exists            | Start second campaign                      | Refused (one active/merchant)                                                                    | DB   | P0  | yes                      | advisory lock `20260722100400`  |
| INV-03 | recipient       | valid claim link                  | Open `/invite/[token]`, join, accept terms | `claim_loyalty_invite`: join + exactly 2 `loyalty_invite` stamps (NULL date), recipient scrubbed | DB+E | P0  | yes                      | `20260722100200`                |
| INV-04 | 2 users         | forwarded link                    | Two claim same token                       | Single consumer (`FOR UPDATE`); 2nd sees clean "already claimed"                                 | DB   | P0  | yes (**new**)            | claim RPC                       |
| INV-05 | existing member | already a member                  | Claim invite                               | Member-precedence: no double membership, correct handling                                        | DB   | P0  | yes (✓ `20260722100500`) | claim precedence                |
| INV-06 | system          | Resend returns no `id`            | Send then webhook arrives                  | Status not stuck at `sent` (reconciliation)                                                      | DB+U | P1  | yes (**new**, R-15)      | `webhook-core.ts`               |
| INV-07 | ops             | `CUSTOMER_SESSION_SECRET` rotated | Rotate secret, open old link               | All outstanding claim/unsub links break — documented blast radius                                | U+M  | P1  | partial (**new**, R-09)  | `lib/loyalty-invites/tokens.ts` |
| INV-08 | recipient       | bounce for venue A                | Address bounces                            | Global suppression (all venues) — confirm intended                                               | DB   | P1  | yes                      | suppressions `20260722100000`   |

### Billing, admin, GDPR, cross-tenant

| ID      | Role                | Preconditions          | Steps                                              | Expected                                                                                         | Type | Pri | Auto                                  | Files                               |
| ------- | ------------------- | ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---- | --- | ------------------------------------- | ----------------------------------- |
| BILL-01 | merchant            | checkout               | Complete Stripe checkout, webhook applies          | `billing_customers` mirrors sub; entitlement active                                              | DB+U | P0  | yes (✓ `billing-state-durability`)    | `apply_stripe_subscription_event`   |
| BILL-02 | attacker            | —                      | Hit `/app` with `?checkout=success` but no webhook | Not entitled (query string ≠ authority)                                                          | E    | P0  | yes                                   | billing return verify               |
| BILL-03 | system              | subscription cancelled | Webhook cancels                                    | Stamp/reward blocked (advisory-locked entitlement trigger)                                       | DB   | P0  | yes (✓ `reward-billing-moat`)         | `20260713190000`                    |
| BILL-04 | system              | out-of-order events    | Apply `active` then delayed `trialing`             | No status regression (`stale`)                                                                   | DB   | P0  | yes (**new**)                         | `apply_current_stripe_subscription` |
| BILL-05 | system              | duplicate webhook      | Same event id twice                                | `{duplicate}`, no double effect                                                                  | U+DB | P0  | yes (✓)                               | `stripe_webhook_events` PK          |
| BILL-06 | merchant            | `past_due`             | Stamp/redeem while past_due                        | Currently allowed; launch-not-ready — record + owner sign-off                                    | DB   | P1  | yes (**new**, §30-Q2)                 | launch-readiness-core               |
| ADM-01  | admin               | active internal_admin  | Adjust stamps with reason                          | Applied, audit-logged, counters consistent                                                       | DB+E | P0  | yes (✓ admin e2e)                     | `admin_adjust_membership_stamps`    |
| ADM-02  | admin               | —                      | Adjust to drive negative / fabricate reward        | Rejected / invariant preserved                                                                   | DB   | P0  | yes (**new**)                         | admin RPC                           |
| ADM-03  | plain authenticated | not admin              | Call `admin_*` RPC directly                        | `insufficient_privilege`                                                                         | DB   | P0  | yes (partly via ACL; add behavioural) | `is_internal_admin()`               |
| GDPR-01 | admin               | customer exists        | Erase PII                                          | PII nulled, email surrogated, ledger retained, sessions revoked, push disabled, invites scrubbed | DB   | P0  | yes (✓ `customer-erasure`)            | `20260711093000`, `20260721100000`  |
| GDPR-02 | admin               | customer exists        | Export data                                        | Complete bundle; no PII in ledger metadata; scope confirmed                                      | DB   | P0  | yes (✓ + **new** metadata scan)       | `admin_export_customer_data`        |
| GDPR-03 | system              | 365-day retention      | Run purge at boundary                              | Active edge retained; abandoned anonymised                                                       | DB   | P1  | yes (**new**)                         | `admin_purge_stale_customer_pii`    |
| TEN-01  | merchant A          | B's data exists        | Read B via URL/API/RPC id                          | 404 / `insufficient_privilege`; no data                                                          | DB+E | P0  | yes (✓ `tenant-rls`)                  | RLS + RPC ownership                 |
| TEN-02  | anon                | —                      | Call any privileged RPC                            | `permission denied` (anon revoked)                                                               | DB   | P0  | yes (✓ containment)                   | `20260606165000`                    |

### Auth, security, recovery, mobile, a11y

| ID      | Area             | Steps                                                           | Expected                                                  | Type          | Pri         | Files                             |
| ------- | ---------------- | --------------------------------------------------------------- | --------------------------------------------------------- | ------------- | ----------- | --------------------------------- |
| AUTH-01 | merchant login   | Wrong password ×N                                               | Generic error; bucket 5/15 min fires                      | E+DB          | P0          | `actions.ts:231`                  |
| AUTH-02 | customer session | Revoke on device A                                              | A invalidated, B persists                                 | E             | P1          | `lib/customer/session.ts`         |
| AUTH-03 | open redirect    | `/auth/confirm?next=//evil`                                     | Sanitised to same-origin                                  | U+E           | P0          | `app/auth/confirm/route.ts:10-29` |
| SEC-01  | CSRF             | Cross-origin cookie POST to `/api/notifications/push/subscribe` | Rejected or origin-checked                                | E             | P1          | R-07                              |
| SEC-02  | headers          | Curl app route                                                  | HSTS, X-Frame DENY, nosniff, CSP nonce present            | E/M           | P1          | `lib/security/csp.ts`             |
| SEC-03  | rate identity    | Requests without `x-vercel-forwarded-for`                       | Not a shared `"unknown"` global bucket exploit            | DB/inspection | P1          | `rate-limit-core.ts:21-26`        |
| SEC-04  | dev routes       | GET `/dev/*` in production                                      | 404                                                       | E/M           | P0          | `app/dev/layout.tsx:31-33`        |
| REC-01  | recovery         | Restore latest backup to disposable project, run `test:db`      | Restore succeeds; invariants hold                         | M             | P0 (launch) | runbook §backup                   |
| REC-02  | rollback         | `vercel rollback` to last healthy, re-probe                     | Health/readiness green on restored revision               | M             | P1          | runbook §rollback                 |
| MOB-01  | camera           | Scan printed QR on iOS Safari + Android Chrome                  | Camera opens, decodes, routes                             | M             | P0          | `*-scanner.tsx`                   |
| MOB-02  | push             | Grant push on installed iOS PWA + Android; send                 | Received; 404/410 prunes                                  | M             | P1          | `push-sender.ts`, `sw.js`         |
| MOB-03  | print            | Print all 8 posters + 5 tents; scan at size                     | QR scans reliably                                         | M             | P1          | poster/tent PDF                   |
| A11Y-01 | keyboard         | Traverse join→stamp→redeem keyboard-only                        | Focus visible/ordered; sheets trap focus                  | M             | P1          | Radix Sheet                       |
| A11Y-02 | axe              | Sweep customer harness states                                   | No serious/critical violations                            | E             | P1          | extend `a11y.spec.ts`             |
| OFF-01  | offline          | Go offline on `/card/[id]`                                      | `/offline` shell, no stale card, auto-reload on reconnect | E+M           | P2          | `sw.js`, `app/offline`            |

---

## 22. Requirements traceability matrix

Code-derived features (no formal PRD). Status: **Covered** (behavioural test exists), **Partial** (shape/indirect only, or gap noted), **Manual** (needs human/device), **Gap** (add).

| Feature                             | Source files                                                    | Main risks                                        | Unit                          | Integration/DB                                     | E2E                                  | Manual                    | Status                                         |
| ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- | ----------------------------- | -------------------------------------------------- | ------------------------------------ | ------------------------- | ---------------------------------------------- |
| Merchant signup + email OTP         | `app/(auth)/**`, hooks                                          | enumeration, hook secret                          | email-otp cores               | —                                                  | signup-verify, hook-routes           | Resend inbox              | **Partial** (inbox manual)                     |
| Onboarding + launch readiness       | `lib/merchant/launch-readiness-*`, `create_merchant_onboarding` | predicate drift                                   | readiness core                | onboarding-transaction                             | launch-setup                         | —                         | **Covered** (+parity gap §12.4)                |
| Stripe checkout/webhook/entitlement | `lib/stripe/**`, webhook route                                  | dup/reorder, live acceptance                      | webhook/checkout cores        | billing-state-durability, reward-billing-moat      | billing-recovery                     | live-mode                 | **Partial** (BILL-04 new, live manual)         |
| QR scan → join → first stamp        | `app/q`, `app/m/**/join`, join RPCs                             | Twilio, first-stamp, live-DB CI skip              | otp/session cores             | customer-lifecycle, +5 live-DB (CI-skipped)        | join flows ×6                        | Twilio device             | **Partial** (CI-wire live-DB)                  |
| One stamp per UK day                | stamp RPC, uk-date                                              | DST, concurrency                                  | uk-date/calendar (property)   | customer-card-stamp, architecture-moat             | stamp choreography                   | —                         | **Covered** (+DST/counter new)                 |
| Reward unlock + redeem (two-rail)   | `20260703120000`, `20260704091000`                              | cycle drain on issued                             | —                             | issued-rewards-\*, reward-scan-single-use          | reward-scan                          | —                         | **Covered** (pin invariant)                    |
| Issued/direct/birthday rewards      | `20260704090000-096000`, `lib/rewards`                          | caps, under-18 gift, expiry                       | —                             | issued-rewards                                     | send-reward, birthday                | —                         | **Covered** (+cap boundary new)                |
| Referral v2                         | `20260708-20260712` referral migrations                         | held stranding, invite-qualify, order-dep RPC     | —                             | referral suite ×8                                  | attribution, bonus-stamp             | —                         | **Partial** (cron route, REF-06 new)           |
| Bulk loyalty invitations            | `20260722100000-500`, `lib/loyalty-invites/**`                  | claim race, token rotation, stuck-sent, GA gating | token/import/webhook cores    | claim precedence                                   | invite-customers ×3                  | inbox                     | **Partial** (INV-04/06/07 new; drain cron gap) |
| Billing lapse fails closed          | entitlement triggers                                            | past_due, predicate drift                         | —                             | reward-billing-moat, architecture-moat             | —                                    | —                         | **Covered** (§30-Q2)                           |
| Multi-tenant isolation              | RLS policies, RPC ownership                                     | service-role misuse                               | —                             | tenant-rls, rls-hashed-policies, architecture-moat | admin/merchant scoping               | —                         | **Covered** (extend 37-table list)             |
| RPC privilege containment           | `20260711090000`, repair `20260713090000`                       | signature drift, over-grant                       | —                             | rpc-execute-privilege-containment                  | —                                    | —                         | **Covered** (+catalogue-parity new §12.3)      |
| Customer session integrity          | `lib/customer/session.ts`, proxy                                | revocation, multi-device                          | session-cookie (property)     | session registration                               | login                                | —                         | **Covered** (+multi-device new)                |
| Admin ops + audit                   | `app/admin/**`, admin RPCs                                      | MFA removed, direct-RPC                           | —                             | erasure, consent                                   | admin ×7                             | —                         | **Partial** (ADM-02/03 new; MFA §30-Q1)        |
| GDPR export/erasure/retention       | `20260630129000`, `20260711093000`, `20260713120000`            | scope, ledger PII, boundary                       | —                             | customer-erasure\*, phone-plaintext-retirement     | privacy-export                       | —                         | **Partial** (GDPR-02/03 new; scope §30-Q7)     |
| Notifications outbox/drain          | `lib/notifications/**`, cron                                    | budget backlog, cron secret                       | drain-plan, caps, quiet-hours | notifications ×5                                   | notification-settings, announcements | push device               | **Partial** (**cron route gap**)               |
| Web Push                            | push routes, `sw.js`                                            | device variance                                   | push cores                    | —                                                  | notification-settings                | device                    | **Manual** (device)                            |
| Marketing claims single-source      | `lib/marketing/facts.ts`, promo                                 | stray prices, stale promo                         | promo                         | —                                                  | —                                    | —                         | **Covered** (claims/jsonld gates)              |
| Legal terms + snapshots             | `lib/legal/content.ts`, terms tables                            | legal accuracy                                    | —                             | terms-acceptance                                   | —                                    | legal review              | **Partial** (legal review external)            |
| PWA / offline                       | `sw.js`, app-pwa                                                | update flow, iOS                                  | —                             | —                                                  | pwa-offline                          | iOS installed             | **Partial** (update-flow gap)                  |
| Health/readiness/monitoring         | probes, prod-smoke                                              | cron/provider alerting                            | —                             | production-readiness-probe                         | —                                    | —                         | **Partial** (OBS-04 alerting gap)              |
| Recovery (backup/restore/rollback)  | runbook                                                         | PITR off, no drill                                | —                             | —                                                  | —                                    | restore drill, rollback   | **Gap** (launch-blocking)                      |
| Provider live acceptance            | smoke scripts, runbook                                          | test≠live                                         | —                             | smoke:providers                                    | —                                    | Stripe/Twilio/Resend/push | **Gap** (launch-blocking)                      |

---

## 23. Automated test architecture

A pyramid the repo already mostly implements; the recommendation is to **fill gaps and re-tier**, not to add frameworks.

| Tier                | Framework (keep)                             | Test                                                                                              | Do NOT test here                 | Directory                                      | Naming                                            | Frequency                      | CI stage                                          | Failure policy                                                            |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------- | ------------------------------------------------- | ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------- |
| Unit                | `node:test` + alias hook, fast-check         | pure `lib/**` logic, PII/date/rate cores, payload builders, readiness derivations                 | anything touching DB/network/DOM | `tests/unit/*.test.mjs`                        | `<module>.test.mjs`, `<module>.property.test.mjs` | every push/PR                  | `fast` lane, coverage 80/80/70 on `lib/**`        | block                                                                     |
| Contract (shape)    | `node:test`                                  | source/SQL structure that must not silently drift, copy governance                                | behaviour                        | `tests/contracts/*.test.mjs`                   | `<area>.test.mjs`                                 | every push/PR                  | `fast` lane                                       | block (but demote copy dupes)                                             |
| Live DB             | `node:test`, `postgres`                      | RLS, RPC ACL, ownership, races, idempotency, ledgers, GDPR, catalogue parity, availability parity | UI, provider delivery            | `tests/db/*.test.mjs`                          | `<invariant>.test.mjs`                            | every push/PR                  | **`db` → new required `DB behavioral moat` gate** | **block (change from today)**                                             |
| Component/UI states | Playwright over dev harness                  | rendered states, gates, empty/error/loading, a11y sweep                                           | trust mechanics (do in DB)       | `tests/e2e/*.spec.ts` (+`app/dev/**` fixtures) | `<surface>.spec.ts`, `.desktop.spec.ts`           | every PR (16 shards)           | `e2e`/`a11y`/`visual` gates                       | block                                                                     |
| E2E over live DB    | Playwright + `SUPABASE_DB_URL`               | join/QR/redeem truth in a browser                                                                 | broad coverage (keep small)      | `tests/e2e/*-live-db.spec.ts`                  | `*-live-db.spec.ts`                               | **new CI lane** or nightly     | new gate or nightly                               | block in its lane                                                         |
| Visual              | Playwright snapshots                         | pixel baselines (darwin + `-linux`)                                                               | logic                            | `*-snapshots/`                                 | platform-suffixed                                 | every PR                       | `visual` gate                                     | block; bless via runbook                                                  |
| Accessibility       | `@axe-core/playwright`                       | WCAG2 A/AA automated subset                                                                       | manual SR checks                 | `a11y.spec.ts`, `.desktop`                     | `@a11y` tag                                       | every PR                       | `a11y` gate                                       | block                                                                     |
| Performance         | Lighthouse CI, k6, `EXPLAIN` in DB           | budgets, race throughput, query cost                                                              | correctness                      | `.lighthouserc.json`, `tests/load`             | —                                                 | anon: PR; authed/load: nightly | `lighthouse` gate (PR); nightly (load)            | block PR budgets; monitor nightly                                         |
| Mutation            | Stryker                                      | test strength on critical cores                                                                   | coverage                         | `stryker.conf.json`                            | —                                                 | nightly                        | nightly                                           | **raise from report-only: set a break threshold on the 8 critical files** |
| Security scan       | CodeQL, ZAP, dependency-review, `pnpm audit` | SAST, DAST baseline, deps                                                                         | —                                | `.github/**`, `.zap/`                          | —                                                 | PR + nightly + weekly          | codeql/zap/dep-review                             | block on high; audit as non-blocking advisory (see §24)                   |
| Smoke               | curl/scripts                                 | providers, migrations, prod probes                                                                | —                                | `scripts/*smoke*`, `production-smoke.yml`      | —                                                 | pre-release + every 15 min     | pre-prod + post-deploy                            | block release                                                             |

Key re-tiering actions: (1) promote `db` to a required gate; (2) add a live-DB Playwright lane (or retire those specs); (3) give Stryker a non-zero break on the 8 critical modules; (4) add cron-route handler tests to the `db`/integration tier; (5) reduce reliance on shape-contracts where a DB behavioural test can replace them.

---

## 24. CI/CD quality gates

Current pipeline (`.github/workflows/ci.yml`) and recommended gate policy. **Bold = required to block merge/deploy.**

### Pull request (push + PR to `main`)

- **Format/lint/typecheck** (`fast` lane) — block.
- **Contract + unit tests + coverage 80/80/70** (`fast` lane) — block.
- **Governance** (`quality` lane: deadcode, duplicates, debt, flags, docs, agents, tokens, claims) — block.
- **Production build + bundle budget + JSON-LD** (`build` lane) — block.
- **`build-gate`** rollup ("Typecheck and build") — **block** (existing required check).
- **E2E 16-shard + `e2e-gate`** — block. **A11y + `a11y-gate`** — block. **Visual + `visual-gate`** — block. **Lighthouse + `lighthouse-gate`** — block.
- **DB behavioral moat (`db`)** — **currently NOT gated; recommend adding a `db-gate` rollup and making it required** (R-01).
- Dependency-review (fail-on-high, deny copyleft) — block. CodeQL — block on high. ZAP baseline — advisory (currently not gated).
- `pnpm audit` — **recommend demoting from a hard required step to an advisory job** that files an issue rather than reddening every PR on a new upstream advisory (R-2-adjacent); keep dependency-review as the blocking supply-chain gate.

### Main branch (post-merge)

- Full suite re-runs; **`db` job green required before deploy**; migration hygiene (`check-supabase-migrations.mjs`) append-only + no-dup + linked-drift.

### Pre-production (release candidate)

- `env:check:production`, `security:audit`, `smoke:supabase:migrations`, `typecheck`, `build` (runbook entry criteria `docs/operations/production-runbook.md:10-23`) — block.
- Full E2E incl. the live-DB lane; nightly cross-browser green; ZAP full (nightly) triaged; Lighthouse budgets; visual twins refreshed.
- **Stripe live-acceptance gate** (5 recorded checks, runbook `:24-44`) — block. Provider smoke (`smoke:providers`) — block. **Restore-drill + rollback-candidate identified** — block.

### Post-deployment

- `production-smoke.yml` every 15 min: `/api/health` + `/api/readiness` + revision match → auto-file/close incident issue. Manual promoted-SHA smoke (runbook `:47-72`): `/`→404, anonymous public routes, `/dev/*`→404, one merchant login + customer login + QR join + stamp/redeem + one email + one OTP in target env (never with production customer data).
- **Add:** cron last-success staleness check and notification/invite failure-rate alert (OBS-04, R-08); analytics event sanity in target env.

**Deployment-blocking failures:** any required gate red; `db` moat red (once gated); env-check/migration-parity fail; Stripe live gate unmet; readiness red on two probes; no identified rollback candidate.

---

## 25. Test environment and test-data plan

| Environment          | Purpose                               | Data                                                                                                                                                                                                   | Reset                                                                                       |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **Local dev**        | feature work; DB-free e2e via harness | `pnpm db:setup` (migrate+seed): "Old Crown Girton" pilot merchant, ≥3 rewards, active billing, seeded customers/stamps (`supabase/seed*.sql`); Inbucket captures email; `CUSTOMER_DEV_OTP_CODE=424242` | `db:reset` / `db:clean:customers` / `db:reset:today-stamps`; runner refuses non-local hosts |
| **CI**               | gates                                 | ephemeral Supabase (`supabase start`) + `db:seed` in the `db` job; DB-free harness elsewhere; non-secret env fixtures + strict production-profile fixtures (CI-only, never promoted)                   | per-job ephemeral                                                                           |
| **Staging**          | pre-prod parity, provider test-mode   | disposable, migration-parity-checked; Stripe/Twilio/Resend test mode; **never production customer data**                                                                                               | reset from migrations + seed                                                                |
| **Production smoke** | post-deploy verification              | one controlled merchant + controlled customer created for the check; masked identifiers only in evidence                                                                                               | tear down test fixtures; never reuse real customer rows                                     |

Required accounts/roles for a full pass: one internal admin (`internal_admins`), two merchants (A and B, for tenant isolation), one venue each (primary location + geofence variant), several customers (new, returning, full-card, under-18 DOB, verified-email, marketing-consented and not), one referral pair, one invite-campaign recipient set, Stripe test cards (success, trial, `past_due`, cancelled), Twilio test numbers (or bypass locally), Resend test recipients (delivered/bounce/complaint), and QR/NFC records for active/paused/regenerated join QRs.

Data rules: seed via scripts only; **never use real customer data for routine testing** (runbook and dossier both mandate this); production evidence records masked identifiers + object ids + timestamps only; stress data via `db:seed:stress` (100k members) on disposable DBs; clean up smoke fixtures after each run; the seed merchant owner id (`00000000-…-001`) is shared — DB tests must rollback or self-clean around it.

Fixture/factory recommendation (R-fixtures): introduce a shared `tests/support/factories/*` for customer/merchant/membership/reward so live-DB and live-DB-Playwright helpers stop reconstructing rows independently (removes drift; eases adding DB tests).

---

## 26. Bug-reporting process

Template (aligns with the repo's structured issue forms in `.github/`):

```
Bug ID:            NAB-<area>-<n>
Title:             <concise symptom>
Environment:       local | CI | staging | production
Build/commit:      <SHA> (from /api/health revision if prod)
User role:         anon | customer | merchant | admin | system
Preconditions:     <data/state required>
Steps to reproduce: 1… 2… 3…
Expected result:   <server-authoritative expectation>
Actual result:     <observed>
Frequency:         always | intermittent (x/y) | once
Severity:          Critical | High | Medium | Low (§27)
Priority:          P0 | P1 | P2 | P3 (§27)
Browser/Device:    <e.g. iOS 18 Safari / iPhone 14>
Screenshots/Video: <attach; Playwright trace on failure>
Console output:    <redacted>
Network response:  <status + {error} body>
Logs:              <request-id from x-request-id; Sentry event id if any>
Related files:     <path:line>
Suspected cause:   <hypothesis>
Owner:             <assignee>
Status:            open | triaged | in-progress | fixed | verified | closed
Regression test:   <required test id + tier; must be added before close for Critical/High>
```

Rules: Critical/High require a written failing regression test before the fix merges (TDD; the repo already practices this). Correlate every prod bug with the `x-request-id` and Sentry event id. Cross-tenant, duplicate-redemption, billing-entitlement, and GDPR bugs are always Critical and page the risk owner (`info@lapeninns.com`). Production incidents follow `docs/operations/incident-response.md`; the 15-minute monitor auto-files readiness incidents already.

---

## 27. Severity and priority framework

### Severity (with codebase examples)

- **Critical** — security breach, data loss, cross-tenant exposure, incorrect payment, duplicate redemption, production outage, unrecoverable corruption. _Examples:_ Merchant A reads B's members (RLS hole); a reward redeemed twice or by the wrong merchant; an issued reward draining the stamp cycle (refuted, but this class); billing lapse still allowing free rewards; erasure leaving PII in ledger metadata; `CRON_SECRET` misconfig silently stopping all crons.
- **High** — core workflow unusable, no reasonable workaround. _Examples:_ join wizard OTP fails for all users; self-stamp rejects valid same-first-of-day scans; checkout never entitles; bulk-invite claim awards 0 or 4 stamps; admin cannot erase on a GDPR request.
- **Medium** — important feature impaired, workaround exists. _Examples:_ announcement push not delivered but reward still in-app; poster PDF wrong for one design; readback `limit` over-fetch; past_due grace ambiguity.
- **Low** — cosmetic/wording/minor UX. _Examples:_ stale invite-desk copy ("aren't available for your venue yet"); visual baseline twin drift; a non-blocking Lighthouse best-practices dip.

### Priority

- **P0 — fix immediately:** any Critical on a live path; production outage; cross-tenant; payment/redemption correctness.
- **P1 — before launch:** all §28 launch-checklist blockers; High on core journeys J3–J7/J10/J12/J13; missing cron-route tests; DB-gate wiring; provider acceptance; restore drill.
- **P2 — soon after launch:** high-value regression automation (live-DB browser lane, counter-reconciliation, availability parity), a11y manual sweep, mutation break-threshold.
- **P3 — scheduled:** visual expansion, deeper perf/chaos, extra browsers, contract-to-behaviour migration, factory refactor.

---

## 28. Release-readiness checklist

The launch gate. Each item names its evidence source. **No launch while any box is unchecked or any Critical/High-on-core-journey defect is open.**

**Correctness & data**

- [ ] No open Critical defects (any area).
- [ ] No open High defects affecting core journeys J3–J7, J10, J12, J13.
- [ ] `db` behavioural moat green on the release SHA **and** wired as a required gate (R-01).
- [ ] Multi-tenant isolation verified — `tenant-rls`, `rls-hashed-policies`, `architecture-moat` green; 37-table forced-RLS assertion extended.
- [ ] Critical business rules verified — one-stamp-per-day, next-business-day redeemable, two-rail redemption, duplicate-redemption prevention, billing-fails-closed, invite exactly-2-stamps (DB suite green).
- [ ] Counter/ledger reconciliation test added and green (STAMP-08).
- [ ] RPC catalogue-parity + availability-parity tests added and green (§12.3–12.4).
- [ ] Database integrity — migration hygiene green; migrations applied to the target Supabase project and ledger matches (`smoke:supabase:migrations`).

**Auth & security**

- [ ] Authentication verified — merchant password+OTP, customer phone OTP, session revocation, protected-route gating.
- [ ] Authorisation verified — §4.2 matrix negatives green (incl. non-admin direct RPC, anon RPC revoked).
- [ ] Admin MFA decision recorded (§30-Q1) and, if MFA is required, re-enabled and tested.
- [ ] OTP dev-bypass proven inert in production profile (JOIN-04).
- [ ] Security review complete — CodeQL clean/triaged; ZAP full triaged; dependency-review green; headers/CSP verified on live origin; CSRF posture decided (R-07).
- [ ] Secrets present and correctly scoped in production (`env:check:production`); CI fixture secrets confirmed never promoted.

**Experience & compatibility**

- [ ] Mobile testing complete — camera scan + push + install on iOS Safari and Android Chrome (MOB-01/02).
- [ ] Print testing complete — all 8 posters + 5 tents scan at print size (MOB-03).
- [ ] Browser matrix complete — §17.3 P0/P1 rows.
- [ ] Accessibility review complete — automated a11y gate green + manual keyboard/SR pass on core journeys.
- [ ] Performance targets met — Lighthouse budgets green; members-page query cost bounded at scale; drain burst clears (PERF-03/06).

**Integrations & operations**

- [ ] Stripe live acceptance recorded (runbook 5-check gate) — price IDs, portal, signed webhook, single event, entitlement readback.
- [ ] Twilio, Resend, Web Push provider acceptance recorded (`smoke:providers` + manual device/inbox).
- [ ] Email delivery verified — OTP, reward, invitation, digest render + links + unsubscribe + suppression.
- [ ] Analytics verified — events fire with no PII; prod/staging separated; telemetry consent decision recorded (§30-Q3).
- [ ] Monitoring active — `/api/health` + `/api/readiness` probing every 15 min; incident auto-filing confirmed.
- [ ] Alerts active — readiness incident issues + new cron-staleness/provider-failure alert (OBS-04).
- [ ] Backups verified — Supabase daily backup present.
- [ ] Restore process tested — non-production restore drill executed and recorded (R-03).
- [ ] Rollback documented + rehearsed — last healthy deployment identified; `vercel rollback` path confirmed.

**Compliance & sign-off**

- [ ] Privacy/legal pages available and current (`/privacy`, `/terms`, `/cookies`, `/merchant-terms`, `/data-processing`); human legal review of terms/age-gate/reward-terms complete.
- [ ] GDPR export/erasure verified end-to-end; export scope decision recorded (§30-Q7).
- [ ] Accepted-risk register current — SEC-RISK-001 (recycled phone) acceptance still valid at launch.
- [ ] Production configuration reviewed — `vercel.json` crons enabled; region; env; no `/dev/*` reachable (returns 404).
- [ ] Smoke tests passed on the promoted SHA (runbook manual smoke).
- [ ] Product-owner approval recorded, including the four §30 decisions resolved in writing.

---

## 29. Prioritised QA implementation roadmap

Complexity: S ≤1 day, M ≤1 week, L >1 week. Owner roles: QA (test engineer), BE (backend/DB), FE (frontend), DevOps (CI/infra), PO (product owner).

### Immediate — launch-blocking

| Task                                                                               | Why                                          | Cx  | Owner     | Depends on                      | Tool                           | Files                                                                        |
| ---------------------------------------------------------------------------------- | -------------------------------------------- | --- | --------- | ------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| Make `db` a required gate (add `db-gate` rollup)                                   | R-01: ledger/RLS regressions can merge today | S   | DevOps    | branch-protection access        | GH Actions                     | `.github/workflows/ci.yml`                                                   |
| Add cron route-handler tests (notifications, referral-drain, +4)                   | 6 production crons; 2 have zero e2e          | M   | QA+BE     | test harness for bearer routes  | node:test/Playwright           | `app/api/cron/**`, `lib/security/cron-auth.ts`                               |
| Wire or retire the 5 live-DB Playwright specs                                      | They skip in every CI job today              | M   | DevOps+QA | CI Supabase already in `db` job | Playwright + `SUPABASE_DB_URL` | `tests/e2e/*-live-db.spec.ts`                                                |
| Run provider live-acceptance evidence (Stripe/Twilio/Resend/push)                  | test-mode ≠ live; launch gate                | M   | DevOps+PO | live credentials                | `smoke:providers`, runbook     | runbook, `scripts/provider-readiness/**`                                     |
| Execute restore drill + rollback rehearsal                                         | R-03: recovery unproven, PITR off            | M   | DevOps    | disposable staging project      | Supabase/Vercel CLI            | runbook                                                                      |
| Manual device + print matrix (camera, push, printed QR, OTP/email)                 | no automation can cover; P0 journeys         | M   | QA        | devices, test venue             | manual                         | scanners, poster PDFs                                                        |
| Resolve §30 owner decisions (Q1 MFA, Q2 past_due, Q3 telemetry, Q4 invite-qualify) | each changes tests/behaviour                 | S   | PO        | —                               | —                              | see §30                                                                      |
| Fix `.env.example` (add `CUSTOMER_EMAIL_HMAC_SECRET`) + contract-parity test       | R-14: missing key breaks email match         | S   | BE        | —                               | `check-env.mjs`                | `.env.example`, `config/env-contract.json`, `lib/customer/email-pii-core.ts` |

### Next — high-value automation (reduces greatest regression risk)

| Task                                             | Why                                     | Cx  | Owner  | Depends                                | Tool                     | Files                                               |
| ------------------------------------------------ | --------------------------------------- | --- | ------ | -------------------------------------- | ------------------------ | --------------------------------------------------- |
| RPC catalogue-parity test                        | R-04: migration/overload drift          | M   | BE+QA  | manifest of intended signatures/grants | node:test over `pg_proc` | extend `rpc-execute-privilege-containment.test.mjs` |
| Availability-predicate parity matrix             | R-10: triplicated logic, past_due drift | M   | BE+QA  | Q2 decision                            | node:test (DB)           | `launch-readiness-core`, entitlement triggers       |
| Counter↔ledger reconciliation test               | R-04 desync class                       | S   | BE     | —                                      | node:test (DB)           | stamp/redeem RPCs                                   |
| Bulk-invite hardening (INV-04/06/07)             | newest surface, P0                      | M   | BE+QA  | —                                      | node:test + unit         | `lib/loyalty-invites/**`                            |
| Billing out-of-order/webhook edge (BILL-04)      | reorder must not regress                | S   | BE     | —                                      | node:test                | `apply_current_stripe_subscription`                 |
| Extend a11y axe sweep to customer harness states | current sweep app/marketing-heavy       | S   | FE+QA  | harness fixtures                       | axe-playwright           | `a11y.spec.ts`                                      |
| Shared DB/e2e factories                          | remove per-helper drift                 | M   | QA     | —                                      | node                     | `tests/support/factories/**`                        |
| Stryker break-threshold on 8 critical modules    | R: mutation report-only today           | S   | QA     | —                                      | Stryker                  | `stryker.conf.json`                                 |
| Cron-staleness + provider-failure alerting       | R-08 observability gap                  | M   | DevOps | monitor secret                         | GH Actions/Sentry        | `production-smoke.yml`                              |
| Nightly e2e against `next start`                 | R-12: prod-build browser behaviour      | M   | DevOps | —                                      | Playwright               | `nightly.yml`, `run-playwright.mjs`                 |

### Later — maturity

| Task                                                         | Why                   | Cx  | Owner  | Tool            |
| ------------------------------------------------------------ | --------------------- | --- | ------ | --------------- |
| Authed-route Lighthouse lane                                 | LHCI only anon today  | M   | DevOps | LHCI + auth     |
| Expand visual baselines to customer journey states           | coverage              | M   | QA     | Playwright      |
| Deeper load/soak (drain burst, race at higher VUs)           | PERF-05/06            | M   | QA     | k6              |
| Migrate high-value shape-contracts to behavioural DB tests   | reduce brittleness    | L   | QA+BE  | node:test       |
| Automated traceability check (matrix ↔ suite)                | R: manual matrix rots | M   | QA     | script          |
| Extra browsers (Edge, older iOS) + BrowserStack-style matrix | compatibility         | M   | QA     | device cloud    |
| Per-design poster A4 renderer unit assertions                | untested renderers    | M   | FE     | node:test       |
| Chaos: provider outage injection, breaker verification       | resilience proof      | L   | BE     | fault injection |

---

## 30. Unverified items and questions for the product owner

### 30.1 Product-owner decisions (each changes tests or behaviour — resolve before launch)

- **Q1 — Admin MFA.** AAL2 was deliberately removed (`supabase/migrations/20260720100000_remove_admin_aal2_requirement.sql`), so destructive admin powers sit behind a password-only session + `internal_admins` row. Is single-factor admin acceptable at launch, or should TOTP step-up be reinstated (config already supports it)?
- **Q2 — `past_due` grace.** Stamp/redeem RPCs block only `cancelled|suspended`; `past_due` keeps stamping/redeeming while failing launch-readiness (`lib/merchant/launch-readiness-core.ts`). Is continuing loyalty during `past_due` the intended grace behaviour? (Determines BILL-06 expectation.)
- **Q3 — Telemetry without consent.** Web-vitals and funnel beacons fire with same-origin + rate-limit only, no cookie-consent gate, and there is no cookie-consent banner. Given the data is pseudonymous first-party, is this acceptable under the UK/GDPR posture, or is a consent gate required? (Legal input needed.)
- **Q4 — Referral qualification via invite stamps.** `qualify_referral_on_stamp` excludes only `referral_bonus|imported|manual_adjustment`; a friend whose only stamp is a `loyalty_invite` welcome stamp would qualify a referral without a genuine visit. Intended, or should `loyalty_invite` be excluded too?

### 30.2 Product/behaviour confirmations (lower urgency, still record)

- **Q5 — Bot defence.** No CAPTCHA exists; OTP/signup abuse defence is durable rate-limiting whose client identity trusts only `x-vercel-forwarded-for`. Accept as-is (Vercel-only deploy) or add a challenge on OTP-send/signup?
- **Q6 — Bank holidays.** `next_uk_business_date` skips Sat/Sun but (from the code read) not UK bank holidays. Is a Monday-after-a-bank-holiday redeemable date acceptable, or should holidays be skipped?
- **Q7 — GDPR export scope.** `admin_export_customer_data` returns a customer's data across _all_ merchants. Confirm all admins are global (not merchant-scoped), so this is not over-disclosure.
- **Q8 — Global email suppression.** A bounce/complaint for one venue suppresses that address across all venues (merchant_id NULL suppression). Confirm intended.
- **Q9 — Customer self-redeem grant.** `redeem_self_service_reward` is granted to `authenticated`, so a customer could in principle self-redeem via RPC without a merchant scan. Confirm the merchant-scan gate is the only intended path and this grant is deliberate (or tighten).
- **Q10 — Bulk invitations GA.** Gating moved from a feature flag + allowlist to a per-merchant column to fully default-on (`20260722100400`); stale copy ("aren't available for your venue yet") and references to a non-existent `lib/loyalty-invites/access.ts` remain. Confirm GA-for-all-merchants is intended and clean up the dead copy/refs.

### 30.3 Cannot be verified from the repository (require live/external evidence)

- **U1 — Provider live behaviour:** Stripe live price IDs/portal/webhook, Twilio real+expired+throttled SMS, Resend inbox delivery/reputation, Web Push on real devices, Google Places key. (Repo ships verifiers; execution is external.)
- **U2 — Branch-protection configuration:** which CI checks are actually required is set in GitHub settings, not the repo. This plan assumes the five gate jobs are required and recommends adding a `db` gate; confirm actual settings.
- **U3 — Supabase migration parity:** whether the target project's ledger matches `supabase/migrations` (the pinned Stripe API version and `production_readiness_probe` RPC must exist live).
- **U4 — Cron execution:** `vercel.json` schedules prove intent, not that Vercel Cron fires with the correct secret in production.
- **U5 — Deployment specifics:** deployed revision, secret values, Vercel region/preview-env globs, `NEXT_PUBLIC_*` inlining correctness, backup schedule/PITR status.
- **U6 — The `.deepsec` findings** cited by the security risk register (`.deepsec/findings/MEDIUM/...`) are not in the repository, so the underlying security-scan evidence for SEC-RISK-001 could not be reviewed.

### Final-review confirmation

- Every critical workflow J1–J14 appears in the test plan (§5, §21) with a priority and layer.
- Every role in §4 has permission tests (§13.3, §14, §21 TEN/ADM cases).
- Every important API (§11) has positive and negative cases; the two untested cron routes are called out.
- Every external integration (§19) has failure/edge cases; provider live acceptance is a launch gate.
- Concurrency and duplicate-submission risks are addressed (§10.2, §10.6, §12.2, STAMP-03, RWD-05, INV-04, BILL-04/05).
- Security, privacy, accessibility, monitoring, backups, and rollback are all covered (§15, §16, §20, §28, REC-01/02).
- Executed vs proposed is explicit throughout: **no test was executed for this assessment**; "✓ exists" marks a test present in the repo (not a fresh pass), and "**new**" marks a proposed addition.
- The plan is implementable directly: each proposed test names an ID, tier, expectation, and target file; each roadmap task names owner, complexity, dependency, and files.

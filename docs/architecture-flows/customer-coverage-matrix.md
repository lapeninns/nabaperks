# Customer Flow — Test Coverage Matrix

Date: 2026-06-30. A code-grounded audit of the **entire customer surface** (5
parallel source maps over entry/identity, stamp/card/geofence, reward/cycle, and
wallet/profile/consent/notifications), against the automated tests, with the
gaps closed by a new live-DB journey + edge suite.

## How to read this

Coverage is only meaningful per **tier**, because the tiers prove different things:

| Tier | Runner | Proves |
|---|---|---|
| **live-DB** | `pnpm test:db` (node --test, real Postgres RPCs in rolled-back txns) | Runtime ledger/RLS behaviour — the trust mechanic. |
| **unit** | `pnpm test` | Pure TS functions (math, sanitisers) execute correctly. |
| **e2e** | `pnpm test:e2e` (Playwright over the DB-free `/dev/app-harness`) | Real markup renders; route gates redirect. |
| **contract test** | `pnpm test` | **Source-grep** — the code/SQL is *shaped* a certain way. Wiring, not behaviour. |

Key fact: `pnpm test` (the default gate) runs only **unit + contract test** — so a
plain green run executes *no* customer-behaviour test. Behaviour lives in
`pnpm test:db` and `pnpm test:e2e`, which are separate CI jobs.

Legend — **yes** = a behaviour-executing test walks it; **partial** = manufactured
precondition / static fixture / grep only; **gap** = no behaviour test.

## The matrix

| # | Customer step | Before | Now | Behaviour test (tier) |
|---|---|---|---|---|
| 1 | Join: enrol + first stamp atomically | yes | **yes** | `customer-join` J-6 · `customer-lifecycle` (live-DB) |
| 2 | Join: idempotent re-join | yes | **yes** | `customer-join` J-7 (live-DB) |
| 3 | Stamp: one per UK business day | yes | **yes** | `customer-card-stamp` · `architecture-moat` race (live-DB) |
| 4 | **Stamp: card fills 1 → full** | partial | **yes** | `customer-lifecycle` STEP 1–3 — earned by real stamping (live-DB) |
| 5 | **Reward: unlocks by stamping** | partial (manufactured) | **yes** | `customer-lifecycle` STEP 3 (live-DB) |
| 6 | Reward: not same-day redeemable (next UK business day) | gap | **yes** | `customer-lifecycle` STEP 3 next-day gate (live-DB) |
| 7 | Redeem: single-use scan token | yes | **yes** | `reward-scan-single-use` · `architecture-moat` race (live-DB) |
| 8 | **Cycle: resets + `active_cycle_number == redeemed + 1`** | partial (manufactured) | **yes** | `customer-lifecycle` STEP 5 (live-DB) |
| 9 | **Cycle 2: starts clean (not 4/3)** | gap | **yes** | `customer-lifecycle` STEP 6 (live-DB) |
| 10 | **Redeem: idempotent double-redeem (no double advance)** | gap | **yes** | `reward-redemption-edges` (live-DB) |
| 11 | **Redeem: expired token refused** | gap | **yes** | `reward-redemption-edges` (live-DB) |
| 12 | **Redeem: cross-merchant token refused** | gap | **yes** | `reward-redemption-edges` (live-DB) |
| 13 | **Stamp: full card refuses more stamps** | gap | **yes** | `customer-stamp-edges` (live-DB) |
| 14 | **Stamp: mid-cycle `stamps_required` BRICK** | gap | **yes** | `customer-stamp-edges` (live-DB) |
| 15 | **Stamp: geofence is soft (flags, never blocks)** | gap | **yes** | `customer-stamp-edges` (live-DB) |
| 16 | **Stamp: unlocking stamp needs ≥3 pool items** | gap | **yes** | `customer-stamp-edges` (live-DB) |
| 17 | Billing fails closed (customer's stamp refused) | yes | **yes** | `architecture-moat` (live-DB) |
| 18 | **Profile: verified contact is immutable (+ erasure GUC bypass)** | partial (grep) | **yes** | `customer-profile` (live-DB) |
| 19 | **Profile gate blocks redemption until name+DOB** | partial (grep) | **yes** | `customer-profile` (live-DB) |
| 20 | **Consent: off by default, append-only, per-membership** | partial (grep) | **yes** | `customer-consent` (live-DB) |
| 21 | **Erasure: admin-gated, anonymises, retains ledger** | partial (grep only!) | **yes** | `customer-erasure` (live-DB) |
| 22 | **Session: mint / touch (no slide) / revoke beats cookie** | partial (grep) | **yes** | `customer-session` (live-DB) |
| 23 | **Session: expired inactive, can't mint already-expired** | gap | **yes** | `customer-session` (live-DB) |
| 24 | **Notifications: claim only due, flip to delivering, limit** | partial (grep) | **yes** | `notifications` (live-DB) |
| 25 | Login: anonymous route gates redirect | yes | yes | `start-destination-gates` (e2e) |
| 26 | Login: `next=` open-redirect blocked | yes | yes | `safe-next-path` (unit) |
| 27 | Merchant scan surface masks the member (PII) | yes | yes | `merchant-reward-scan` (e2e) · `customer-readback` (unit) |
| 28 | Public surfaces: WCAG 2 A/AA | yes | yes | `a11y` mobile + desktop route sweep (e2e) |

## What this round added

16 new live-DB tests (`tests/db/`), all green, taking the tier from 6 → 22:

- **`customer-lifecycle.test.mjs`** — the organic journey: join → stamp to full →
  reward unlocks **by stamping** → next-business-day gate → redeem → cycle resets
  → cycle 2 starts clean. Closes the manufactured-unlock and cycle-reset holes
  (#4, #5, #8, #9). Time is the only thing simulated (ageing `earned_business_date`).
- **`customer-stamp-edges.test.mjs`** — full-card refusal, the mid-cycle brick,
  soft-geofence-flags-not-blocks, ≥3-pool guard (#13–#16).
- **`reward-redemption-edges.test.mjs`** — idempotent double-redeem, expired
  token, cross-merchant token (#10–#12).
- **`customer-consent.test.mjs`** / **`customer-erasure.test.mjs`** /
  **`customer-profile.test.mjs`** — the GDPR/PII trio, previously grep-only
  (#18–#21). Erasure in particular went from *zero executed coverage* to a real
  admin-gated anonymise-and-retain test.
- **`customer-session.test.mjs`** / **`notifications.test.mjs`** — session
  integrity and the durable-queue claim (#22–#24).

## Remaining gaps (and why they live elsewhere)

These are real and worth a test, but are **not** live-DB-shaped:

- **Anti-enumeration wallet login** (always-send OTP; "no cards found" only after
  a verified code; no session minted for an unknown number). App-layer
  (Twilio Verify + signed cookies). Best as a Playwright e2e with
  `CUSTOMER_DEV_OTP_CODE`, or a focused route test. Currently grep-only.
- **Email re-verification round-trip** (change email → OTP → verified). App-layer
  (Resend + signed cookie). The DB backstop (immutability) is now covered (#18).
- **PWA install/push-service worker events**. The styled offline fallback is now
  browser-covered; install prompt behavior, `pushsubscriptionchange`,
  `notificationclick`, and real push-service delivery still need browser/provider
  proof.
- **Notification concurrency** (two workers, one event, `FOR UPDATE SKIP LOCKED`).
  The *transition* is covered (#24); the *race* is structurally identical to the
  proven stamp/token races in `architecture-moat` and would need the same
  committed-fixture concurrency harness.

## Round 2 — unit + e2e additions (2026-06-30)

A second pass closed the highest-value of the above gaps without needing new
infrastructure, plus surfaced one real bug:

- **Anti-enumeration wallet login** → `tests/e2e/customer-login-flow.ts`,
  `tests/e2e/customer-login.spec.ts`, and
  `tests/e2e/customer-login.desktop.spec.ts`. Drives
  the real `/home/login` actions against a customer-flow dev server: an unknown
  number reaches the OTP step (no enumeration leak), a wrong code renders
  ordinary feedback, and a valid code mints **no session** while showing the
  no-card message. Opt-in via `CUSTOMER_FLOW_E2E=1` (it needs local Supabase +
  `.env.local`); the default DB-free e2e job leaves it skipped.
  - **Bug fixed:** `customer-login-form.tsx` now retains the verify action state
    and renders wrong-code / no-card feedback instead of silently discarding the
    result. The browser spec now asserts the fixed UX and the no-session
    security property.
- **Frequency cap (6/day) + quiet-hours defer** → extracted the pure policy into
  `lib/notifications/frequency-cap-core.ts` and the Europe/London math into
  `lib/notifications/london-time.ts` (also de-duplicating `londonBusinessDate`),
  then unit-tested: `tests/unit/notification-frequency-cap.test.mjs` (cap=6,
  classifier, retry window) and `tests/unit/notification-quiet-hours.test.mjs`
  (wrap-past-midnight, inclusive-start/exclusive-end, GMT/BST, next-09:00,
  business-date boundary).
- **AW-8 phone PII storage** → extracted the pure codec into
  `lib/customer/phone-pii-core.ts` and unit-tested
  `tests/unit/phone-pii.test.mjs`: HMAC deterministic + non-reversible, versioned
  AES-GCM ciphertext with a fresh IV, last4 readback, never plaintext.

## Round 3 — PWA browser proof (2026-06-30)

- **PWA offline fallback** → `tests/e2e/pwa-offline.desktop.spec.ts`. Drives
  Chromium through `/home/login`, waits for the service worker to control the
  page at scope `/`, switches the browser context offline, and proves a
  server-state `/home` navigation renders the cached `/offline` page with its
  linked Next CSS and Wet Ink layout instead of stale loyalty or account state.

Still open: email re-verify round-trip, PWA install/push-service events, the
notification concurrency race.

## Round 4 — a11y browser sweep expansion (2026-06-30)

- **Public/customer-adjacent a11y** -> `tests/e2e/helpers/a11y-sweep.ts`,
  `tests/e2e/a11y.spec.ts`, and `tests/e2e/a11y.desktop.spec.ts`. The gate now
  runs WCAG 2 A/AA axe checks in both iPhone and desktop Chromium projects
  across the public marketing/legal/auth/offline/guide routes plus DB-free
  merchant/dev harness lanes, and it fails before axe when a swept route returns
  HTTP 400+.
- The expanded sweep exposed and closed a keyboard-scroll issue in the
  paper-vs-QR guide table, destructive alert contrast on the error-state
  harness, CSS-module purity issues in poster print styles, and a dev-only
  poster preview shell-provider mismatch.

Still open: Lighthouse scoring, manual assistive-tech review, email re-verify
round-trip, PWA install/push-service events, the notification concurrency race.

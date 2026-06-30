# Nabaperks Architecture Audit

**Date:** 2026-06-30 · **Method:** multi-agent verified audit — 12 domain auditors read the real implementation (source, RPCs, 48 migrations, RLS policies, route handlers) across all 60 architecture areas → material findings sent to independent skeptics instructed to *refute* them → synthesis ranked only verified issues. *(102 agents · 6.6M tokens · 1,857 tool calls.)*

**This is the actionable backlog.** Detailed fix-tickets (evidence, fix, acceptance criteria, checkbox) live in **[findings.md](./findings.md)**.

## How to use this
1. Work the **Fix tracker** below top-down (it's in priority order). Each row links to its ticket ID in `findings.md`.
2. A ticket is done when its **acceptance criteria** pass — tick the box in `findings.md` and update the Status column here.
3. Before touching anything, read **Verified-strong invariants** — these are the trust moat; a fix must not regress them.
4. Don't re-open anything in **Debunked**. Don't expect this file to cover **Needs dynamic verification** — that requires running the app / a pentest.

## By the numbers
| Verified area status (of 60) | Findings (108) | Actionable confirmed |
|---|---|---|
| ✅ 39 strong · 🟡 15 partial · ⚠️ 5 gap · 🔴 1 bug | 81 confirmed · 5 refuted · 3 uncertain | **3 High · 9 Medium · 10 Low** |

## Verdict
A genuinely well-engineered trust platform. Every load-bearing safety invariant the verifiers attacked **held**. The original serious gaps were **around** the core stamp/reward ledger: statutory GDPR erasure, security headers, and CI that never ran the tests. Those source gaps are now remediated repo-side; target Supabase migrations, provider-path smoke, and live runtime proof remain tracked separately.

---

## ✅ Verified-strong invariants — DO NOT regress
The auditors tried hardest to break these and could not. Any fix must preserve them; add a behavioral test (H3) before refactoring near them.
- **One-stamp-per-UK-day** — partial unique index + `FOR UPDATE` row-lock + `unique_violation` catch (correct across the BST/midnight boundary).
- **Single-use reward redemption** — short-TTL, row-locked, ownership-checked, `consumed_at` single-use token; merchant-gated.
- **Fail-closed billing** — gates live inside `SECURITY DEFINER` RPCs, not just the app.
- **Deny-by-default RLS** — `enable + force` on core + trust-critical tables; anon fully revoked and never re-granted; no cross-tenant read constructible.
- **Server-only secret boundary** — service-role key import-guarded; never reaches a client bundle.
- **No-double-send notification ledger** — `on conflict (dedupe_key)`.

---

## 🛠 Fix tracker

### 🔴 High
| ID | Title | Effort | Status |
|----|-------|--------|--------|
| H1 | No functional GDPR erasure / data export | M–L | ☑ Done repo-side |
| H2 | Zero HTTP security headers (CSP/HSTS/XFO/…) | S | ☑ Done repo-side |
| H3 | Tests never run in CI + ~90% are source-grep | S+M | ☑ Done repo-side |

### 🟡 Medium
| ID | Title | Effort | Status |
|----|-------|--------|--------|
| M1 | Lowering `stamps_required` mid-cycle bricks members (bug) | M | ☑ Done repo-side |
| M2 | 4-digit merchant OTP brute-forceable | S | ☑ Done repo-side |
| M3 | Merchant raw-PII read via RLS; masking app-layer only | M | ☑ Done repo-side |
| M4 | No per-customer notification frequency cap | S–M | ☑ Done repo-side |
| M5 | ~700 lines dead counter-handshake SQL (misleads audits) | S | ☑ Done repo-side |
| M6 | Self-serve stamping earnable off-premises | M / decision | ☑ Done repo-side |
| M7 | Fraud review queue is write-only | S–M | ☑ Done repo-side |
| M8 | `create_or_get_join_qr` can mint a new slug (latent) | S | ☑ Done repo-side |
| M9 | `safePath` open-redirect bypass via embedded tab | S | ☑ Done repo-side |

### ⚪ Low
| ID | Title | Effort | Status |
|----|-------|--------|--------|
| L1 | Delivery worker ignores configured quiet hours | S | ☑ Done repo-side |
| L2 | Immutability trigger doesn't pin `auth_user_id` | S | ☑ Done repo-side |
| L3 | Reward-pool RPCs don't enforce ≥3 minimum | S | ☑ Done repo-side |
| L4 | Webhook double-inserts analytics on transient error | S | ☑ Done repo-side |
| L5 | Partial multi-subscription push marked terminal | S | ☑ Done repo-side |
| L6 | `enforce_rate_limit` cold-bucket first-insert race | S | ☑ Done repo-side |
| L7 | Wallet shows dateless "phantom" stamp dots | S | ☑ Done repo-side |
| L8 | Landing "venue proof" quotes lack provenance disclosure | S | ☑ Done repo-side |
| L9 | Analytics event-name taxonomy drift (no guard) | S | ☑ Done repo-side |
| L10 | `product_events` DB insert isn't PII-sanitized | S | ☑ Done repo-side |

### Suggested sequencing
Completed repo-side on 2026-06-30. The original sequencing is retained as the remediation history:

1. **Quick-win security bundle (all Small):** H2 (headers) → H3-wire (`pnpm test` into CI) → M9 (safePath) → M2 (6-digit OTP). High leverage, low risk, mostly independent.
2. **Highest legal value:** H1 (GDPR erasure + export). Larger; pairs with M3 (PII backstop) and L10.
3. **Trust-path safety net:** H3-behavioral (pgTAP moat tests) before any refactor near the verified invariants; then M1 (stamps bug).
4. **Hygiene / process:** M5, M7, M8, then the Low batch.

---

## 🚫 Debunked — do NOT re-open
Verification refuted these plausible-but-wrong claims (including ones the earlier structural spec implied). Don't spend time here.
1. **"RLS force-enabled on every table"** — `merchant_email_otp_aliases` has `enable` without `force` + no policy, but it's **harmless** (anon+authenticated GRANT-revoked; service-role bypasses RLS). Optional: add force-RLS + a CI guard.
2. **"`redeem_self_service_reward` is dead code"** — false; it's called inside `collect_reward_scan_token` (live from `reward-collection.ts:87`). The grep was TS-only.
3. **"`require_geofence` with NULL coords degrades"** — false; venue write fail-closes on geocode failure, so the row can't exist.
4. **"Marketing-consent RPC rejects `push`"** — false; a later migration accepts `push`; the path is live.
5. **"Destructive all-migrations-rerun is unsafe"** — false; no migration repopulates dropped columns, and the rerun is hard-gated to localhost (prod uses `supabase db push`).
6. **"Stamp reversal blocks same-day re-stamp"** — false; lives in the dead counter-handshake subsystem; the live path matches index semantics.
7. **"No GDPR process anywhere"** — a manual channel exists; the real gap (it only logs, never erases) is **H1**.
8. **"Reward QR re-mints a token every refresh"** — false; it reuses an un-consumed token with >5min life.

---

## 🔬 Needs dynamic verification (out of scope for source audit)
A code audit can't *prove* runtime behavior. To validate the verified-as-correct invariants and the suspected gaps, run these separately:
- `[~]` **DB moat / live concurrency:** local CI now runs a DB behavioral moat for one-stamp-per-day under concurrent double-scan, single-use redemption under two simultaneous scans, and billing fail-close. Target Supabase or live pentest concurrency remains useful for environment-specific settings and the cold-bucket rate-limit race (L6).
- `[~]` **Pentest with real anon/authenticated/service_role JWTs:** local live-DB proof now sets anon/authenticated/service_role database contexts directly and confirms anon denial, authenticated tenant scoping, raw-PII denial, cross-tenant write refusal, and explicit service-role privilege. Target PostgREST/JWT pentest remains.
- `[x]` **Browser redirect probe:** local live-DB Playwright proved a successful merchant login with `next=/\t/evil.example` stays same-origin and falls back to `/app` (M9).
- `[~]` **Stripe CLI replay:** forged/replayed/test-mode events against the real endpoint (signature, idempotency, livemode). Current `pnpm smoke:providers` is deliberately read-only and records this as blocked until a deployed route and operator-approved Stripe replay target are supplied.
- `[~]` **Live OTP rate-limit probe** against nabaperks.com (note: `.env.local` points to **local** Supabase; prod GoTrue config is dashboard-only) (M2). Current provider smoke proves Twilio account and Verify-service readability only; OTP sends/live rate-limit probing remain blocked because the smoke suite is non-sending.
- `[~]` **axe / Lighthouse + manual AT:** local Playwright axe now runs WCAG 2 A/AA against public marketing/legal/auth/offline routes plus DB-free merchant/dev harness lanes in both iPhone and desktop Chromium projects, and route responses must resolve below HTTP 400 before axe runs. Lighthouse and manual assistive-tech review remain separate proof.
- `[~]` **Production profiling / `EXPLAIN ANALYZE`:** CWV/INP/LCP, per-stamp budget, index *usage* at scale (indexes exist; plan usage unconfirmed). This remains blocked on target/staging data and a profiling window; local source and migration checks cannot prove production planner behavior.
- `[~]` **Real browser + push service:** local Chromium proof now registers the SW at `/`, caches `/offline` plus its linked Next CSS, and serves the styled Wet Ink offline fallback for a server-state `/home` navigation while offline. Web Push to FCM/APNs, `pushsubscriptionchange`, `notificationclick`, and the multi-subscription retry drop (L5) still need real push-service proof.
- `[~]` **Ops / secrets audit:** that the manual GDPR process is honored; prod env vars present/strong (`CRON_SECRET`, live `STRIPE_WEBHOOK_SECRET`, high-entropy phone key); whether any out-of-repo tool decrypts `phone_ciphertext` (write-only in-repo). Refreshed local `pnpm env:check:production` still fails on `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_VAPID_SUBJECT`, `CRON_SECRET`, and `SUPABASE_SEND_EMAIL_HOOK_SECRET`.
- `[~]` **Confirm marketing quote provenance** with the named venues (only the anti-fake-*name* guard is mechanical) (L8). Repo-side copy now discloses paraphrased/illustrative operator voice, so launch no longer depends on treating the wording as verified testimony; actual venue sign-off remains an external proof item.

### Current release blockers

Refreshed on 2026-06-30 from this checkout:

- `pnpm env:check:production` exits 1 because the local environment lacks
  `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`,
  `WEB_PUSH_VAPID_SUBJECT`, `CRON_SECRET`, and
  `SUPABASE_SEND_EMAIL_HOOK_SECRET`.
- `pnpm smoke:supabase:migrations` exits 1 because the linked target is missing
  `20260628120000` plus the remediation batch `20260630120000` through
  `20260630131000`.
- `pnpm smoke:providers --offline` exits 1 with 17 gates needing evidence.
- `pnpm smoke:providers` exits 1 with 13 gates needing evidence. Read-only
  checks currently pass remediation RPC presence in the configured database,
  Stripe Growth price lookup, Twilio Verify lookup, Resend API credentials, and
  PostHog config; they do not prove hosted Supabase parity, webhook replay,
  Twilio/Resend sends, cron/auth-hook/Web Push delivery, analytics capture, or
  legacy SMS hook-secret disposition.

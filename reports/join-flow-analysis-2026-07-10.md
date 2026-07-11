# Customer Join Flow — End-to-End Analysis

_Date: 2026-07-10 · Scope: scan venue QR → register (phone OTP) → collect first stamp → land on card. Read-only audit._

This report was produced by tracing the flow across four dimensions in parallel (routes/UX,
data/transactions, security/abuse, tests/observability). Several findings were independently
corroborated by more than one pass; that agreement is noted as a confidence signal. Every claim
carries a `file:line` anchor so it is checkable.

---

## 1. Executive summary

The flow is, on the whole, **well-architected**: a single atomic RPC does membership + first stamp;
the `/card` IDOR surface is properly guarded; phone is stored only as HMAC + AES-GCM ciphertext +
last4; the rate limiter fails closed; OTP verify brute-force is infeasible; the session secret fails
closed if unset. The UX is a clean discriminated-union state machine with defensive fallbacks.

The problems cluster in four areas: **(a) OTP-send abuse economics**, **(b) a privilege-grant
regression that an existing test should have caught but didn't**, **(c) an observability blind spot
around silently-swallowed first-stamp failures**, and **(d) a tail of UX correctness bugs and dead
code** in the routing/state layer.

### Top findings (ranked)

| # | Severity | Finding | Anchor | Corroboration |
|---|----------|---------|--------|---------------|
| 1 | **HIGH** | SMS-pumping / toll-fraud: all ~240 dialing regions accepted, OTP-send rate-limited per-phone only (rotate number → fresh bucket), no per-IP distinct-phone cap, no CAPTCHA, SMS sent before any QR/merchant validation | `lib/customer/phone.ts:21`, `lib/customer/otp-rate-limit-core.ts:1-18`, `app/m/[merchantSlug]/join/actions.ts:88-117` | 2 independent passes |
| 2 | **MEDIUM** (concrete; test currently red) | Privileged RPCs `join_customer_membership_with_first_stamp` and 8-arg `issue_self_service_stamp` re-granted to `authenticated`, off the containment allowlist — the exhaustive containment test asserts against exactly this | `…20260712100000…:264-266` & `:1104-1106` vs `…20260711090000…`; test `tests/db/rpc-execute-privilege-containment.test.mjs:124-142` | 3 independent passes + verified firsthand |
| 3 | **MEDIUM** | First-stamp failure is swallowed for _all_ 16 causes into a `raise warning` + `firststamp=pending`, with no reason code to the app, no `logger` call, no `product_event`, no alert, and no test at any tier — a systemic regression would be invisible | `…20260712100000…:249-257`; render `lib/customer/experience/load-card.ts:72` | 2 passes |
| 4 | **MEDIUM** | Rate-limit identity = `sha256(IP + user-agent)` — collapses a whole NAT/CGNAT venue into one bucket (60 scans/min/QR shared) while an attacker rotates the UA for free | `lib/security/rate-limit-core.ts:3-11`; scan bucket `lib/customer/join.ts:93-99` | 2 passes |
| 5 | **MEDIUM** | Recycled phone number = account/PII takeover: match is `phone_hmac` only, no dormancy or re-validation | `lib/customer/identity.ts:55-114` | 1 pass |
| 6 | **LOW-MED** | Orphaned identity + data-minimization: `customers` row + 30-day session created at OTP-verify, _before_ terms/consent; abandoners leave PII + a live session purged only after 365 days. Loyalty-terms acceptance is never persisted to the DB at all | `app/m/[merchantSlug]/join/actions.ts:207-212`; purge `…20260711090000…:113-132` | 2 passes |
| 7 | **LOW-MED** | Analytics + Twilio on the tap-critical path (see §6 for the corrected picture) | `app/m/[merchantSlug]/join/actions.ts:104,259,301,313`; `lib/customer/verification.ts:55` | 1 pass (corrected an earlier over-estimate) |
| 8 | **LOW** | Pending-phone cookie stores plaintext E.164 (signed, not encrypted); `secure` only in production | `lib/customer/session.ts:49-64,247-254` | 2 passes |
| 9 | **LOW** (correctness) | Cluster of UX bugs: unencoded `qrId` in the returning CTA, `?blocked=` copy-injection slot, held-reward mislabeled "stamped today", join-time geofence silently unimplemented, several dead params | see §7 | 1 pass |

---

## 2. The flow, end to end

### 2.1 Three phases

1. **Scan** — the printed QR encodes `/q/{qrId}`. `app/q/[qrId]/page.tsx` is a pure dispatcher:
   `resolveQrForJoin` (`lib/customer/join.ts:82`) rate-limits the scan, looks up `qr_codes ⋈ merchants ⋈
   loyalty_cards ⋈ billing_customers`, and computes availability (`destination_type='join'` ∧ active ∧
   merchant live ∧ billed). Then it branches: rate-limited → `RateLimitedQr`; dead/unavailable →
   `UnavailableQr`; existing membership (session present) → `redirect(/card/{id}/stamp?qr=)`; else →
   `redirect(/m/{slug}/join?qr=)`. A `qr_scanned` event is deferred off the critical path with `after()`.

2. **Register** — `/m/[merchantSlug]/join` renders `JoinWizard`, a stateless switch over a derived
   `experience.kind`. Three server actions advance it (`app/m/[merchantSlug]/join/actions.ts`):
   `requestCustomerIdentityAction` (normalize phone → rate-limit → Twilio Verify SMS → pending cookie),
   `verifyCustomerOtpAction` (check OTP → `getOrCreateCustomerByVerifiedPhone` → `setCustomerSession`),
   `joinRewardsAction` (require terms → call the one RPC). Each step transition is a full server redirect.

3. **First stamp** — `joinRewardsAction` calls `join_customer_membership_with_first_stamp`, which in one
   transaction creates the membership, optionally attributes a referral, and (if a QR is present) issues
   the first stamp via `issue_self_service_stamp`. Success → `redirect(/card/{id}?welcome=1&stamp=issued)`.

### 2.2 The trust model (important)

Customers **never hold a Supabase Auth JWT**. Identity is entirely an HMAC-signed cookie plus a
server-side `customer_sessions` row, and every DB write goes through `createSupabaseServiceRoleClient()`
(`lib/supabase/server.ts:60-73`), which bypasses RLS. So the real authorization boundary for a join is
**the app session cookie**, not Postgres RLS/`auth.uid()` — the DEFINER functions detect the service role
via `is_service_role_request()` (`…20260613220000…:2-14`) and skip their `auth.uid()` ownership checks.
`p_customer_id` is taken from the session (`getCurrentCustomer` → `getCustomerSession().customerId`,
`lib/customer/identity.ts:34-42`), never from form input. This is a deliberate, coherent design; its
consequence is that anything which can forge or replay the session cookie can act as that customer, and
the DB-side ownership checks are inert on the happy path.

---

## 3. The UX state machine (experience derivation)

The UX is a two-layer design: impure **loaders** (`lib/customer/experience/load-*.ts`) fetch facts; a
pure **`derive.ts`** turns facts into a 13-variant discriminated union `CustomerExperience`
(`types.ts:108-236`); `copy.ts` phrases it; `priorities.ts` resolves ambiguity by a per-entry priority
list. `assertNever` enforces exhaustiveness.

`deriveJoin` (`derive.ts:423-503`) is the core: it collapses `{unavailable}` first, otherwise builds a
candidate list (`membership`→`join_returning`; `hasSession`→`join_terms`; `pendingOtp`→`join_otp`; then
welcome **xor** phone by `qrId && step!=="phone"`), and picks the highest-priority present variant
(`JOIN_PRIORITY = unavailable > join_returning > join_terms > join_otp > join_phone > join_welcome`).
Each concrete case has a defensive fallback to `join_phone`.

The wizard is presented as **3 steps** (`ONBOARDING_STEPS=3`): 1 welcome, 2 phone+code (shared), 3 terms.
It is stateless — every transition is a server round-trip that re-runs `loadJoinExperienceContext`
(which re-resolves the QR and re-loads the customer). See §8 for the redundancy cost.

_(A complete entry-point table, all 13 experience kinds with producing conditions, the full redirect
edge-list, and the query-param contract were captured during the audit and are available on request; the
material is large and mostly reference. The findings distilled from it are in §7.)_

---

## 4. The data & transaction layer

### 4.1 The RPC call graph (live definitions)

```
join_customer_membership_with_first_stamp(8-arg)      …20260712100000…:180   [DEFINER]
├─ join_customer_membership(5-arg)                    …20260707095000…:473   [DEFINER]  → customer_memberships, consent_records, product_events
├─ INSERT referrals   (iff created_membership && p_ref)   wrapper :218-234
│    ├─ BEFORE INSERT referrals_denormalize()   …20260710170000…:98
│    └─ AFTER  INSERT referrals_emit_attributed() …20260710190000…:96 → enqueue_notification_event
└─ issue_self_service_stamp(8-arg QR wrapper)         …20260712100000…:975   [DEFINER]
     ├─ drain_due_referrer_bonuses_for_membership()   …20260712100000…:857
     │    └─ settle_referral_bonus(edge)  (FOR UPDATE SKIP LOCKED loop)  …:570
     ├─ issue_self_service_stamp(7-arg visit primitive) …20260626090000…:513 [DEFINER]  → stamp_events, customer_memberships, reward_events, product_events, audit_logs, fraud_flags
     └─ award_referrer_bonus_stamp()                  …20260712100000…:931
```

Tables touched during one join+first-stamp: `customers`, `merchants`, `loyalty_cards`,
`billing_customers`, `merchant_locations`, `qr_codes` (all SELECT); `customer_memberships`, `referrals`,
`stamp_events`, `reward_events`, `consent_records`, `product_events`, `audit_logs`, `fraud_flags`,
`notification_events` (writes); plus the rate-limit bucket table.

### 4.2 Transaction & idempotency

One PostgREST call = **one transaction**; each `BEGIN…EXCEPTION` block is a savepoint. Membership insert
is `ON CONFLICT (merchant_id, customer_id) DO NOTHING` + re-select, so it is **idempotent** — a
re-submit returns `created_membership=false`, which gates both the referral insert and the first-stamp
block. Under real concurrency two racing scans serialize on the membership row lock and the
`(membership, location, business_date)` partial-unique + `unique_violation` catch guarantee one earned
stamp per UK business day (verified by `tests/db/architecture-moat.test.mjs:23`).

Two subtleties worth knowing:

- **Consent is not gated on `created_membership`** — every re-submit with the marketing box ticked
  appends another `consent_records` row (append-only ledger, no dedupe) (`…20260707095000…:606-625`).
- **The `v_drained>0` early return** (`…20260712100000…:1044-1068`): if a pre-stamp referral drain
  completes the scanner's own card, the wrapper returns the bonus result and _skips the visit stamp
  entirely_. This is load-bearing and correct — calling the visit primitive would raise "reward already
  ready" and roll the just-awarded bonus back. Without it, the regular scan path would _permanently
  wedge_ (award-then-raise every scan). Do not "simplify" this away.

### 4.3 First-stamp failure taxonomy

`issue_self_service_stamp` can raise 16 distinct ways (QR-proof missing/invalid, membership ownership,
rate limit 10/15min, billing/merchant inactive, "reward already ready", "stamp already issued today",
"≥3 active pool items required", pool-emptied race, …). **All 16 are swallowed** by the wrapper's
`when others` into a `raise warning` + `first_stamp_issued=false` (`…20260712100000…:249-257`). This is
correct for UX (a blocked first stamp must never fail the join) but is the root of finding #3 — see §6.

Errors from `join_customer_membership` itself (loyalty-card unavailable, billing, identity) are **not**
swallowed and fail the whole join → the app shows the generic "Rewards could not be joined" and logs
nothing.

### 4.4 The referral migration deploy hazard

The app calls the RPC with a **conditional arg set** — `ref ? {...joinArgs, p_ref} : joinArgs`
(`actions.ts:275-285`) — so PostgREST resolves the function by argument-name set. A no-ref join (5 named
args) resolves against either the current 8-arg function or the historical prod one; a **ref join** (6
named args incl. `p_ref`) requires a function _with_ a `p_ref` parameter. Per session memory the six
referral migrations are **implemented but not yet pushed to prod**. Consequence: the moment any `?ref=`
link is shared before the DB is migrated, those specific joins 500 with `PGRST202` while ordinary joins
look healthy — a silent, referral-only outage invisible to a smoke test that doesn't exercise a ref link.
The migrations must land as a **contiguous set** (the wrapper's predicates depend on `referral_code_active`
and `referral_code_admin_disabled_at` columns from different migrations).

---

## 5. Security & abuse (detail)

### 5.1 Finding 1 — SMS-pumping / toll-fraud (HIGH)

`requestCustomerIdentityAction` sends a Twilio Verify SMS gated **only** by two buckets, _both keyed by
the phone number_ (`otp-rate-limit-core.ts:9-18`, limit 5/15min), and it sends **before** any merchant/QR
validation (`actions.ts:88-117`). Because the phone is in both keys, **rotating the number yields a fresh
bucket every time** — there is no per-IP/per-session cap on the number of _distinct_ phones one client
can enumerate. Amplified by **no country allowlist**: `supportedCountries = getCountries()`
(`phone.ts:21`) accepts every dialing region for a UK-only product. Net: a single scripted IP can send
5 SMS each to unlimited attacker-controlled premium/international numbers → direct, unbounded Twilio spend
(artificially-inflated-traffic revenue share) and victim SMS-bombing. The wallet-login action
(`app/home/actions.ts:48-108`) is a second scriptable send surface. Only backstop today is Twilio Fraud
Guard. **Fix:** country allowlist (GB + small set), a per-identity/day ceiling on _distinct phones_, bot
mitigation (Turnstile) on send, and configure Twilio geo-permissions.

### 5.2 Finding 2 — privilege-containment regression (MEDIUM, but a real red test) — verified firsthand

`…20260711090000_rpc_execute_privilege_containment…` deliberately revokes EXECUTE from
public/anon/authenticated on every function and re-grants a verified allowlist (admin_* + merchant-config
RPCs). Both `join_customer_membership_with_first_stamp` (`…20260712100000…:264-266`) and the 8-arg
`issue_self_service_stamp` (`:1104-1106`) are re-granted to `authenticated` **and are not on the
allowlist**. The exhaustive test `tests/db/rpc-execute-privilege-containment.test.mjs:124-142`
("authenticated can execute only the allowlist") collects every off-allowlist grant into
`unexpectedlyGranted` and asserts it empty — so it is **red against the current migration set**. Per
memory, PR #100 (referral v2) merged as an admin squash with `[skip ci]`, which is exactly why this
wasn't caught.

Reachable impact today is limited (not a cross-tenant write): only merchants/admins hold `authenticated`
JWTs, and the inner primitives fall back to an `auth.uid() = customers.auth_user_id` check for non-service
callers — every phone customer has `auth_user_id = NULL`, so that branch always raises. The **residual**
exposure is real but narrow: the 8-arg stamp wrapper runs the referral settle-drain _before_ the inner
ownership check (`…20260712100000…:1037-1088`), so an authenticated caller who knows a membership UUID +
customer UUID + a poster's public join `qr_id` can trigger out-of-band referral settlement side-effects
for someone else's membership (no value theft — bonuses go to the rightful referrer) and gets a
`(membership, customer)` validity oracle from the distinct error messages. **Fix:** `revoke execute … from
authenticated` on both wrappers; add them to the test's `MUST_BE_LOCKED` set; re-run `test:db`.

### 5.3 Finding 4 — rate-limit identity (MEDIUM)

`rateLimitIdentityFromHeaders = sha256(trustedClientIp + ":" + userAgent).slice(0,32)`
(`rate-limit-core.ts:3-11`). A pub full of customers behind one NAT egress IP on near-identical iOS
Safari UAs collapses to **one identity**, sharing the 60-scans/min-per-QR bucket (`join.ts:93-99`) and the
OTP identity buckets — on a busy launch night legitimate customers can hit `RateLimitedQr`. Meanwhile an
attacker flips the UA string (and, per finding 1, the phone) to mint a fresh identity per request, so the
identity dimension barely constrains abuse. It penalizes the honest crowd and waves through the attacker.

### 5.4 Finding 5 — recycled phone → takeover (MEDIUM)

`getOrCreateCustomerByVerifiedPhone` matches solely on `phone_hmac` (`identity.ts:55-114`). When a telco
reassigns a number, the new holder passes OTP and inherits the previous owner's `customers` row —
memberships, unlocked rewards, `full_name`/`date_of_birth`/`email`. No dormancy or re-validation. Inherent
to phone-first identity, but a real GDPR/privacy exposure; mitigate with a re-verify on dormant numbers or
before high-value redemption.

### 5.5 Findings 6 & 8 — data minimization & cookie PII (LOW-MED / LOW)

Identity + a 30-day session are created at OTP-verify, before terms/consent (`actions.ts:207-212`); a
terms-abandoner leaves stored phone PII + a live session with no membership and no consent, reclaimed only
by `admin_purge_stale_customer_pii` after **365 days**. Separately, the **loyalty-terms checkbox is
validated client-side and never sent to the DB** (`actions.ts:255-257`), and `p_policy_version` is
persisted only inside `consent_records` and only on marketing opt-in — so there is **no durable record
that a member accepted a given loyalty-terms version on join**. If terms-acceptance provenance is a
compliance requirement, that is a gap. The 10-minute pending-phone cookie holds the **plaintext E.164**
(signed, not encrypted, `session.ts:49-64`); `secure` is production-only (`:247-254`).

### 5.6 Verified strengths (do **not** re-flag)

- `/card/[membershipId]` IDOR is properly guarded — `getCustomerCardState` returns `unauthorized` on
  `customer_id` mismatch (`lib/customer/card.ts:118-120`); both card and stamp loaders early-return on any
  non-`ready` status, leaking nothing.
- Rate limiter **fails closed** — only `/rate limit exceeded/` maps to the soft error; any other backend
  failure re-throws and aborts the request before any OTP send/verify (`rate-limit.ts:74-80`).
- OTP verify brute-force infeasible — 5/15min/phone × Twilio's own caps ≪ 10⁶ space; the `/^\d{4,8}$/`
  shape check doesn't weaken prod (Twilio is the arbiter, issues 6-digit codes).
- Session hygiene — secret required (throws if unset, no insecure default), fresh server-registered
  `sessionId` per login (no fixation), server-side revocation despite the 30-day TTL; compromise of the
  secret alone can't mint sessions (the `customer_sessions` row is the second factor).
- Phone encrypted at rest (AES-256-GCM + HMAC), reads masked to `phone_last4`; **no PII in logs or URLs**
  (query strings carry only `qr`/`ref`/`membership`).

---

## 6. Observability & the analytics critical-path (corrected)

An earlier quick take claimed the join actions add "up to ~4–6 s of telemetry" on the tap-critical path.
The deeper trace **corrects that**, and the real picture is more nuanced:

- `capturePostHogEvent` does **only** a PostHog `fetch`, and **returns immediately unless**
  `ANALYTICS_EXTERNAL_PROCESSING_MODE === "pseudonymous"` (`lib/analytics/events.ts:122-160`), which
  **defaults off**. The `product_events` insert lives in `recordProductEvent`, not here.
- The join **funnel taps** (`join_page_viewed`, `join_phone_requested`, `join_otp_verified`,
  `join_terms_accepted`, `customer_card_viewed`) call `captureJoinFunnelEvent` → `await
  capturePostHogEvent` — i.e. **PostHog-only, no DB write**.

So there are two regimes, and each has a distinct problem:

- **Default config (pseudonymous mode off):** the awaited calls are ~0 ms no-ops → negligible latency,
  **but the entire intermediate funnel is recorded _nowhere_.** Only the DB-persisted milestones
  (`qr_scanned` via `recordProductEvent`; `customer_joined`/`stamp_issued` written by the RPC) survive.
  The scan→join drop-off is effectively unmeasurable.
- **Pseudonymous mode on:** each awaited call is a `fetch` capped by `AbortSignal.timeout(2_000)`
  (`events.ts:154`), sequential and additive — up to ~2 s on the phone tap (before the SMS) and ~6 s on
  the terms tap. This _does_ contradict the flow's own discipline: the scan path deliberately defers
  `qr_scanned` with `after()` (`join.ts:132-138`), but the tap actions await inline.

Independently, the **Twilio send `fetch` has no timeout** (`verification.ts:55`), so the phone tap can
hang unbounded regardless of analytics config.

**The bigger observability gap** is finding #3: the swallowed first-stamp failure emits only a Postgres
`raise warning` (Supabase logs, not the Vercel drain), returns no reason code, and produces no app-side
`logger` call and no `product_event`. There is **no Sentry, no OTel, no metrics, no alerting** anywhere in
the stack (`instrumentation.ts:6-9` confirms these are just an unused seam). The only dashboard is the
manual `/admin/pilot` view, whose `stamp_issued` count aggregates all sources (onboarding + returning +
referral bonus), so a first-stamp-specific regression is _diluted_ and un-alerted. **A systematic
first-stamp regression would be invisible to every app-side signal, and no test at any tier exercises the
swallow path.**

### Test coverage snapshot

- **DB (`test:db`):** 54 files / 258 cases (60 referral). Strong on the happy path, idempotent re-join,
  no-double-stamp-under-concurrency, pool guard, soft geofence, billing fail-closed, referral settlement.
  **Gap:** `first_stamp_issued` is only ever asserted `=== true`; the swallowed-failure path is untested;
  stamp ownership is never negatively tested; rate-limit block behavior is untested.
- **E2E (Playwright, mobile-safari only for plain specs):** covers QR routing, happy-path join+stamp,
  wrong-OTP, terms-required, no-QR direct join, scan rate-limit. **Gap:** OTP send/verify rate-limit,
  geo-flagged, `firststamp=pending`, and the returning-member post-OTP auto-stamp are **not** e2e-covered;
  Twilio failure is structurally unhittable under the dev-OTP harness.
- **Unit:** 90 files / 478 cases. **Critical gaps:** `lib/customer/phone.ts` (the phone-entry step) has
  **zero** coverage; `deriveJoin` — the join decision core — has **no** unit test; `availability.ts` has
  no behavioral test.

---

## 7. UX correctness bugs & dead code (routing/state layer)

Real bugs worth fixing:

- **Unencoded `qrId` in the returning CTA** — `copy.ts:120` builds `` `/card/${mid}/stamp?qr=${exp.qrId}` ``
  with no `encodeURIComponent`, unlike every other builder. `qr` is raw user input echoed from the URL, so
  an `&`/`#` corrupts the target.
- **`?blocked=` is an unvalidated copy slot** — any ≤240-char string renders verbatim as the reason line
  on a first-party authenticated screen (`load-stamp.ts:63-76,279-284`). React escaping prevents XSS, but
  attacker-composed sentences ("Call 07… to unblock your card") display as if first-party. A typed
  allowlist already exists (`block-reasons.ts:54-83`) yet this param bypasses it.
- **Held-reward mislabeled "stamped today"** — when an unlocked-but-not-yet-redeemable reward exists,
  `load-stamp.ts:95-108` forces `alreadyStampedToday:true` even if no stamp was earned today (card
  completed yesterday, scanned again today) → the customer sees "You're stamped for today / come back
  tomorrow" when the true state is "reward pending collection."
- **Join-time geofence silently unimplemented** — `load-join.ts:63-69` comments that the real geofence is
  "resolved only on the terms branch," but every branch returns the hard-coded `{requireGeofence:false}`
  default, and `CustomerJoinForm` never reads the prop. The onboarding first stamp is never
  location-captured, even for geofence-required venues. (Server-side enforcement in the RPC is unaffected.)

Dead code / dead params (harmless but noise): `membership=existing` is write-only (read nowhere);
`geo=flagged` on `/card` is parsed and threaded but never rendered; `join_otp.location` is a dead prop
(`void location`); the welcome step's two CTAs resolve to the _same_ URL; `reward_waiting` is unreachable
from the stamp entry; and the referral `ref` is dropped by every welcome/back navigation (currently
harmless because referral links carry no `qr`, so they skip the welcome step).

---

## 8. Performance / friction

- **Every wizard step is a full server round-trip** that re-runs `loadJoinExperienceContext` (which
  re-resolves the QR via a `qr_codes` join and re-loads the customer). `/q/[qrId]` itself is 3 serial DB
  round-trips with `force-dynamic` and no caching of the near-immutable QR→merchant mapping.
- **OTP-verify does redundant work for new members** — `verifyCustomerOtpAction` always calls
  `destinationForReturningQrVisit` (`actions.ts:222`), which for a brand-new customer re-resolves the QR
  and does a membership lookup guaranteed to return `null`, then falls through to a redirect that reloads
  and re-resolves the QR a third time to reach `join_terms`. The QR is resolved 2–3× per verify on the
  happy path.
- Realistic scan-to-first-stamp for a new member is ~45–90 s on pub 3G/4G, dominated by these serial
  round-trips + the SMS wait.

---

## 9. Deliberate trade-offs (do not "fix" without a decision)

- **Static, non-expiring QR** as the sole presence proof, with an **opt-in, annotate-only** soft
  geofence (evaluated only on cycle stamp #3, never blocks) — explicitly accepted as a frictionless
  trade-off in `reports/architecture-audit/findings.md:103-105`. Compensating controls that _do_ bind:
  one-stamp-per-UK-day-per-location unique constraint, 10/15min self-stamp limit, ≥20-stamps/15min
  velocity flag.
- **OTP as the identity moat** (no app, no password, no email) — the fix direction is fallback channels
  and fewer round-trips _around_ it, not weakening it.
- **First-stamp-never-fails-the-join** — correct; the fix is a discriminating error taxonomy +
  observability (finding #3), not removing the guard.
- **Service-role trust model** — the app session is the boundary by design (§2.2).
- **Dev OTP bypass** (`any-4-digits`, dev code) gated by `NODE_ENV !== "production"` — robust in practice;
  recommend a belt-and-braces refusal when `VERCEL_ENV ∈ {production, preview}`.

---

## 10. Prioritized recommendations

1. **Revert the privilege-grant regression** (finding #2) — `revoke execute … from authenticated` on both
   wrappers, add them to `MUST_BE_LOCKED`, run `test:db` to confirm green. Cheapest, most concrete, and it
   restores a documented contract that is currently silently violated. _(First verify the test is red by
   running `pnpm test:db` against a live local DB.)_
2. **Close the OTP-send abuse economics** (finding #1) — country allowlist + per-identity distinct-phone
   ceiling + bot mitigation on send + Twilio geo-permissions.
3. **Make first-stamp failures observable** (finding #3) — return a reason code from the RPC (or emit a
   `product_event`/structured `logger.warn` in `joinRewardsAction` on `firstStampIssued=false && qrId`),
   add a DB test for the swallow path, and add a `join → first-stamp` conversion metric to the pilot view.
4. **Defer analytics with `after()` and add a Twilio send timeout** (finding #7) — match the scan path's
   discipline; decide whether the intermediate funnel should be DB-persisted so it survives with
   pseudonymous mode off.
5. **Harden rate-limit identity** (finding #4) — add a per-device cookie nonce to the identity, or make the
   scan limit venue-aware, so a shared-IP venue isn't self-throttled.
6. **Fix the UX correctness bugs** (§7) — encode `qrId`, route `?blocked=` through the existing typed
   allowlist, correct the held-reward label, and either implement or delete the join-time geofence plumbing.

---

### Appendix — key files

Routing/state: `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/join/{page,actions}.ts`,
`app/card/[membershipId]/stamp/page.tsx`, `lib/customer/returning-qr-redirect.ts`,
`lib/customer/experience/{derive,load-join,load-stamp,load-card,priorities,types,copy}.ts`,
`components/customer/join-wizard.tsx`.
Data: `supabase/migrations/20260712100000_referral_review_hardening.sql`,
`…20260626090000_require_merchant_billing.sql`, `…20260707095000_phone_plaintext_retirement.sql`,
`…20260711090000_rpc_execute_privilege_containment.sql`.
Security/identity: `lib/customer/{verification,phone,identity,session,otp-rate-limit}.ts`,
`lib/security/rate-limit{,-core}.ts`, `lib/supabase/server.ts`.
Observability/tests: `lib/analytics/events.ts`, `lib/customer/join-funnel.ts`, `instrumentation.ts`,
`lib/admin/pilot-report.ts`, `tests/db/`, `tests/e2e/customer-join-*live-db.spec.ts`.

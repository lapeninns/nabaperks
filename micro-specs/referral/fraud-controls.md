---
spec_id: MS-referral-fraud-controls
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710220000_referral_fraud_controls.sql
  - tests/db/referral-fraud-controls.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710220000_referral_fraud_controls.sql
  - tests/db/referral-fraud-controls.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/state-machine.md
  - micro-specs/referral/settlement.md
  - micro-specs/referral/code-controls.md
related_tests:
  - tests/db/referral-fraud-controls.test.mjs
  - tests/e2e/customer-referral-attribution.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "referral attribution" --project=mobile-safari
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Live-DB output proving that when a referrer's qualified-referral concentration crosses the threshold in a rolling 24h window, the newest qualifying referral is paused (status rejected, reason recorded) and a deduped `referral_concentration` fraud flag is raised, so no bonus is awarded for the paused referral while the friend's own stamp is untouched.
  - Live-DB output proving admin_review_referral clears a paused referral (back to qualified, flags dismissed, re-settleable) or rejects/cancels it, and admin_disable_referral_code deactivates a membership's code + flags it, both internal-admin-only and audit-logged, and both raising for a non-admin caller.
  - Playwright (mobile-safari) output proving the customer referral attribution journey still completes (secondary; fraud controls are proven at the DB tier).
approved_exceptions: []
---

# MS-referral-fraud-controls — Concentration pause, admin review, and code disablement

## 1. Exact Goal and User-Visible Outcomes

The referral engine gains fraud controls that **pause or review** a suspicious bonus
rather than clawing back a legitimate customer's stamps. When one referrer racks up
an abnormal concentration of qualified referrals in a short window — the signature of
referral farming — the **excess** qualifying referrals are paused for review and a
`referral_concentration` fraud flag is raised for support; the referrer's genuine
early referrals and everyone's own visit stamps are untouched.

Support can then **review** any referral — clear it (letting a legitimate high
referrer's bonus settle), or reject/cancel it — and can **disable a referral code**
outright when it is being abused. Every support action is internal-admin-only and
audit-logged.

This complements the controls the model already has: the per-referrer **daily bonus
cap** (2/UK-business-day) already bounds the financial exposure of any single day, and
the **unique phone identity** already makes classic self-referral (one person, two
accounts, one phone) impossible at the database level.

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260710220000_referral_fraud_controls.sql`:
  - `flag_referral_concentration(p_referral_id)` — counts a referrer's qualified /
    held / awarded referrals in a rolling 24h window; past the threshold it raises a
    deduped `referral_concentration` flag and pauses the newest referral
    (`status='rejected'`, reason recorded), unless an admin has already dismissed the
    referrer's concentration flag today;
  - a trigger on `referrals` (status → `qualified`) that runs the check, fail-safe;
  - `admin_review_referral(p_referral_id, p_action, p_reason)` — internal-admin-only,
    `clear` / `reject` / `cancel`, audit-logged (clear un-pauses + dismisses the
    referral's open referral flags);
  - `admin_disable_referral_code(p_membership_id, p_reason)` — internal-admin-only,
    deactivates the code (reusing `referral_code_active`) + raises a
    `referral_code_disabled` flag, audit-logged.
- `tests/db/referral-fraud-controls.test.mjs`.

Out of scope (explicitly noted — not built here):

- **Device / network / IP clustering** and **recycled-phone-across-erasure**: the
  schema captures no device, IP, user-agent, or fingerprint on join/stamp, and
  `phone_hmac` is uniquely indexed (and nulled on erasure), so these signals cannot
  be built without new capture columns — a deliberate future scope, called out here
  so the gap is explicit.
- Wiring the review / disable RPCs into the `/admin/referrals` console UI — the RPCs
  are provided and DB-proven; the console (MS-referral-ops-visibility) can consume
  them next.
- Clawing back already-awarded stamps — fraud controls only pause/reject
  *unsettled* referrals; a customer's earned stamps are never reversed.

## 3. Strict Constraints and Assumptions

- **Pause, never claw back.** Controls act only on non-terminal referrals (setting
  `status='rejected'`), which the settlement terminal guard already refuses to award.
  No stamp or reward is ever reversed.
- **Concentration is windowed and thresholded.** The check counts a referrer's
  qualified/held/awarded referrals in the last 24h; only past the threshold is the
  newest referral paused, so ordinary referrers are unaffected.
- **Admin review is authoritative and respected.** Once an admin dismisses a
  referrer's concentration flag (via clear), the trigger stops re-pausing that
  referrer's referrals that day, so a cleared legitimate high-referrer is not
  re-blocked.
- **Everything is service-authoritative + audited.** Detection is a `SECURITY
  DEFINER` trigger; the review/disable RPCs raise `insufficient_privilege` unless
  `is_internal_admin()` and write `audit_logs`, mirroring `admin_resolve_fraud_flag`.
- **Recursion-safe + fail-safe.** The trigger fires only on the `→ qualified`
  transition and its own `→ rejected` write does not re-enter; the body is wrapped so
  a detection failure never blocks qualification.
- **Free-text signal.** `fraud_flags.signal` has no CHECK, so `referral_concentration`
  and `referral_code_disabled` need no schema change.

## 4. Decisions Already Made

- **Concentration over self-referral.** Shared-phone self-referral is already
  impossible (unique `phone_hmac`); the buildable, meaningful signal here is
  concentration/velocity of qualified referrals per referrer.
- **Threshold = 5 qualified referrals / rolling 24h.** Above the daily bonus cap of 2,
  so a farmer is caught while a normal referrer (a handful of friends over time) is
  not; the 6th+ within the window is paused.
- **Pause = `rejected`, reversible by review.** Reusing the terminal `rejected` state
  keeps settlement unchanged; `admin_review_referral clear` returns it to `qualified`.
- **Manual disablement reuses `referral_code_active`** from
  [`MS-referral-code-controls`](code-controls.md) — an admin turns a code off.

## 5. Behavioral Requirements (EARS)

- **FC-1 (concentration pause):** WHEN a referrer's qualified/held/awarded referrals
  in a rolling 24h window exceed the threshold, THE system SHALL pause the newest
  qualifying referral (`status='rejected'`, reason recorded) so its bonus is not
  awarded.
- **FC-2 (concentration flag):** WHEN concentration is detected, THE system SHALL
  raise exactly one `referral_concentration` fraud flag per referrer per business day.
- **FC-3 (no claw-back):** THE fraud controls SHALL only pause unsettled referrals and
  SHALL NOT reverse any already-awarded stamp or the friend's own visit stamp.
- **FC-4 (below threshold untouched):** WHILE a referrer is at or below the threshold,
  THE system SHALL NOT pause or flag their referrals.
- **FC-5 (admin review):** WHEN an internal admin reviews a referral with `clear`, THE
  system SHALL return it to `qualified`, dismiss its open referral fraud flags, and
  make it re-settleable; `reject` / `cancel` SHALL set the terminal state.
- **FC-6 (review respected):** WHILE a referrer's concentration flag is dismissed for
  the day, THE system SHALL NOT re-pause that referrer's newly qualifying referrals.
- **FC-7 (code disablement):** WHEN an internal admin disables a referral code, THE
  system SHALL deactivate it and raise a `referral_code_disabled` flag, and the code
  SHALL thereafter attribute nothing.
- **FC-8 (admin-only + audited):** IF a non-admin calls `admin_review_referral` or
  `admin_disable_referral_code`, THEN THE system SHALL raise `insufficient_privilege`;
  each successful admin action SHALL write an `audit_logs` row.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions with a seeded internal-admin context):

- Seeding a referrer at the threshold of recent qualified referrals and qualifying one
  more pauses that newest referral (`rejected`) and raises one
  `referral_concentration` flag; settlement awards it no bonus while a below-threshold
  referrer's referral qualifies and settles normally (FC-1/FC-2/FC-3/FC-4).
- `admin_review_referral clear` returns a paused referral to `qualified` and dismisses
  its flags (and a subsequent qualify does not re-pause it); `reject`/`cancel` set the
  terminal state; a non-admin call raises; an `audit_logs` row is written
  (FC-5/FC-6/FC-8).
- `admin_disable_referral_code` deactivates the code + raises a
  `referral_code_disabled` flag; a `?ref` join with the disabled code attributes
  nothing; a non-admin call raises (FC-7/FC-8).

Browser tier (mobile-safari, secondary): the attribution journey still completes
(`tests/e2e/customer-referral-attribution.spec.ts`).

Source scan (`pnpm test`): detection is a definer trigger; the admin RPCs are
`is_internal_admin`-guarded and audit-logged.

Task breakdown (test-first per `Instructions_tdd.md`):

1. Migration: `flag_referral_concentration` + trigger; `admin_review_referral`;
   `admin_disable_referral_code`.
2. DB tests red → green across FC-1…FC-8.

Prove the work with `governance:run-gates --spec MS-referral-fraud-controls --record`
and advance the lifecycle with `governance:advance`.

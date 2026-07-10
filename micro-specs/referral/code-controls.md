---
spec_id: MS-referral-code-controls
status: active
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260710210000_referral_code_controls.sql
  - lib/customer/referral-share.ts
  - components/customer/referral-share-panel.tsx
  - tests/db/referral-code-controls.test.mjs
implementation_surfaces:
  - supabase/migrations/20260710210000_referral_code_controls.sql
  - lib/customer/referral-share.ts
  - components/customer/referral-share-panel.tsx
  - tests/db/referral-code-controls.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/attribution.md
  - micro-specs/referral/state-machine.md
related_tests:
  - tests/db/referral-code-controls.test.mjs
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
  - Live-DB output proving a member can rotate their referral code (a fresh unique code replaces the old, `referral_code_rotated_at` set, code re-activated) and that the OLD code then attributes nothing while the NEW code attributes normally, with enrolment never blocked.
  - Live-DB output proving a deactivated referral code attributes nothing (join still succeeds), reactivation restores attribution, and that rotate / set-active raise for a caller who does not own the membership.
  - Playwright (mobile-safari) output proving the referral attribution journey still completes and the share panel exposes a reset/pause control.
approved_exceptions: []
---

# MS-referral-code-controls — Rotatable and deactivatable referral codes

## 1. Exact Goal and User-Visible Outcomes

A member can **reset** their invite link (rotate the code) — useful if it leaked or
was over-shared — and **pause** it (deactivate) so it stops enrolling anyone, then
resume it later. After a reset the old link attributes nothing and a fresh
high-entropy link takes over; while paused, following the link still lets a friend
join the venue but records no referral. These controls live on the existing "Bring a
Regular" share panel.

Crucially, a rotated or paused code **never blocks a friend's enrolment**: attribution
simply resolves only *active* codes, so a stale or paused `?ref` records no edge and
the join proceeds exactly as an unknown code does today (per
[`MS-referral-attribution`](attribution.md)).

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260710210000_referral_code_controls.sql`:
  - `customer_memberships.referral_code_active boolean not null default true` and
    `referral_code_rotated_at timestamptz` (backfill: existing codes stay active);
  - a `create or replace` of `join_customer_membership_with_first_stamp` that adds
    `and rm.referral_code_active` to the `?ref` resolution join (the only change);
  - `rotate_membership_referral_code(p_membership_id uuid) returns text` and
    `set_membership_referral_code_active(p_membership_id uuid, p_active boolean)`,
    both owner-guarded (`is_customer_owner` OR service-role).
- `lib/customer/referral-share.ts` — `rotateReferralCode` / `setReferralCodeActive`
  server actions (verify ownership, call the RPC, revalidate), mirroring
  `recordReferralShare`.
- `components/customer/referral-share-panel.tsx` — a small "Reset link" / "Pause
  invites" control row.
- `tests/db/referral-code-controls.test.mjs`.

Out of scope (explicitly not touched):

- The attribution write logic, the state machine, settlement, outbox, or ops view.
- The code generator `generate_membership_referral_code()` (reused as-is) and the
  `customer_memberships.referral_code` NOT NULL + UNIQUE contract (preserved).
- A merchant-side code control — this spec is the per-membership customer control;
  merchant-initiated disablement is a fraud action handled in
  [`MS-referral-fraud-controls`](fraud-controls.md).

## 3. Strict Constraints and Assumptions

- **Codes stay NOT NULL + UNIQUE.** Deactivation is a boolean flag, never a NULL or
  empty code, so the existing unique index and generator contract are untouched.
  Rotation writes a freshly generated unique code.
- **Deactivation ≠ blocking the join.** The resolution join gains one predicate
  (`referral_code_active`); an inactive code falls out of the join and records no
  edge, exactly like an unknown code — the friend still enrols (core invariant #6).
- **Owner-scoped mutation.** `rotate_membership_referral_code` and
  `set_membership_referral_code_active` raise `insufficient_privilege` unless the
  caller owns the membership (or is service-role); they are `SECURITY DEFINER`,
  granted to authenticated + service_role.
- **Codes are identifiers, not secrets.** Rotation is a convenience/hygiene action,
  not a security boundary; nothing depends on a code being unguessable.
- **Server actions verify ownership app-side too** (defence-in-depth) before calling
  the RPC via the service-role client, mirroring `recordReferralShare`.

## 4. Decisions Already Made

- **Per-membership control.** Codes are per-card, so rotation/deactivation is per
  membership; there is no global customer-wide code.
- **Rotation reactivates.** Resetting a paused link both rotates and re-activates it,
  since the member is choosing to share a fresh link.
- **Old codes are dropped, not retained.** After rotation the previous code is gone
  (overwritten); there is no grace window for in-flight old links — matching the
  "reset because it leaked" intent.
- **Backfill = active.** Every existing membership is `referral_code_active = true`.

## 5. Behavioral Requirements (EARS)

- **CC-1 (control columns):** THE `customer_memberships` row SHALL carry
  `referral_code_active` (default true) and `referral_code_rotated_at`.
- **CC-2 (resolution honours active):** WHEN attribution resolves a `?ref` code, THE
  system SHALL match only an `active` code; an inactive code SHALL record no edge and
  SHALL NOT block enrolment.
- **CC-3 (rotate):** WHEN a member rotates their code, THE system SHALL replace it
  with a fresh unique code, set `referral_code_rotated_at`, and activate it, so the
  old code attributes nothing and the new code attributes normally.
- **CC-4 (deactivate/reactivate):** WHEN a member deactivates their code, THE system
  SHALL stop it attributing; reactivating SHALL restore attribution.
- **CC-5 (owner-only):** IF a caller who does not own the membership attempts to
  rotate or set-active, THEN THE system SHALL raise `insufficient_privilege`.
- **CC-6 (uniqueness preserved):** THE rotated code SHALL remain unique and non-null.
- **CC-7 (backfill):** THE migration SHALL default every existing membership to
  `referral_code_active = true`.
- **CC-8 (surfaced):** THE member SHALL be able to reset and pause their invite link
  from the share panel.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions):

- Rotating a membership's code changes `referral_code` (unique, non-null), sets
  `referral_code_rotated_at`, and activates it; a friend joining with the OLD code is
  not attributed while a friend joining with the NEW code is (CC-3/CC-6/CC-2).
- Deactivating a code makes a `?ref` join record no edge yet still create the
  membership; reactivating restores attribution (CC-2/CC-4).
- A non-owner call to rotate / set-active raises; the owner (or service-role)
  succeeds (CC-5).
- Existing memberships read `referral_code_active = true` after the migration (CC-7).

Browser tier (mobile-safari, secondary): the attribution journey still completes and
the share panel shows a reset/pause control (CC-8).

Source scan (`pnpm test`): the server actions verify membership ownership before
mutating; the RPCs are owner-guarded.

Task breakdown (test-first per `Instructions_tdd.md`):

1. Migration: columns + backfill; join-wrapper `referral_code_active` predicate;
   `rotate_membership_referral_code` + `set_membership_referral_code_active` (owner
   guards).
2. DB tests red → green across CC-1…CC-7.
3. Server actions + share-panel reset/pause control.

Prove the work with `governance:run-gates --spec MS-referral-code-controls --record`
and advance the lifecycle with `governance:advance`.

---
spec_id: MS-referral-attribution
status: active
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260708090000_referral_attribution.sql
  - app/m/**
  - components/customer/join-forms.tsx
  - components/customer/join-wizard.tsx
  - components/customer/join-otp-form.tsx
  - lib/customer/**
  - tests/db/**
  - tests/e2e/**
  - tests/micro-specs/referral-attribution.test.mjs
  - tests/micro-specs/customer-error-boundaries.test.mjs
implementation_surfaces:
  - supabase/migrations/20260708090000_referral_attribution.sql
  - app/m/[merchantSlug]/join/page.tsx
  - app/m/[merchantSlug]/join/actions.ts
  - components/customer/join-forms.tsx
  - components/customer/join-wizard.tsx
  - components/customer/join-otp-form.tsx
  - tests/db/referral-attribution.test.mjs
  - tests/micro-specs/referral-attribution.test.mjs
  - tests/micro-specs/customer-error-boundaries.test.mjs
  - tests/e2e/customer-referral-attribution.spec.ts
  - tests/e2e/helpers/customer-join-live-db.ts
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/customer/join.md
  - micro-specs/customer/card-stamp.md
related_tests:
  - tests/e2e/customer-referral-attribution.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Live-DB output proving a valid cross-customer, same-merchant `ref` writes exactly one referrals row in the enrolment transaction, while self / cross-venue / unknown / re-join cases write none and the join still succeeds.
  - Live-DB output proving RLS confines referral edges to the owning memberships and that `p_ref` is backward-compatible (omitting it reproduces today's enrolment outcome byte-for-byte).
  - Playwright output proving a `ref` value supplied on the join URL survives all three wizard steps through to attribution.
approved_exceptions: []
---

# MS-referral-attribution — Referral attribution: per-membership share code + `?ref` capture at join

## 1. Exact Goal and User-Visible Outcomes

When a new customer completes the join wizard for a venue after arriving on a
link that carries a valid referral code (`/m/[merchantSlug]/join?ref=<code>`),
the system durably records that their new membership was **referred by** the
membership that owns that code — provided the two are different people holding
cards at the **same** venue. Every membership is minted a stable, opaque
referral code it can share.

This spec lands **only the attribution rails**. There is no reward and no
share-button UI yet — those belong to the sibling spec `MS-referral-bonus-stamp`
(the "Bring a Regular" reward). The sole observable change here is that a
referred join becomes *attributable*: an ordinary join — no `?ref`, or an
invalid / self / cross-venue / duplicate code — behaves **exactly** as it does
today, including the first stamp, consent capture, and returned outcome flags.

## 2. Blast Radius

In scope (may be edited):

- A new migration `supabase/migrations/20260708090000_referral_attribution.sql`:
  the `referrals` attribution table with its RLS policies; a unique
  `customer_memberships.referral_code` column with a backfill for existing rows;
  and a backward-compatible extension of the existing security-definer RPC
  `join_customer_membership_with_first_stamp` to mint the new membership's code,
  accept an optional `p_ref`, apply the guards, and insert the attribution edge.
- `?ref` threading only: `app/m/[merchantSlug]/join/page.tsx` (read the query
  value), `components/customer/join-wizard.tsx`,
  `components/customer/join-forms.tsx`, and
  `components/customer/join-otp-form.tsx` (carry it as a hidden input across the
  three steps, mirroring `qrId`), and `app/m/[merchantSlug]/join/actions.ts`
  (recover it in the three actions, preserve it on the inter-step redirects, and
  pass `p_ref` to the RPC). Because the redirects now carry an optional `&ref=`,
  the phone-step redirect pin in
  `tests/micro-specs/customer-error-boundaries.test.mjs` is widened to still
  guard the `qr` encoding while allowing the `ref` suffix.
- `lib/customer/referral.ts` for code validation/format helpers if needed.
- The three test tiers under `tests/db/**`, `tests/e2e/**`, and
  `tests/micro-specs/referral-attribution.test.mjs`.

Out of scope (explicitly not touched by this spec):

- Reward issuance / bonus stamps, the share CTA, and the value-moment placement
  — owned by `MS-referral-bonus-stamp`.
- The pretty `/r/<code>` short link (deferred UI); the existing `app/r` route.
- Analytics enrichment of the join event, velocity caps, and `fraud_flags`
  writes — deferred to the reward spec where they carry weight.
- Any change to the stamp mechanic (one-per-UK-day guard, geofence), phone OTP,
  consent capture, or `pending_reward_invites`.

## 3. Strict Constraints and Assumptions

- **Server-authoritative, atomic.** Attribution is written **only** inside
  `join_customer_membership_with_first_stamp` (SECURITY DEFINER), in the same
  transaction as membership creation. The `ref` value from the browser is an
  untrusted hint resolved server-side; no client writes attribution.
- **Backward-compatible RPC.** `p_ref` is optional (defaults to null). Existing
  callers and the returned row shape are unchanged when it is absent (preserves
  `MS-customer-join` J-6/J-7).
- **Opaque codes, no UUID leak.** Referral codes reuse the `qr_codes.qr_id`
  generation convention (base64url of random bytes, `[a-z0-9_-]`, collision
  retry). The raw membership UUID is never placed in a shareable URL.
- **Membership-scoped codes.** A code belongs to one `(customer, merchant)`
  card and only attributes a join at that **same** merchant.
- **RLS confinement.** A `referrals` row links two memberships (two people). RLS
  policies must prevent a customer from reading referral edges that are not their
  own; writes happen through the definer RPC only.
- **Assumption:** phone-HMAC dedup already collapses one person to one
  `customers` row, so self-referral is detectable by comparing `customer_id`.
- **Assumption:** "a genuinely new regular" == the RPC returns
  `created_membership = true`; a returning customer (`created_membership = false`)
  is never attributed.

## 4. Decisions Already Made

- **Share-a-link model (owner-confirmed).** The friend enters only their own
  details through the normal consented join; the venue never handles the
  friend's contact. This sidesteps the PECR gap in the `pending_reward_invites`
  path.
- **Storage shape.** The attribution edge lives in a dedicated `referrals` table
  (`referred_membership_id` UNIQUE, `referrer_membership_id`,
  `referral_code_used`, `created_at`); the shareable code lives on
  `customer_memberships.referral_code` (UNIQUE). Rationale:
  `MS-referral-bonus-stamp` hangs reward status / idempotency off the referrals
  row without re-touching `customer_memberships`.
- **Entry surface.** `?ref=<code>` on the existing join route. The `/r/<code>`
  short link is deferred.
- **Silent-skip semantics.** When `ref` is missing, unknown, cross-venue, self,
  or the join is a re-join, the join succeeds normally and simply records no
  attribution — no error is surfaced to the friend.
- **At most one referrer per membership.** `referred_membership_id` is UNIQUE;
  first valid code wins, later codes never overwrite.
- **Risk class `rls-rpc-ledger`** — schema + a security-definer RPC on the join
  ledger, requiring both real-Postgres and browser proof. It graduates the
  `auth-session` join spec because it adds schema + an RLS-protected relation.

## 5. Behavioral Requirements (EARS)

- **RA-1 (code minted + backfilled):** WHEN a membership is created, THE system
  SHALL assign it a unique opaque `referral_code`, and every membership that
  existed before this migration SHALL be backfilled with one.
- **RA-2 (ref carried through wizard):** WHILE a customer moves through the
  phone → OTP → terms steps after arriving with a `ref` query value, THE join
  wizard SHALL carry that value unchanged to `joinRewardsAction`.
- **RA-3 (attribution written):** WHEN a verified customer completes the join and
  a NEW membership is created at a merchant, and the supplied `ref` resolves to a
  **different** customer's membership at that **same** merchant, THE system SHALL
  insert exactly one `referrals` row linking the new (referred) membership to the
  code's (referrer) membership, in the same transaction as enrolment.
- **RA-4 (self-referral skipped):** IF the supplied `ref` resolves to a
  membership whose customer is the joining customer, THEN THE system SHALL create
  the membership normally and SHALL NOT record any attribution.
- **RA-5 (cross-venue skipped):** IF the supplied `ref` resolves to a membership
  at a different merchant than the one being joined, THEN THE system SHALL NOT
  record any attribution.
- **RA-6 (unknown code ignored):** IF the supplied `ref` matches no
  `referral_code`, THEN THE join SHALL succeed unchanged with no attribution and
  no error.
- **RA-7 (returning customer skipped):** IF the join does not create a new
  membership (`created_membership = false`), THEN THE system SHALL NOT record any
  attribution regardless of `ref`.
- **RA-8 (single referrer):** THE system SHALL record at most one referrer per
  membership; a second attribution attempt against an already-referred membership
  SHALL NOT overwrite the first.
- **RA-9 (no-ref parity):** WHEN a customer joins without a `ref` value, THE
  enrolment, first stamp, consent record, and returned outcome flags SHALL be
  identical to today's behavior.
- **RA-10 (RLS confinement):** THE `referrals` table SHALL be readable only for
  memberships the caller owns; a customer SHALL NOT read referral edges belonging
  to other customers.
- **RA-11 (backward-compatible RPC):** THE `p_ref` argument SHALL be optional;
  callers that omit it SHALL observe unchanged behavior and an unchanged return
  shape.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- **Live-DB (real Postgres, rolled-back transactions)** — drive the extended
  `join_customer_membership_with_first_stamp`: a valid cross-customer,
  same-merchant `ref` writes exactly one `referrals` row (RA-3); a self `ref`
  writes none (RA-4); a cross-venue `ref` writes none (RA-5); an unknown code
  writes none and the join still creates the membership + first stamp (RA-6); a
  re-join returns `created_membership = false` and writes none (RA-7); a second
  `ref` on an already-referred membership does not overwrite (RA-8); a no-ref
  join reproduces today's `membership_id / created_membership / first_stamp_issued
  / new_stamp_count / reward_unlocked / geo_flagged` outcome (RA-9, RA-11); every
  membership carries a code and the backfill covers pre-existing rows (RA-1); RLS
  denies a customer reading another customer's referral edge (RA-10).
- **Playwright (mobile-safari + chromium)** — visiting
  `/m/[merchantSlug]/join?ref=<code>` and completing the dev-OTP wizard yields
  attribution, proving `ref` survives all three steps (RA-2).
- **Micro-spec source scan** — attribution is written inside the security-definer
  RPC transaction (not a client action), and shared links carry the opaque code,
  never the membership UUID.

Task breakdown (implement one at a time, test-first):

1. Migration: `referrals` table + RLS policies; `customer_memberships.referral_code`
   (unique) + backfill; a code-minting SQL helper reusing the `qr_codes.qr_id`
   generator.
2. Extend the join RPC with optional `p_ref`: mint the new membership's code,
   resolve `ref`, apply the self / cross-venue / duplicate / returning-customer
   guards, insert the `referrals` row on success.
3. Thread `ref`: read the query value in `join/page.tsx`; carry it through
   `join-wizard.tsx` → `join-forms.tsx` hidden inputs (all three steps); recover
   it in the three actions in `join/actions.ts`; pass `p_ref` to the RPC.
4. `lib/customer/referral.ts`: code validation/format helpers as the wiring needs.
5. Tests red → green across `tests/db/referral-attribution.test.mjs`,
   `tests/micro-specs/referral-attribution.test.mjs`, and
   `tests/e2e/customer-referral-attribution.spec.ts`.

Prove the work with `governance:run-gates --spec MS-referral-attribution --record`
and advance the lifecycle with `governance:advance`.

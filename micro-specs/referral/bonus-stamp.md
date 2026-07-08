---
spec_id: MS-referral-bonus-stamp
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/referral/**
  - supabase/migrations/20260709090000_referral_bonus_stamp.sql
  - lib/customer/**
  - lib/notifications/**
  - lib/analytics/**
  - components/customer/**
  - app/card/**
  - app/home/**
  - app/api/cron/**
  - tests/db/**
  - tests/e2e/**
  - tests/micro-specs/referral-bonus-stamp.test.mjs
implementation_surfaces:
  - supabase/migrations/20260709090000_referral_bonus_stamp.sql
  - lib/customer/referral.ts
  - lib/customer/card.ts
  - lib/customer/experience/load-card.ts
  - components/customer/customer-card-experience.tsx
  - components/customer/home-card-tile.tsx
  - lib/notifications/catalog.ts
  - lib/analytics/events.ts
  - app/api/cron/referral-bonus-drain/route.ts
  - tests/db/referral-bonus-stamp.test.mjs
  - tests/e2e/customer-referral-bonus-stamp.spec.ts
  - tests/micro-specs/referral-bonus-stamp.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/referral/attribution.md
  - micro-specs/customer/card-stamp.md
  - micro-specs/customer/join.md
  - DESIGN.md
related_tests:
  - tests/db/referral-bonus-stamp.test.mjs
  - tests/e2e/customer-referral-bonus-stamp.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --grep "referral bonus" --project=mobile-safari
required_playwright_projects:
  - mobile-safari
evidence_required:
  - Live-DB output proving a referred membership's FIRST earned stamp issues exactly one referrer bonus stamp (event_type='earned', source='referral_bonus', earned_business_date NULL) that advances the referrer's cycle and unlocks the referrer's reward when it completes the card, while a stamp with no referral edge, an already-awarded edge, and a self/cross-venue edge each issue none — and the friend's own stamp count, guards, and returned outcome flags are byte-for-byte unchanged.
  - Live-DB output proving the bonus bypasses the one-per-UK-day guard (a referrer who already earned a stamp today still receives the bonus) and that a full-card referrer is recorded as `due` (owed, not dropped) and is paid by `drain_due_referrer_bonuses()` once the card has room.
  - Live-DB output proving a `referral_bonus_stamp_issued` notification_events row and a `referral_bonus_awarded` product_events row are written in the award transaction, deduped one-per-edge, and that a bonus failure degrades to no-bonus without rolling back the friend's stamp.
  - Playwright (mobile-safari) output proving a referrer can discover and invoke share (copy / Web Share) from their card carrying `?ref=<their referral_code>`, with the opaque code in the URL and never the membership UUID.
approved_exceptions: []
---

# MS-referral-bonus-stamp — Bring a Regular: referrer bonus stamp on a referred friend's first visit

## 1. Exact Goal and User-Visible Outcomes

A member can find and share their own venue join link from their loyalty card
(and their home dashboard) without hand-building a URL. When a friend follows
that link, completes the consented join, and later **collects their first
in-venue stamp**, two things happen at that moment: the friend has their normal
first stamp, and the **referrer receives exactly one bonus stamp** on their card
for that venue — "Bring a Regular: you both get a stamp." The bonus advances the
referrer's cycle like any earned stamp and can complete their card and unlock a
reward. If the referrer's card is full when the bonus falls due, the bonus is
**owed, not lost**: it is paid automatically once their card has room. The
referrer is notified that someone they invited visited, without being shown the
friend's personal details.

This spec builds directly on the live attribution rails
([`micro-specs/referral/attribution.md`](attribution.md)): per-membership
`referral_code`, the `referrals` edge table, and `?ref` capture already exist.
This spec adds the **reward** and the **share surface** that attribution
deferred to it by name. Ordinary stamping, joining, and redemption for members
with no referral edge are unchanged.

## 2. Blast Radius

In scope (may be edited):

- A new migration
  `supabase/migrations/20260709090000_referral_bonus_stamp.sql`: idempotency /
  state columns on `referrals`; a `SECURITY DEFINER`, service-role-only
  `award_referrer_bonus_stamp(p_referred_membership_id, p_source_stamp_event_id)`
  primitive; a `create or replace` of the **QR-gated** `issue_self_service_stamp`
  overload (which both the standalone stamp and the join first-stamp route
  through) that appends one fail-safe call to the primitive; a
  `drain_due_referrer_bonuses()` sweep; and registration of the new
  `referral_bonus_stamp_issued` notification event category in SQL.
- `lib/customer/referral.ts` — `buildReferralJoinUrl(merchantSlug, code)` and
  code-format helpers (reuse `absoluteUrl` / `NEXT_PUBLIC_APP_URL`).
- Exposing `referral_code` through the card read path: `lib/customer/card.ts`,
  `lib/customer/experience/load-card.ts` (+ `experience/derive.ts` view-model),
  and the home dashboard loader / `HomeCard` type.
- Customer UI: a new share panel component under `components/customer/`, wired
  into `components/customer/customer-card-experience.tsx` (collecting state) and
  `components/customer/home-card-tile.tsx` (home tile).
- `lib/notifications/catalog.ts` — add `referral_bonus_stamp_issued`
  (transactional category) to `notificationEventTypes`.
- `lib/analytics/events.ts` — add `referral_link_shared` and
  `referral_bonus_awarded` product-event names.
- `app/api/cron/referral-bonus-drain/route.ts` — a `CRON_SECRET`-gated route
  that invokes `drain_due_referrer_bonuses()` (mirroring the existing sweeps).
- The three test tiers: `tests/db/referral-bonus-stamp.test.mjs`,
  `tests/e2e/customer-referral-bonus-stamp.spec.ts`, and
  `tests/micro-specs/referral-bonus-stamp.test.mjs`.

Out of scope (explicitly not touched):

- The `?ref` join threading and attribution write — owned by
  `MS-referral-attribution`; this spec reads `referrals`/`referral_code`, it does
  not change how edges are created.
- The friend's own stamp mechanic — one-per-UK-day, geofence, billing, and the
  "reward already ready" block (owned by `MS-customer-card-stamp`) are unchanged;
  the bonus hook is additive and must not alter the friend's outcome.
- The redemption RPCs (`redeem_reward_with_staff_pin`,
  `redeem_self_service_reward`, owned by `MS-customer-redeem`) — the full-card
  bonus is drained by the cron sweep, not by a redemption-path hook.
- The `/r/<code>` pretty short link; merchant-facing referral reporting;
  cash/discount rewards; per-venue configurable bonus rules;
  `MS-customer-quiet-day-bonus-stamp`.

## 3. Strict Constraints and Assumptions

- **Server-authoritative ledger.** The bonus is written only inside a
  `SECURITY DEFINER` RPC, in the same transaction as the friend's triggering
  stamp; the browser never issues stamps or referrals. `award_referrer_bonus_stamp`
  is granted to `service_role` only and is not customer-callable.
- **Bonus stamp shape.** A bonus is a `stamp_events` row with
  `event_type='earned'`, `stamps_delta=1`, `metadata.source='referral_bonus'`,
  and `earned_business_date = NULL`. `event_type` stays within the existing
  `check ('earned','reversed','manual_adjustment')`; the NULL business date is
  what lets the bonus advance the cycle while remaining exempt from the partial
  unique index `stamp_events_one_earned_per_business_day_idx (… where
  event_type='earned' and earned_business_date is not null)`. No new
  `event_type`, no schema change to `stamp_events`.
- **Fail-safe hook.** The call to `award_referrer_bonus_stamp` from inside the
  QR-gated `issue_self_service_stamp` is wrapped in a nested `begin … exception
  when others then raise warning … end`, mirroring the join wrapper's first-stamp
  handling: a bonus failure degrades to _no bonus + warning_ and never rolls back
  or blocks the friend's stamp.
- **Backward-compatible redefinition.** The QR-gated `issue_self_service_stamp`
  overload `(uuid, uuid, text, numeric, numeric, numeric, text, integer)` is
  re-created carrying its current body verbatim (from
  `20260626090000_require_merchant_billing.sql`) — it captures the inner ledger's
  result instead of streaming it — plus the one appended hook; its signature,
  return shape, and the inner ledger overload are unchanged.
- **Notifications.** Enqueue is SQL-side via the existing
  `enqueue_notification_event` function in the award transaction, categorised
  transactional (needs a push subscription, not marketing consent), deduped
  `referral_bonus:<edge id>`; the new type is also added to the TS catalog. The
  notification reveals no friend PII.
- **Design.** Share UI uses Wet Ink (`DESIGN.md`) and existing components; no new
  dependencies. British copy.
- **Assumptions.** `referrals` rows exist only for genuinely new memberships
  (`created_membership=true`), so a referred membership has zero earned stamps
  when its edge is created; its first earned stamp is therefore its true first
  in-venue visit. Same-merchant and non-self are already guaranteed by the
  attribution edge and need not be re-checked for the bonus target.

## 4. Decisions Already Made

- The friend receives only their normal first earned stamp; the _referrer_
  receives the bonus. Both "get a stamp"; only the referrer's is a bonus.
- The trigger hook lives inside the inner `issue_self_service_stamp` (covers both
  the QR-join first stamp and a later standalone visit), same transaction.
- Idempotency/state on `referrals` is timestamp-derived: `referrer_bonus_due_at`
  (owed), `referrer_bonus_awarded_at` (paid), `referrer_stamp_event_id`.
  Drainable = `due_at is not null and awarded_at is null`. At most one bonus per
  edge, ever.
- Full-card behaviour is **hold-and-drain**: if the referrer has no room the
  bonus is recorded `due` and paid by `drain_due_referrer_bonuses()` when room
  frees; it is never silently dropped or forfeited.
- The bonus bypasses the one-per-UK-day cap (NULL business date) and the
  geofence (a bonus is not a location visit); it respects the referrer's cycle
  size (never pushes a card past `stamps_required`).
- A per-referrer daily cap issues at most two referral bonuses per UK business
  day; excess bonuses are banked `due` and record a `fraud_flags` row
  (`signal='referral_bonus_velocity'`) rather than auto-issuing beyond the
  configured daily rate.
- Share surface is the card collecting state plus a home-dashboard tile;
  mechanics are Web Share API with a copy-link fallback over the full
  `…/join?ref=<code>` URL. The `/r/<code>` short link is deferred.
- Notifications are delivered via the durable notification ledger; analytics via
  `product_events`.

## 5. Behavioral Requirements (EARS)

- **RB-1 (bonus on first stamp):** WHEN a referred membership (one with a
  `referrals` edge) earns its first `earned` stamp, THE system SHALL issue
  exactly one bonus stamp to the referrer's membership in the same transaction.
- **RB-2 (bonus shape / cap bypass):** THE referrer bonus SHALL be an
  `event_type='earned'`, `stamps_delta=1` stamp with `source='referral_bonus'`
  and `earned_business_date = NULL`, so it advances the referrer's cycle while
  remaining exempt from the one-per-UK-business-day guard.
- **RB-3 (one per edge):** THE system SHALL award at most one referrer bonus per
  `referrals` edge; a repeated trigger SHALL NOT issue a second bonus.
- **RB-4 (bonus unlocks reward):** WHEN a bonus stamp completes the referrer's
  card, THE system SHALL unlock a reward for the referrer exactly as a normal
  completing stamp would.
- **RB-5 (full-card hold):** IF the referrer's card is full when the bonus falls
  due, THEN THE system SHALL record the bonus `due` and SHALL NOT drop it or push
  the card beyond `stamps_required`.
- **RB-6 (drain when room frees):** WHEN `drain_due_referrer_bonuses()` runs and a
  referrer with a `due` bonus has room, THE system SHALL issue the owed bonus
  stamp and mark the edge awarded.
- **RB-7 (friend path fail-safe):** THE friend's own stamp count, guards, cycle,
  and returned outcome flags SHALL be unchanged by this spec, and any failure in
  the bonus path SHALL degrade to no bonus without rolling back or blocking the
  friend's stamp.
- **RB-8 (notify referrer, no PII):** WHEN a bonus is awarded, THE system SHALL
  enqueue exactly one durable `referral_bonus_stamp_issued` (transactional)
  notification to the referrer, deduped per edge, exposing no friend personal
  data.
- **RB-9 (shareable link):** THE customer SHALL be able to discover and share
  their per-membership referral link from their card and home dashboard without
  constructing a URL, and the shared link SHALL carry the opaque `referral_code`,
  never the membership UUID.
- **RB-10 (daily bank cap):** IF awarding a bonus would exceed two referral
  bonuses for the referrer on the current UK business day, THEN THE system SHALL
  hold the bonus `due` and record one `fraud_flags` row
  (`referral_bonus_velocity`) instead of issuing it.
- **RB-11 (analytics):** WHEN a share action is invoked THE system SHALL record a
  `referral_link_shared` product event, and WHEN a bonus is awarded THE system
  SHALL record a `referral_bonus_awarded` product event.
- **RB-12 (target safety):** THE bonus SHALL only ever target the referrer named
  by the `referrals` edge (same merchant, never the friend), inheriting the
  attribution guards; no bonus SHALL be issued where no edge exists.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify (DB tier is primary; live Postgres, rolled-back
transactions):

- A referred friend's first earned stamp writes exactly one `referral_bonus`
  earned stamp (NULL business date) on the same-merchant referrer, increments the
  referrer's `current_stamp_count`, and leaves the friend's outcome unchanged
  (RB-1/RB-2/RB-7).
- A friend with no edge, an already-awarded edge, and a second trigger each write
  no bonus (RB-3/RB-12).
- A bonus completing the referrer's card unlocks the referrer's reward (RB-4).
- A referrer who already earned a stamp today still receives the bonus (cap
  bypass, RB-2).
- A full-card referrer is recorded `due` with no stamp; after room frees,
  `drain_due_referrer_bonuses()` pays it and marks it awarded (RB-5/RB-6).
- One `referral_bonus_stamp_issued` notification_events row and one
  `referral_bonus_awarded` product_events row per edge in the award transaction
  (RB-8/RB-11); forcing a bonus error still commits the friend's stamp (RB-7).
- Over-cap awarding after two referral bonuses in the current UK business day
  holds `due` and writes a `referral_bonus_velocity` fraud flag (RB-10).

Browser tier (mobile-safari, secondary journey proof): a referrer viewing their
card can reach the share panel and invoke copy / Web Share for a link resolving
to `/m/<merchantSlug>/join?ref=<referral_code>` (RB-9).

Source scan (`pnpm test`): the bonus is written only inside the definer RPC (no
client write), `award_referrer_bonus_stamp` is service-role-only, and shared
links carry the opaque code, never a UUID.

Task breakdown (implement one at a time, test-first per `Instructions_tdd.md`):

1. Migration: `referrals` state columns + partial index; `award_referrer_bonus_stamp`
   (idempotency guard, room check, velocity cap, grant+advance+unlock mirroring
   `issue_stamp_with_staff_pin`, SQL-side notification enqueue, edge update);
   inner `issue_self_service_stamp` `create or replace` + fail-safe hook;
   `drain_due_referrer_bonuses()`; SQL notification-category registration.
2. DB tests red → green across RB-1…RB-8, RB-10, RB-12.
3. `lib/customer/referral.ts` + expose `referral_code` through the card and home
   read paths.
4. Share panel component wired into the card (collecting) and home tile; share
   analytics (RB-9/RB-11 share side).
5. Notification catalog type; cron drain route.
6. e2e (mobile-safari) for the share journey; micro-spec source-scan test.

Prove the work with `governance:run-gates --spec MS-referral-bonus-stamp --record`
and advance the lifecycle with `governance:advance`.

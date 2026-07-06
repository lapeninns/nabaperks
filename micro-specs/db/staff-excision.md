---
spec_id: MS-db-staff-excision
status: implemented
risk_class: rls-rpc-ledger
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/db/**
  - supabase/migrations/20260707092000_staff_subsystem_excision.sql
  - supabase/migrations/20260606175000_merchant_staff_pin_settings.sql
  - supabase/migrations/20260607110000_staff_pin_reveal_ciphertext.sql
  - supabase/migrations/20260609120000_daily_staff_pin_rotation.sql
  - supabase/migrations/20260613130000_remove_shared_pin_surfaces.sql
  - lib/merchant/staff-members.ts
  - supabase/seed.sql
  - tests/db/staff-excision.test.mjs
  - tests/micro-specs/db-staff-excision.test.mjs
implementation_surfaces:
  - supabase/migrations/20260707092000_staff_subsystem_excision.sql
  - supabase/migrations/20260606175000_merchant_staff_pin_settings.sql
  - supabase/migrations/20260607110000_staff_pin_reveal_ciphertext.sql
  - supabase/migrations/20260609120000_daily_staff_pin_rotation.sql
  - supabase/migrations/20260613130000_remove_shared_pin_surfaces.sql
  - lib/merchant/staff-members.ts
  - supabase/seed.sql
  - tests/db/staff-excision.test.mjs
  - tests/micro-specs/db-staff-excision.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/db/architecture-moat.test.mjs
  - tests/db/customer-join.test.mjs
  - tests/e2e/governance-smoke.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@governance"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Schema readback on a migrated disposable database showing staff_users, add_staff_member, set_staff_member_active, and is_staff_for_merchant absent.
  - pnpm test:db output proving owner and admin access to qr_codes and reward_pool_items is unchanged after the policy rewrite and other-tenant access stays denied.
approved_exceptions: []
---

# MS-db-staff-excision — Excise the unreachable staff subsystem

## 1. Exact Goal and User-Visible Outcomes

The dead staff subsystem is fully excised. Per the 2026-07-06 audit and the
owner decision of the same date: `staff_users` (including `pin_hash`), the
`add_staff_member` and `set_staff_member_active` RPCs, and the
`is_staff_for_merchant` RLS helper are reachable from nothing —
`lib/merchant/staff-members.ts` has zero importers, and no route or page
touches any of it. The prior architecture audit already flagged ~700 lines of
dead staff-PIN SQL; this removes the remaining live-but-unreachable perimeter.
When this ships there is no staff table, no staff RPCs, no staff arm in RLS
policies, and no orphan lib module. Nothing user-visible changes; merchants
and admins keep exactly the access they have today. Git history preserves the
implementation; if staff logins become a real feature it gets rebuilt from a
fresh spec.

## 2. Blast Radius

May edit: `supabase/migrations/20260707092000_staff_subsystem_excision.sql`
(new), `lib/merchant/staff-members.ts` (delete), `supabase/seed.sql` (remove
the staff_users insert at ~line 299), `tests/db/staff-excision.test.mjs`
(new), `tests/micro-specs/db-staff-excision.test.mjs` (new), and this spec's
folder.

Out of scope: the `'staff'` values in `audit_logs.actor_type` and
`product_events.actor_type` CHECK constraints (historical rows may carry
them; enums are history-bearing — keep); historical audit_logs rows written
by `add_staff_member` (append-only ledger — keep); customer-facing product
copy that says "show this to staff" or similar (unrelated to the subsystem);
`qr_codes`/`reward_pool_items` access for owners, admins, and customers (must
be preserved exactly); every other RLS policy.

## 3. Strict Constraints and Assumptions

- Implementation-time correction (live pg_policy scan, 2026-07-06): the audit
  undercounted — `is_staff_for_merchant` is referenced by NINE SELECT
  policies, not two. Besides the two `_staff_`-named ones, the staff arm also
  sits inside `merchants_select_owned_or_admin`,
  `merchant_locations_select_scoped`, `loyalty_cards_select_scoped`,
  `customer_memberships_select_scoped`, `stamp_events_select_scoped`,
  `reward_events_select_scoped`, and `audit_logs_select_scoped`. All nine are
  recreated byte-equivalent minus that arm (the two `_staff_` names become
  `_owner_admin`); no function, trigger, or other object references the
  helper (pg_proc scan clean).
- Replay contract: the four historical staff-PIN migrations
  (20260606175000, 20260607110000, 20260609120000, 20260613130000) carried
  top-level `alter table public.staff_users` statements that break full-chain
  replays once the table is dropped (the initial migration is skipped on
  replays and never re-creates it). Each gains a `to_regclass` DO-block guard;
  function-body references stay untouched (lazily parsed, replaced later in
  the chain). Prod is unaffected (db push applies only new migrations).
- Policy rewrite must be drop-and-recreate with the staff arm removed and
  every other predicate byte-for-byte equivalent; renaming the policies to
  drop the `_staff_` token is allowed and preferred
  (e.g. `qr_codes_select_owner_admin`).
- Migration order inside one idempotent file: recreate the two policies →
  drop the two staff RPCs → drop `is_staff_for_merchant` → drop `staff_users`.
- `staff_users` has FK references from nothing (verified — no table
  references it), so the table drop is standalone.
- The GLOBAL_CONTEXT line about staff scoping becomes vestigial but
  GLOBAL_CONTEXT edits are out of scope here; do not touch it.

## 4. Decisions Already Made

- Excise, don't build (owner decision 2026-07-06). No feature-flag limbo, no
  "keep the table just in case".
- The seed's staff row goes; no replacement fixture is needed because nothing
  tests staff behavior.
- `tests/db/architecture-moat.test.mjs` is cited as the RLS-shape anchor; if
  it asserts the old staff policy names, updating those assertions is in
  scope for the new DB suite to supersede — but verify first and amend the
  radius if that file itself must change.

## 5. Behavioral Requirements (EARS)

- THE public schema SHALL NOT contain the `staff_users` table nor the
  functions `add_staff_member`, `set_staff_member_active`, or
  `is_staff_for_merchant`.
- THE repository SHALL NOT contain `lib/merchant/staff-members.ts`.
- WHEN a merchant owner queries their `qr_codes` or `reward_pool_items`
  rows, THE database SHALL return them exactly as before this change.
- WHEN an internal admin queries those tables, THE database SHALL return
  them exactly as before this change.
- IF an authenticated user who is neither the owning merchant nor an admin
  (nor, where the existing policies grant it, a member customer) queries
  those tables, THEN THE database SHALL continue to return no rows.
- THE `actor_type` CHECK constraints on `audit_logs` and `product_events`
  SHALL be unchanged.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify (live DB):

- Schema readback proves table + three functions absent and the rewritten
  policies present under their new names.
- RLS parity: owner sees own qr_codes/reward_pool_items; admin sees them;
  a different merchant's authenticated user sees none — asserted both before
  (against current policies, as the failing-red baseline shape) and after.
- Seed runs green without the staff insert.
- Migration replay is idempotent; `pnpm build` proves no TypeScript import
  breaks from the lib deletion.

Task order: (1) failing DB tests (absence + RLS parity); (2) migration in the
stated order; (3) delete the lib module + prune seed; (4) green;
(5) `pnpm governance:run-gates --spec MS-db-staff-excision --record` and
advance with `governance:advance`.

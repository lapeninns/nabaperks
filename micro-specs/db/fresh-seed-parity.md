---
spec_id: MS-db-fresh-seed-parity
status: active
risk_class: docs-tooling
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/db/**
  - tests/db/customer-card-stamp.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/reward-redemption-edges.test.mjs
  - tests/db/reward-scan-single-use.test.mjs
  - tests/db/customer-join.test.mjs
  - tests/db/customer-consent.test.mjs
  - tests/db/referral-attribution.test.mjs
  - tests/db/referral-bonus-stamp.test.mjs
  - tests/db/staff-excision.test.mjs
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
  - reports/stress-test-2026-07-07.md
  - supabase/seed-announcement-audience.sql
  - supabase/seed-user-aman-plus32.sql
implementation_surfaces:
  - tests/db/customer-card-stamp.test.mjs
  - tests/db/customer-profile.test.mjs
  - tests/db/reward-redemption-edges.test.mjs
  - tests/db/reward-scan-single-use.test.mjs
  - tests/db/customer-join.test.mjs
  - tests/db/customer-consent.test.mjs
  - tests/db/referral-attribution.test.mjs
  - tests/db/referral-bonus-stamp.test.mjs
  - tests/db/staff-excision.test.mjs
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/fresh-db-seed-parity.test.mjs
  - tests/db/customer-card-stamp.test.mjs
  - tests/db/staff-excision.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - pnpm test:db green in the fresh-database simulation (requires_billing=true on both seed merchants) AND in the grandfathered state (requires_billing=false).
approved_exceptions:
  - "evidence-waiver: unrelated seed/stress WIP rides the working tree; program commits stay scoped to this spec's radius (expires: 2026-07-21)"
---

# MS-db-fresh-seed-parity — tests/db pass on a fresh database: picker vocabulary + owner derivation

## 1. Exact Goal and User-Visible Outcomes

`pnpm test:db` is green on ANY seeded database — a fresh `supabase db reset`,
a new machine, a fresh CI runner — not only on long-lived local databases.
Today ~10 tests pass by accident of history: the two seed merchants were
grandfathered to `requires_billing = false` by
`supabase/migrations/20260626090000_require_merchant_billing.sql`, but a
fresh database seeds them AFTER that migration (column default `true`), and
four test pickers gate billing eligibility on
`bc.status in ('trial', 'active')` — the **merchants**-status vocabulary —
while the committed seed and Stripe write `'trialing'` into
`billing_customers.status`. The product itself
(`loyalty_availability_reason`) blocks billing only for
`('cancelled', 'suspended')` or NULL-when-required, so `'trialing'` is
billing-OK. When this ships, every db-test billing picker mirrors the
product rule, the staff-excision test derives merchant owners from the
database instead of hardcoding seed UUIDs, and a tripwire test keeps the
wrong vocabulary from returning.

## 2. Blast Radius

May touch: the nine `tests/db/*.test.mjs` files listed in the frontmatter
(four with the broken `('trial','active')` billing predicate, four with the
tolerant-but-inconsistent `('trial','trialing','active')` variant, plus
`staff-excision.test.mjs` for owner derivation), one new tripwire test
`tests/micro-specs/fresh-db-seed-parity.test.mjs`, and this spec under
`micro-specs/db/**`.

Tree-parity note: `reports/stress-test-2026-07-07.md`,
`supabase/seed-announcement-audience.sql`, and
`supabase/seed-user-aman-plus32.sql` are listed in `allowed_blast_radius`
ONLY so the docs-tooling floor's `pnpm governance:check` can pass while
unrelated WIP rides the working tree — this spec does not modify them, and
they leave the radius when the spec closes.

Explicitly out of scope: `supabase/seed.sql` (its `'trialing'` billing row
is CORRECT — Stripe vocabulary; the pickers were wrong);
`supabase/migrations/**` (the `requires_billing` default and the
grandfathering backfill are deliberate product decisions);
`lib/**` and `app/**` (no product code);
`tests/e2e/customer-referral-bonus-stamp.spec.ts` (already fresh-safe with
`'trialing'`; normalizing it would drag the browser tier into a
fixture-vocabulary spec).

## 3. Strict Constraints and Assumptions

- The canonical billing-eligibility clause for test pickers mirrors the
  product rule in `loyalty_availability_reason` exactly:
  `bc.status is not null and bc.status not in ('cancelled', 'suspended')`.
  Do not enumerate accepted statuses — enumeration is how this bug
  happened; the blocked-set mirror stays correct when Stripe adds statuses.
- Fixed tests must pass in BOTH database states: grandfathered
  (`requires_billing = false`, today's long-lived local DBs) and fresh
  (`requires_billing = true` with the seeded `'trialing'` billing row).
- The staff-excision test keeps proving the same invariants (owner sees own
  tenant, foreign owner sees nothing, admin path works) — deriving
  OWNER_A/OWNER_B from `merchants.owner_user_id` changes WHO is asserted,
  not WHAT is asserted. The ADMIN constant stays hardcoded (the
  internal-admins seed id is stable and not merchant-scoped).
- No assertion may be weakened: pickers select fixtures; the behavioral
  assertions that follow them stay untouched.
- No product code, schema, or seed changes; no new dependencies.

## 4. Decisions Already Made

- Fix option chosen from the intake: align pickers with the product rule
  (option b). Options (a) — force `requires_billing=false` in seed.sql —
  and (c) — change the seeded billing status — were rejected: they would
  make the demo merchants LESS like production (a paying venue with a
  `trialing` Stripe subscription) to satisfy a wrong test predicate.
- All nine db files converge on the one canonical clause above, including
  the five files that already tolerated `'trialing'` — a single greppable
  shape is what makes the tripwire enforceable.
- Owner derivation in `staff-excision.test.mjs`: inside the existing
  rolled-back transaction, read
  `owner_user_id` for `10000000-…-0001` (Old Crown Girton) and
  `10000000-…-0002` (Bubble Yard) and use those in place of the hardcoded
  OWNER_A/OWNER_B — this also survives the uncommitted `+32` fixture seed
  reassigning Old Crown's owner.
- The tripwire test is source-contract style (repo idiom in
  `tests/micro-specs/`): (i) no `tests/db/**` file may contain the
  billing-vocabulary bug marker `bc.status in ('trial'`; (ii) every file
  that gates on `billing_customers` eligibility must carry the canonical
  blocked-set clause; (iii) `supabase/seed.sql` must not seed a blocked
  billing status; (iv) `staff-excision.test.mjs` must not hardcode the
  Old Crown owner UUID.
- Fresh-database proof runs as evidence, not as a checked-in mutation:
  set `requires_billing = true` on both seed merchants, run `pnpm test:db`,
  restore `false` — both runs recorded in the ledger acknowledgement.

## 5. Behavioral Requirements (EARS)

- WHEN `pnpm test:db` runs against a freshly reset-and-seeded database (seed merchants at `requires_billing = true` with the seeded `'trialing'` billing row), THE suite SHALL pass.
- WHEN `pnpm test:db` runs against a grandfathered database (`requires_billing = false`), THE suite SHALL continue to pass.
- THE billing-eligibility predicate in every db-test picker SHALL mirror `loyalty_availability_reason`: non-null status outside `('cancelled', 'suspended')`.
- IF any `tests/db/**` file reintroduces `bc.status in ('trial'`, THEN THE tripwire test SHALL fail.
- THE staff-excision test SHALL derive both merchant owners from `merchants.owner_user_id` at runtime and keep all of its existing access assertions.
- THE seed fixtures (`supabase/seed.sql`) SHALL remain unchanged by this spec.

## 6. Verification Criteria and Task Breakdown

Observable outcomes, in implementation order:

1. RED — `tests/micro-specs/fresh-db-seed-parity.test.mjs` fails for the
   right reasons: four files carry the `bc.status in ('trial'` marker, five
   more lack the canonical clause, and `staff-excision.test.mjs` hardcodes
   the Old Crown owner UUID. RED (behavioral) — with
   `requires_billing = true` on both seed merchants, the four broken files
   fail exactly as a fresh database would (recorded as evidence).
2. GREEN — after the picker rewrite and owner derivation: the tripwire
   passes; `pnpm test:db` passes in the fresh simulation
   (`requires_billing = true`) AND after restoring the grandfathered state
   (`requires_billing = false`).
3. GATES — all six declared gates pass;
   `pnpm governance:run-gates --spec MS-db-fresh-seed-parity --record`
   writes the ledger; advance with `pnpm governance:advance`.

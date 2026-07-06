---
spec_id: MS-cleanup-price-remnant
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/cleanup/**
  - scripts/provider-readiness/**
  - tests/micro-specs/**
  - micro-specs/marketing/**
  - micro-specs/evidence/**
  - docs/product/legacy-offer-v1-cleanup-goal.md
implementation_surfaces:
  - scripts/provider-readiness/**
  - tests/micro-specs/**
  - micro-specs/marketing/**
  - micro-specs/evidence/**
  - docs/product/legacy-offer-v1-cleanup-goal.md
related_tests:
  - tests/micro-specs/cleanup-price-remnant.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-cleanup-price-remnant — Fix stale provider-readiness price check to GBP 49; supersede offer-v1

## 1. Exact Goal and User-Visible Outcomes

Two stale-remnant fixes surfaced by the 2026-07-06 legacy/offer audit
(`docs/product/legacy-offer-v1-cleanup-goal.md`). No runtime, UI, DB, or billing
behaviour changes.

- The provider-readiness preflight (`pnpm smoke:providers`) validates the live
  Growth **monthly** price against **£49 (`unit_amount` 4900)**, not the stale
  £29. Today an operator running the preflight against the correctly-configured
  £49 Stripe price sees a **false failure** ("Growth price does not match active
  GBP 29/month"); after this change the `stripe-price` check passes and reports
  "GBP 49/month".
- The fully-absorbed offer-v1 Micro-Spec (`MS-marketing-offer-v1`) carries
  `status: superseded`, `superseded_by: MS-marketing-offer-v2`, so the governance
  index stops presenting a superseded spec as current. Its test, evidence
  ledger, and the `lib/marketing/facts.ts` provenance it documents stay
  **untouched**.

## 2. Blast Radius

In scope (may edit):

- `scripts/provider-readiness/checks.mjs` — the hardcoded price literal and the
  two `stripe-price` report strings.
- `tests/micro-specs/**` — a new string-contract test pinning the £49 literal.
- `micro-specs/marketing/offer-v1.md` — **status transition only**, applied by
  `governance:advance` (never a hand-edited status line).
- `micro-specs/evidence/**` — ledger entries the lifecycle CLI writes (offer-v1
  supersede transition + this spec's own gate runs).
- `docs/product/legacy-offer-v1-cleanup-goal.md` — the audit charter this spec
  implements (already checked in on this branch).

Out of scope (must NOT change):

- Any application runtime, route, component, or `lib/**` code — this is a
  preflight-script + governance-metadata change only.
- The £49/£490 pricing, Stripe billing, or the offer-v2 apparatus (`OFFER`,
  `OFFER_STACK`, `GUARANTEE`, `SETUP`, `PROMO`).
- offer-v1's test (`tests/micro-specs/marketing-offer-v1.test.mjs`), its evidence
  ledger, and the offer-v1 provenance comments in `lib/marketing/facts.ts` — all
  load-bearing (goal-doc KEEP list). **No deletions.**
- The `@deprecated RewardTeaser` retirement (still rendered on
  `app/m/[merchantSlug]/page.tsx`) — its own future spec.
- Historical £29 numbers in `reports/**` and `docs/architecture-flows/**` — dated
  snapshots, left as-is.

## 3. Strict Constraints and Assumptions

- `4900` must equal the live Stripe `unit_amount` (pence) for the current Growth
  **monthly** Price (`price_1Tq0Wk…`, GBP). The annual £490 price is not
  validated by this check and is out of scope.
- The `checkStripe` matcher keeps its existing shape (`id`/`active`/`currency`/
  `interval`); only the amount literal and the two report strings change.
- No new dependencies; no refactor of the readiness harness; no change to
  `scripts/provider-readiness/runtime.mjs` or `scripts/check-provider-readiness.mjs`.
- Status lines move only through `governance:advance`; the offer-v1 supersede is
  a CLI transition, not a manual frontmatter edit.

## 4. Decisions Already Made

- Risk class is `docs-tooling`: no runtime/UI/DB/billing surface is touched, and
  `smoke:providers` is a manual preflight, not a CI gate.
- The sanctioned "tidy dead v1" is **supersede, not delete** — offer-v2 depends
  on offer-v1's test and the `facts.ts` provenance is live (audit 2026-07-06).
- `MS-marketing-offer-v2` is the successor and already exists (`implemented`).
- The audit register in `docs/product/legacy-offer-v1-cleanup-goal.md` is
  authoritative for what is and is not in scope.

## 5. Behavioral Requirements (EARS)

- THE provider-readiness Stripe check SHALL assert the Growth monthly price
  `unit_amount` equals `4900` and SHALL report the price as "GBP 49/month".
- THE provider-readiness Stripe check SHALL NOT contain the stale `2900` literal
  or the "29/month" report text.
- WHEN `pnpm smoke:providers` runs against the live £49 Growth price, THEN THE
  `stripe-price` check SHALL pass instead of failing.
- THE `MS-marketing-offer-v1` spec SHALL have `status: superseded` and
  `superseded_by: MS-marketing-offer-v2`.
- THE offer-v1 test file, its evidence ledger, and the offer-v1 provenance
  comments in `lib/marketing/facts.ts` SHALL remain unchanged (no deletion or
  edit).
- THE change SHALL introduce no change to application runtime, pricing, or
  billing behaviour.

## 6. Verification Criteria and Task Breakdown

Observable outcomes to verify:

- A string-contract test **fails before** the fix (`2900` present) and **passes
  after** (`4900` present, `2900` absent, "49/month" present, "29/month" absent).
- `pnpm test` (micro-specs + unit) is green; `pnpm test:coverage` stays green (no
  `lib/**` change).
- `pnpm governance:check` is green with `MS-marketing-offer-v1` at `superseded`
  and `MS-cleanup-price-remnant` active — every branch-diff file inside this
  spec's `allowed_blast_radius`.
- `pnpm lint` and `pnpm typecheck` green.

Task breakdown (one at a time):

1. Add the failing string-contract test pinning the £49 literal + report text in
   `checks.mjs` (Red).
2. Update `scripts/provider-readiness/checks.mjs`: `2900`→`4900`, "29/month"→
   "49/month" (×2) (Green).
3. `governance:advance MS-marketing-offer-v1 --to superseded --superseded-by
   MS-marketing-offer-v2`.
4. Commit, then `governance:advance MS-cleanup-price-remnant --to implemented`
   (runs the floor gates fresh + records evidence); commit the status + ledger.

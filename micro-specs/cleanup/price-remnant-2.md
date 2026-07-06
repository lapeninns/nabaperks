---
spec_id: MS-cleanup-price-remnant-2
status: active
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/cleanup/**
  - public/llms.txt
  - scripts/check-jsonld.mjs
implementation_surfaces:
  - public/llms.txt
  - scripts/check-jsonld.mjs
related_tests:
  - not-yet-created
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

# MS-cleanup-price-remnant-2 — Ship the remaining llms.txt and jsonld-guard price remnants

## 1. Exact Goal and User-Visible Outcomes

The last two £29 remnants from the 2026-07-06 £49 price launch ship to
production. Today `public/llms.txt` (served verbatim to AI crawlers) still
advertises "£29/month" while every human-facing surface says £49/£490, and
the JSON-LD CI guard in `scripts/check-jsonld.mjs` still pins the pricing
Offer to `29.00` — contradicting the built pricing page. When this ships,
llms.txt states the live £49/month and £490/year pricing and the guard pins
`49.00`. The working-tree edits for both already exist from the earlier
remnant sweep; this spec gives them their governance lane.

## 2. Blast Radius

May edit: `public/llms.txt` (Pricing section line only) and
`scripts/check-jsonld.mjs` (the Offer price assertion only), plus this spec's
folder.

Out of scope: every other line of both files; all marketing pages, JSON-LD
emitters, and Stripe configuration (already live at £49/£490 via PR #71 and
the prior remnant PRs #73–#75).

## 3. Strict Constraints and Assumptions

- The price-sweep rule from the launch retro is binding: a price change must
  be grepped as `£29`, `2900`, AND `"29.00"` across `public/`, `scripts/`,
  and `tests/` — this spec closes out the last two hits; verify zero remain.
- llms.txt copy must state both the monthly and annual price in the
  established voice ("£49/month per venue (GBP), or £490/year billed yearly
  (two months free)").

## 4. Decisions Already Made

- Pricing is £49/month and £490/year (owner-shipped 2026-07-06, live on
  Stripe); no copy re-litigation.
- The guard stays a hard pin (exact `49.00`), matching how it caught drift
  before.

## 5. Behavioral Requirements (EARS)

- THE public llms.txt pricing line SHALL state £49/month per venue and
  £490/year billed yearly, and SHALL NOT mention £29.
- WHEN `pnpm jsonld:check` runs against the built site, THE guard SHALL
  assert the pricing Offer price equals `49.00`.
- IF any file under public/, scripts/, or tests/ still matches `£29`, `2900`
  (price context), or `"29.00"`, THEN THE sweep SHALL be treated as
  incomplete and this spec SHALL NOT advance.

## 6. Verification Criteria and Task Breakdown

Observable behaviors: llms.txt serves the £49/£490 line; jsonld guard passes
against the built pricing page at 49.00; the three-pattern grep across
public/, scripts/, tests/ returns only intentional non-price hits.

Tasks: (1) confirm the existing working-tree edits match the requirements;
(2) run the three-pattern grep; (3) prove with
`pnpm governance:run-gates --spec MS-cleanup-price-remnant-2 --record` and
advance with `governance:advance`.

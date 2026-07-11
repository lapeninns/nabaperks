---
spec_id: MS-homepage-hero-heading-order
status: closed
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/quality/homepage-hero-heading-order.md
  - micro-specs/evidence/MS-homepage-hero-heading-order.json
  - components/loyalty/reward-ticket.tsx
  - components/marketing/landing/hero-sample-card.tsx
  - tests/micro-specs/homepage-hero-heading-order.test.mjs
  - tests/e2e/homepage-hero-heading-order.spec.ts
  - tests/e2e/homepage-hero-heading-order.desktop.spec.ts
  - tests/e2e/homepage-hero-heading-order-flow.ts
implementation_surfaces:
  - micro-specs/quality/homepage-hero-heading-order.md
  - micro-specs/evidence/MS-homepage-hero-heading-order.json
  - components/loyalty/reward-ticket.tsx
  - components/marketing/landing/hero-sample-card.tsx
  - tests/micro-specs/homepage-hero-heading-order.test.mjs
  - tests/e2e/homepage-hero-heading-order.spec.ts
  - tests/e2e/homepage-hero-heading-order.desktop.spec.ts
  - tests/e2e/homepage-hero-heading-order-flow.ts
related_tests:
  - tests/micro-specs/homepage-hero-heading-order.test.mjs
  - tests/e2e/homepage-hero-heading-order.spec.ts
  - tests/e2e/homepage-hero-heading-order.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-homepage-hero-heading-order"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - manual:design-review
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - A failing Lighthouse production report identifying the homepage hero reward title as an h3 that skips h2.
  - A red source-contract test proving the reward ticket has no configurable heading level and the homepage cannot request h2.
  - Mobile and desktop browser output proving the hero reward title is h2 while the reusable ticket remains h3 by default.
  - A post-fix production Lighthouse pass with homepage accessibility at 1.00 and no heading-order finding.
  - Full axe and visual-suite output proving no visual or broader accessibility regression.
approved_exceptions:
  - "evidence-waiver: this audit-discovered wave shares the reviewed atomic audit tree and will ship with its three predecessor waves (expires: 2026-07-18)"
---

# MS-homepage-hero-heading-order — Correct the homepage reward heading outline

## Why It Exists

Production Lighthouse identified the homepage sample reward as an `h3`
directly beneath the page `h1`, reducing the accessibility score and making
heading navigation misleading. The reward ticket is reused in contexts where
`h3` is correct, so the fix adds a narrow native heading contract and opts
only the homepage hero into `h2`.

## Invariants

- `RewardTicket` accepts only `h2` or `h3` and defaults to `h3`.
- The homepage hero contains exactly one Reward region beneath `#top`, and its
  reward title is a non-empty native `h2` with no `h3`.
- Standalone design-system reward tickets retain native `h3` headings.
- Styling, animation, layout, copy, reward state, and persistence remain
  unchanged.
- Production homepage Lighthouse retains 1.00 accessibility with no
  heading-order finding, and the full axe/visual matrices remain green.

## Code Pointers

- `components/loyalty/reward-ticket.tsx`
- `components/marketing/landing/hero-sample-card.tsx`
- `tests/micro-specs/homepage-hero-heading-order.test.mjs`
- `tests/e2e/homepage-hero-heading-order-flow.ts`
- `tests/e2e/homepage-hero-heading-order.spec.ts`
- `tests/e2e/homepage-hero-heading-order.desktop.spec.ts`
- `micro-specs/evidence/MS-homepage-hero-heading-order.json`

## Dead Ends

- Changing every reward title to `h2` was rejected because it would flatten
  valid outlines in standalone and nested contexts.
- Replacing the heading with a styled non-heading element was rejected because
  screen-reader navigation requires native semantics.
- Using an unscoped first Reward locator was rejected because another earlier
  ticket could mask a hero regression.
- Accepting the 0.98 Lighthouse score as cosmetic debt was rejected because the
  defect had a precise semantic root fix with no visual cost.

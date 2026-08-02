# Pricing section redesign — design

**Date:** 2026-08-01
**Branch:** `claude/pricing-section-redesign-469d71`
**Status:** approved, ready for implementation planning

## Problem

The pricing surfaces have drifted apart and read flat.

`GrowthPlanPricing` presents the two payment schedules as two symmetric columns of
equal weight. Nothing dominates, so the sheet reads as a specification table rather
than an offer. `LandingPricing` hand-rolls its own price treatment in a pair of
`Card`s. The merchant billing surfaces hand-roll a third. There is no shared price
idiom, so every surface drifts independently and a copy change has to be made in
four places to look consistent.

A reference design exists in the Claude Design project _Nabaperks Design System_
(`templates/pricing/Pricing.dc.html`). It solves the hierarchy problem with a single
dominant numeral. It also introduces four treatments that violate `DESIGN.md`.

## Goal

One pricing vocabulary, shared across `/pricing`, the landing band and merchant
billing. Asymmetric hierarchy so the recurring price dominates. Every visual
treatment sourced from the Wet Ink system rather than transplanted from the
reference.

This is a redesign in our system, not a port of the reference.

## Non-goals

- No change to Stripe wiring, checkout behaviour, billing actions, or price IDs.
- No change to the copy in `lib/marketing/facts.ts`. Every figure keeps flowing from
  facts; nothing is forked into a page literal.
- No change to `GuaranteeStack` / `ScarcityBand` copy — it is claims-boundary-pinned.
  Spacing and rhythm only.
- No new marketing claims. The claims boundary is unchanged.

## What we take from the reference, and what we refuse

The reference is a Claude Design artefact. Taking it verbatim would import
treatments the Wet Ink system explicitly forbids.

### Taken

| Move                                          | Why                                                             |
| --------------------------------------------- | --------------------------------------------------------------- |
| Asymmetric hero numeral                       | The core idea. Solves the flat-hierarchy problem.               |
| Campaign strip bonded to the sheet's top edge | Currently a floating dashed aside that competes with the sheet. |
| Bonded fine-print footer strip                | Currently loose `mono-id` text with no containment.             |
| Ink takeover card with `text-seal` price      | Gives the bespoke anchor presence without making it a tier.     |
| Two-column includes list                      | Halves the sheet's vertical run.                                |
| Rotated brand tag                             | Matches `ReceiptCard`'s existing `rotated` idiom.               |

### Refused

| Reference treatment                       | Conflict                                                                                                                                                                                                                              | Resolution                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `border-radius: 24px`                     | System radii are 10px (`--radius-lg`) and 18px (`--radius-sheet`). The unlayered `[data-slot="card"]` rule defeats radius utilities on slotted primitives anyway — which is also why `PricingSheet` is a plain element, not a `Card`. | 18px on the sheet (sanctioned for "large panels"), 10px elsewhere.                                                                                                                                                                                                                                                                                                                         |
| `box-shadow: 8px 8px 0`                   | Elevation scale is 4 / 3 / 2 / 1px.                                                                                                                                                                                                   | `shadow-md` (4px). Hierarchy comes from the type scale.                                                                                                                                                                                                                                                                                                                                    |
| Hand-rolled leaf `rounded-full` ✓ circles | `DESIGN.md` §Shapes — circles are reserved for the stamp family.                                                                                                                                                                      | Keep the existing `CheckmarkCircle02Icon` at 18px with `text-reward`. It is already a ringed-tick **glyph**, not a hand-rolled circle, so no `DESIGN.md` rule is engaged. `IconRoundel` was considered and rejected: it has no `leaf` tone (only `secondary`/`accent`/`card`/`primary`) and its smallest size is 32px, which would add vertical bulk the two-column list exists to remove. |
| 12.5px fine print                         | Micro-type has exactly two sanctioned sizes; 10px is the floor, enforced by `scripts/check-design-tokens.mjs`.                                                                                                                        | `mono-meta` (11.5px).                                                                                                                                                                                                                                                                                                                                                                      |
| Segmented billing toggle                  | Requires a client component; contradicts three pinned tests; implies cadence is chosen here when it is chosen at billing activation; visibly breaks at 390px (the pill wraps to two rows).                                            | Asymmetric hero + secondary lockup.                                                                                                                                                                                                                                                                                                                                                        |
| "See full pricing" second CTA             | Meaningless on `/pricing` itself.                                                                                                                                                                                                     | Kept on the landing band only.                                                                                                                                                                                                                                                                                                                                                             |

## Architecture

### New module: `components/marketing/pricing/`

Six focused server components behind a barrel `index.ts`. This is the shared
vocabulary whose absence caused the drift.

#### `price-lockup.tsx` — `PriceLockup`

The single price idiom for the whole product.

```
size: "hero" | "lead" | "inline"
```

- `hero` — `numeric-tabular text-5xl sm:text-6xl font-extrabold` amount, `mono-meta`
  cadence, baseline-aligned, wrapping to its own line on narrow viewports.
- `lead` — `text-2xl sm:text-3xl` amount, same cadence treatment. For the annual
  secondary lockup and the merchant activation card.
- `inline` — renders amount and cadence as **one contiguous text node**
  (`£69.99 every 28 days`). This is what makes merchant reuse possible: the merchant
  e2e specs assert exact single text nodes, and a split lockup would break them.

Amount and cadence arrive as separate props so callers bind to
`PRODUCT.priceAmount` / `PRODUCT.priceCadence` rather than composing strings.

`£{PRODUCT.priceAmount}` is legal in marketing source: the contract bans `/£\d/`,
and `£{` does not match.

#### `plan-includes-list.tsx` — `PlanIncludesList`

`columns: 1 | 2`. Keeps the established tick treatment — `CheckmarkCircle02Icon`
at `size={18}` with `mt-0.5 shrink-0 text-reward` — so the two call sites that
currently duplicate that markup share it instead.

#### `campaign-strip.tsx`

Adds `variant: "card" | "strip"` to the seasonal offer treatment.

- `strip` — sun ground, `border-b-2 border-ink`, bonds to a sheet's top edge.
- `card` — today's dashed `border-primary` aside, unchanged, for callers that want
  a standalone block.

Resolution still goes through `getActiveSeasonalOffer()`; the
`PLAYWRIGHT_MARKETING_OFFER_NOW` override and the `revalidate = 300` freshness
contract are untouched.

#### `fine-print-strip.tsx`

`bg-secondary`, `border-t-2 border-ink`, `mono-meta`. Bonds to a sheet's bottom
edge.

#### `pricing-sheet.tsx` — `PricingSheet`

The shell. `rounded-(--radius-sheet)`, `border-2 border-ink`, `bg-card`,
`shadow-md`, `overflow-hidden` so the two strips bleed cleanly to the border.

`--radius-sheet` (18px) is declared in `:root` at `app/globals.css:182`, not in the
`@theme` map, so there is no `rounded-sheet` utility. The custom-property shorthand
`rounded-(--radius-sheet)` is the repo idiom — the same form as `px-(--card-spacing)`
in `ReceiptCard`.

#### `takeover-anchor.tsx` — `TakeoverAnchor`

Ink surface, `text-seal` price, outline CTA. Carries `data-takeover-enquiry`.

All six are server components. No `"use client"` anywhere in the module.

### `GrowthPlanPricing` recomposed

```
PricingSheet                                    [data-growth-plan-pricing]
├─ CampaignStrip variant="strip"                offer.name + deadlineLine
├─ body (grid gap-6 p-5 sm:p-7)
│  ├─ MonoTag tone="accent" -rotate-1 "Growth Plan" · MonoTag "28-day free pilot"
│  ├─ h2  OFFER.name
│  ├─ PriceLockup size="hero"                   [data-payment-option="28-day"]
│  ├─ launch sentence  — PRODUCT.launchFee + pilotCardNote + DFY_LAUNCH.covers
│  ├─ w-rule
│  ├─ PriceLockup size="lead" + MonoTag tone="sun"  [data-payment-option="annual"]
│  ├─ purchase sequence — the three steps as a compact mono ledger
│  ├─ "Both choices include the same Growth Plan:" + PlanIncludesList columns={2}
│  └─ Button size="lg" — Start your launch
└─ FinePrintStrip   billingDisclosure · processingFeeLine · cancelLine
```

The three-step purchase sequence **stays**. It is the only thing on the page that
explains launch-fee → free pilot → recurring billing, and the reference drops it.
But it stops competing with the price: three large numerals become a compact mono
ledger row.

`MonoTag tone="accent"` is the vermillion pill. Note the token trap: in the shadcn
semantic layer `--accent` is `--w-paper-2` (pale surface) while `--primary` is
vermillion; `MonoTag`'s `tone="accent"` follows the `DESIGN.md` sense and maps to
`bg-primary`.

The takeover moves out of this component into `TakeoverAnchor`, still rendered after
the sheet.

### `LandingPricing` recomposed

Same vocabulary, teaser weight. `PriceLockup size="lead"`, `PlanIncludesList` with
the existing `.slice(0, 4)`, campaign strip in `card` variant (it sits inside a
`Card`, not bonded to a sheet), both CTAs retained — "See full pricing" is correct
here.

### `/pricing` re-composition

```
Section        PageTitle
               GrowthPlanPricing        ← absorbs DFY callout + seasonal banner
               TakeoverAnchor
Section        value-math ReceiptCard   (compact)
GuaranteeStack
ScarcityBand
Section        PageTitle h2 + FaqList
JsonLd
```

Two floating boxes — the dashed DFY launch callout and the standalone
`SeasonalOfferBanner` — disappear into the sheet.

`VALUE_MATH.illustrativeNote` stays alongside the other value-math lines; the facts
doc-comment makes that mandatory.

`FaqList` keeps the bordered-accordion treatment. `DESIGN.md` §FAQ patterns forbids
mixing the two FAQ treatments inside one route.

**Known tension:** `TakeoverAnchor` and `ScarcityBand` are both ink surfaces on one
page. They are separated by the value-math receipt and the guarantees, and they play
different roles (contained card vs. full-bleed band). If the rendered page reads as
too much ink, the fallback is dropping `TakeoverAnchor` to `bg-secondary`. Decide
from the screenshot, not in advance.

### Merchant billing

Restyled to match, with the exact-text specs kept honest rather than edited.

- `PlanRow` widens from `value: string` to `value: ReactNode`. Existing string
  callers are unaffected.
- Every pinned value renders through `PriceLockup size="inline"` so it stays a single
  text node: `"£69.99 every 28 days"`, `"£699.90 a year"`, `"£299.99"`, `"£209.97"`,
  `"28 days free"`, `"£0"`, `"Paid upfront after the pilot"`.
- `SetupBillingActivationCard` gains the campaign strip and a `size="lead"` lockup
  for the recurring price. The guarantee reassurance block moves to `IconRoundel`.
- `"Activate your venue"` stays an `<h2>` with that accessible name.
- `billing-checkout-form.tsx` is **restyle only**. It keeps `value="day"` /
  `value="year"`, all four `PRODUCT` bindings, `data-billing-checkout-form`,
  `aria-busy`, the `role="status"` pending line, and the focus-on-error alert
  labelled "Billing was not started". Button accessible names must still satisfy
  `/Continue.*£299\.99.*£69\.99.*28 days/i`, `/Pay annually.*£299\.99.*£699\.90.*year/i`
  and `/Restart billing.*£69\.99 every 28 days/i`, keep ≥44px height, and produce no
  intra-button or page overflow at 320px.
- `AccountBillingPanelSkeleton` updates to match the new row rhythm.

No behaviour, action, or Stripe change anywhere in the merchant tree.

## Contract and test impact

### Passes unmodified

`tests/contracts/marketing-offer-source.test.mjs` — all four data hooks survive
(`data-growth-plan-pricing`, both `data-payment-option`s, `data-takeover-enquiry`
after the sheet marker), the sheet stays server-rendered, the string
"Both choices include the same Growth Plan" is retained, and every pinned `PRODUCT.*`
reference remains in the file.

`tests/e2e/growth-plan-pricing.spec.ts` — asserts the three _amounts_ are visible and
exact. The split hero lockup still renders `£69.99` as a standalone node.

All merchant e2e and contract tests — via the `inline` lockup variant.

`tests/contracts/launch-fee-pricing.test.mjs` — untouched files.

### Must change — one file

`tests/e2e/growth-plan-pricing.desktop.spec.ts` asserts the two payment options sit
side-by-side sharing a top edge. That assertion encodes the symmetric design being
deliberately replaced. It is rewritten to assert the annual lockup renders below the
hero lockup and inside the sheet's bounding box, with the takeover still outside.

This is the only test edit in the change. It is a deliberate re-specification, not a
weakening: the new assertion is as strict about layout as the old one.

### Visual baselines — 22 files

| Spec                       | Baselines |
| -------------------------- | --------- |
| `marketing-pricing-*`      | 6         |
| `marketing-landing-*`      | 6         |
| `harness-launch-billing-*` | 4         |
| `annual-billing-receipt-*` | 6         |

darwin cannot render the `-linux` twins. Those are blessed from CI actual PNGs, never
`--update-snapshots` locally.

## Verification

The worktree ships without `node_modules` or `.env.local`; both are provisioned
before any gate runs.

1. `pnpm quality:fast` — lint, typecheck, contracts, unit
2. `pnpm tokens:check` — DESIGN.md ↔ globals.css parity, no sub-10px type
3. `scripts/check-jsonld.mjs` — Product offers must stay exactly `"69.99,699.90"`
   (build first; it serves from `.next`)
4. `scripts/check-banned-claims.mjs`
5. `pnpm test:e2e` scoped to the two `growth-plan-pricing` specs and the merchant
   billing recovery specs
6. `pnpm test:a11y` — `/pricing` is in the sweep
7. Screenshot `/pricing` and `/` at 320, 390 and desktop widths, plus both
   `/dev/app-harness` billing routes, and review before re-recording baselines

Baselines are re-recorded last, after the rendered result is reviewed — never as a
way of making a red go green.

## Risks

- **Two ink surfaces on `/pricing`.** Mitigation stated above; resolved from the
  rendered screenshot.
- **Hero numeral out-shouting the page `<h1>`.** `PageTitle` renders `text-3xl
sm:text-4xl`; the hero lockup renders `text-5xl sm:text-6xl`. On `/pricing` the
  price arguably _is_ the page, so this is intended — but it is checked visually, and
  the fallback is `text-4xl sm:text-5xl`.
- **Baseline churn masking a real regression.** Mitigated by reviewing screenshots
  before re-recording, and by re-recording last.

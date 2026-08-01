# Pricing Section Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three hand-rolled price treatments across `/pricing`, the landing band and merchant billing with one shared `components/marketing/pricing` vocabulary built on an asymmetric hero numeral.

**Architecture:** Six new server components form a shared pricing vocabulary. `GrowthPlanPricing`, `LandingPricing`, `app/pricing/page.tsx` and the three merchant billing surfaces are recomposed from them. The recurring price becomes a dominant hero numeral; the annual schedule becomes a secondary lockup beneath it rather than a co-equal column. Nothing becomes a client component; no Stripe or billing behaviour changes.

**Tech Stack:** Next.js App Router (server components), Tailwind v4 (`@theme` in `app/globals.css`, no `tailwind.config`), shadcn primitives under `components/ui`, Playwright (e2e + visual), `node:test` (unit + contract).

## Global Constraints

- **Every figure comes from `lib/marketing/facts.ts`.** Never fork a price, cadence or disclosure into a page literal.
- **No literal `/£\d/` in any file under `app/`, `components/`, `lib/`.** `tests/contracts/marketing-offer-source.test.mjs:266` enforces it. `£{PRODUCT.priceAmount}` is legal — `£` followed by `{` does not match.
- **No `"use client"` anywhere in `components/marketing/pricing/` or in `components/marketing/growth-plan-pricing.tsx`.** Pinned at `marketing-offer-source.test.mjs:452`.
- **These four data hooks must survive:** `data-growth-plan-pricing` (exactly one), `data-payment-option="28-day"`, `data-payment-option="annual"`, `data-takeover-enquiry` (must appear _after_ the sheet marker in source order).
- **The string `Both choices include the same Growth Plan` must remain in `growth-plan-pricing.tsx`.**
- **`growth-plan-pricing.tsx` must keep referencing** `PRODUCT.launchFeeAmount`, `priceAmount`, `priceCadence`, `annualPriceAmount`, `annualPriceCadence`, `annualSavingShort`, `annualSaving`, `billingDisclosure`, `processingFeeLine`, `cancelLine`, and `TAKEOVER.price`.
- **Merchant exact-text nodes are inviolable.** These must each remain a _single contiguous text node_: `£69.99 every 28 days`, `£699.90 a year`, `£299.99`, `£209.97`, `28 days free`, `£0`, `Paid upfront after the pilot`. `Free trial` and `£69 a month` must never appear.
- **Merchant accessible names** must still satisfy `/Continue.*£299\.99.*£69\.99.*28 days/i`, `/Pay annually.*£299\.99.*£699\.90.*year/i`, `/Restart billing.*£69\.99 every 28 days/i`. `Activate your venue` stays an `<h2>`.
- **Type floor is 10px.** Only two sanctioned micro sizes: `.mono-meta` (11.5px) and `.mono-id` (10px). `scripts/check-design-tokens.mjs` fails on arbitrary `text-[…]` below 10px.
- **Borders 2px solid ink; dashed rules 2px in exactly two tones** — `border-border` (18%) and `border-line-strong` (50%). Shadows are hard offsets from the 4/3/2/1px scale, never blurred.
- **`--radius-sheet` (18px) lives in `:root`, not `@theme`** — there is no `rounded-sheet` utility. Use `rounded-(--radius-sheet)`.
- **Token trap:** `--primary` is vermillion; `--accent` is pale paper-2. `MonoTag tone="accent"` is the _vermillion_ pill (it maps to `bg-primary`).
- **ESLint `max-lines` is 1000** (skipBlankLines + skipComments), `complexity: 40`. The 250-line analyser does **not** cover marketing files.
- **Named exports only** (except where Next requires default). Filenames kebab-case, components PascalCase, module constants SCREAMING_SNAKE_CASE.
- **Never run `--update-snapshots` locally for `-linux` twins.** darwin cannot render them; they are blessed from CI actual PNGs.

## Environment (already done — verify only)

`pnpm install` has been run in the worktree and `.env.local` copied from the main tree. If `node_modules` is missing, re-run `pnpm install --frozen-lockfile` before anything else.

## File Structure

**Created — `components/marketing/pricing/`**

| File                     | Responsibility                                                                  |
| ------------------------ | ------------------------------------------------------------------------------- |
| `price-lockup.tsx`       | The single price idiom. Three sizes; `inline` renders one contiguous text node. |
| `plan-includes-list.tsx` | The shared includes list, 1 or 2 columns.                                       |
| `campaign-strip.tsx`     | Seasonal offer in `strip` (bonded) or `card` (standalone) variant.              |
| `fine-print-strip.tsx`   | Bonded paper-2 footer strip.                                                    |
| `pricing-sheet.tsx`      | The sheet shell — 18px radius, ink border, `overflow-hidden`.                   |
| `takeover-anchor.tsx`    | Ink bespoke anchor carrying `data-takeover-enquiry`.                            |
| `index.ts`               | Barrel.                                                                         |

**Created — tests**

| File                                          | Responsibility                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `tests/contracts/pricing-vocabulary.test.mjs` | Guards the new module: no client components, no `£\d`, no forked cadence strings, callers actually use the shared primitives. |

**Modified**

| File                                                      | Change                                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `components/marketing/growth-plan-pricing.tsx`            | Recomposed from the new module. Takeover extracted out.                    |
| `components/marketing/landing/landing-pricing.tsx`        | Recomposed from the new module.                                            |
| `components/marketing/seasonal-offer-banner.tsx`          | Delegates to `CampaignStrip variant="card"`.                               |
| `components/marketing/index.ts`                           | Re-export the pricing barrel.                                              |
| `app/pricing/page.tsx`                                    | Re-composition; DFY callout and standalone banner absorbed into the sheet. |
| `tests/e2e/growth-plan-pricing.desktop.spec.ts`           | Lines 28–35 only: side-by-side → stacked.                                  |
| `components/merchant/account/billing-activation-card.tsx` | `PlanRow` widened; inline lockups; campaign strip.                         |
| `components/merchant/account/billing-panel-view.tsx`      | Inline lockups in `BillingReceipt`.                                        |
| `components/merchant/account/billing-checkout-form.tsx`   | Restyle only.                                                              |
| `components/merchant/loading-skeletons.tsx`               | `AccountBillingPanelSkeleton` row rhythm.                                  |

---

### Task 1: `PriceLockup` — the shared price idiom

**Files:**

- Create: `components/marketing/pricing/price-lockup.tsx`
- Create: `tests/contracts/pricing-vocabulary.test.mjs`

**Interfaces:**

- Consumes: nothing.
- Produces: `PriceLockup({ amount, cadence, size, className, "data-payment-option"?: string })` where `amount: string` (bare numeral, e.g. `"69.99"`), `cadence: string`, `size: "hero" | "lead" | "inline"` (default `"lead"`). Tasks 2–10 depend on this exact signature.

- [ ] **Step 1: Write the failing contract test**

Create `tests/contracts/pricing-vocabulary.test.mjs`:

```js
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

const PRICING_MODULE = [
  "components/marketing/pricing/price-lockup.tsx",
  "components/marketing/pricing/plan-includes-list.tsx",
  "components/marketing/pricing/campaign-strip.tsx",
  "components/marketing/pricing/fine-print-strip.tsx",
  "components/marketing/pricing/pricing-sheet.tsx",
  "components/marketing/pricing/takeover-anchor.tsx",
]

test("the pricing vocabulary stays server-rendered", () => {
  for (const path of PRICING_MODULE) {
    assert.doesNotMatch(
      read(path),
      /"use client"/,
      `${path} must stay a server component`
    )
  }
})

test("the pricing vocabulary never hard-codes a price", () => {
  for (const path of PRICING_MODULE) {
    assert.doesNotMatch(
      read(path),
      /£\d/,
      `${path} must render figures from facts, not literals`
    )
  }
})

test("PriceLockup keeps the inline variant contiguous for merchant exact-text specs", () => {
  const source = read("components/marketing/pricing/price-lockup.tsx")
  // The inline branch must join amount and cadence into one string expression,
  // never two sibling elements — merchant e2e asserts exact single text nodes.
  assert.match(source, /size === "inline"/)
  assert.match(source, /\{`£\$\{amount\} \$\{cadence\}`\}/)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd "$(git rev-parse --show-toplevel)" && node --test tests/contracts/pricing-vocabulary.test.mjs`

Expected: FAIL — `ENOENT` on `components/marketing/pricing/price-lockup.tsx`.

- [ ] **Step 3: Write `price-lockup.tsx`**

```tsx
import { cn } from "@/lib/utils"

const AMOUNT_SIZE = {
  /** The page's dominant numeral — one per surface. */
  hero: "text-5xl leading-none sm:text-6xl",
  /** Secondary schedules and merchant activation. */
  lead: "text-2xl leading-none sm:text-3xl",
  inline: "",
} as const

/**
 * PriceLockup — the single price idiom for the whole product.
 *
 * `hero` and `lead` split the amount from its cadence so the numeral can
 * dominate. `inline` deliberately does NOT split: it emits one contiguous
 * text node, because the merchant billing specs assert exact single text
 * nodes (`£69.99 every 28 days`) and a split lockup would break them.
 *
 * `amount` is the bare numeral from facts (`PRODUCT.priceAmount`), never a
 * pre-composed string — the £ is owned here so the cadence pairing stays
 * consistent across every surface.
 */
export function PriceLockup({
  amount,
  cadence,
  size = "lead",
  className,
  ...props
}: {
  amount: string
  cadence: string
  size?: keyof typeof AMOUNT_SIZE
  className?: string
} & React.ComponentProps<"p">) {
  if (size === "inline") {
    return (
      <span className={cn("numeric-tabular", className)} {...props}>
        {`£${amount} ${cadence}`}
      </span>
    )
  }

  return (
    <p
      className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}
      {...props}
    >
      <span
        className={cn(
          "numeric-tabular font-extrabold text-foreground",
          AMOUNT_SIZE[size]
        )}
      >
        £{amount}
      </span>
      <span className="mono-meta text-muted-foreground">{cadence}</span>
    </p>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/contracts/pricing-vocabulary.test.mjs`

Expected: the two `"use client"` / `£\d` tests still fail with `ENOENT` on the five not-yet-created files; the `PriceLockup` inline test PASSES. That is expected mid-task — Tasks 2–5 create the rest.

To check only this task's assertion:
`node --test --test-name-pattern "inline variant" tests/contracts/pricing-vocabulary.test.mjs`
Expected: 1 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/pricing/price-lockup.tsx tests/contracts/pricing-vocabulary.test.mjs
git commit -m "feat(pricing): add the shared PriceLockup idiom"
```

---

### Task 2: `PlanIncludesList`

**Files:**

- Create: `components/marketing/pricing/plan-includes-list.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `PlanIncludesList({ items, columns, className })` where `items: readonly string[]`, `columns: 1 | 2` (default `1`).

- [ ] **Step 1: Write `plan-includes-list.tsx`**

This is the markup currently duplicated in `growth-plan-pricing.tsx:141-154` and `landing-pricing.tsx:60-73`, extracted verbatim so the two stop drifting. The tick stays `CheckmarkCircle02Icon` — it is already a ringed-tick glyph, so no `DESIGN.md` circle rule is engaged.

```tsx
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"

/**
 * PlanIncludesList — the shared "what you get" list. Extracted from the two
 * call sites that previously duplicated this markup, so the pricing sheet and
 * the landing band cannot drift apart again.
 */
export function PlanIncludesList({
  items,
  columns = 1,
  className,
}: {
  items: readonly string[]
  columns?: 1 | 2
  className?: string
}) {
  return (
    <ul
      className={cn(
        "grid gap-2.5",
        columns === 2 && "sm:grid-cols-2 sm:gap-x-6",
        className
      )}
    >
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <Icon
            icon={CheckmarkCircle02Icon}
            size={18}
            className="mt-0.5 shrink-0 text-reward"
          />
          <span className="text-sm leading-6 text-foreground">{item}</span>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS (no errors referencing `plan-includes-list.tsx`).

- [ ] **Step 3: Commit**

```bash
git add components/marketing/pricing/plan-includes-list.tsx
git commit -m "feat(pricing): extract the shared PlanIncludesList"
```

---

### Task 3: `CampaignStrip`

**Files:**

- Create: `components/marketing/pricing/campaign-strip.tsx`
- Modify: `components/marketing/seasonal-offer-banner.tsx`

**Interfaces:**

- Consumes: `getActiveSeasonalOffer` from `@/lib/marketing/seasonal-offer`.
- Produces: `CampaignStrip({ variant, className })` where `variant: "card" | "strip"` (default `"card"`). Returns `null` when no offer is active.

- [ ] **Step 1: Write `campaign-strip.tsx`**

The `card` branch is today's `SeasonalOfferBanner` markup, byte-for-byte, so existing callers keep their exact rendering. The `strip` branch is new.

```tsx
import { MonoTag } from "@/components/brand"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import { cn } from "@/lib/utils"

/**
 * CampaignStrip — the seasonal offer wrapper in two shapes.
 *
 * `card` is the standalone dashed aside (unchanged from the original
 * SeasonalOfferBanner). `strip` bonds to the top edge of a PricingSheet: sun
 * ground, ink bottom border, no radius of its own — the sheet's
 * `overflow-hidden` clips it to the sheet's corners.
 *
 * Returns null when no window is active. The resolver never invents a
 * deadline once a window expires.
 */
export function CampaignStrip({
  variant = "card",
  className,
}: {
  variant?: "card" | "strip"
  className?: string
}) {
  const offer = getActiveSeasonalOffer()

  if (!offer) return null

  if (variant === "strip") {
    return (
      <aside
        aria-label="Current seasonal offer"
        className={cn(
          "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-ink bg-seal px-5 py-3 text-seal-foreground sm:px-7",
          className
        )}
      >
        <p className="mono-meta">{offer.deadlineLine}</p>
        <p className="text-sm leading-6 font-bold">{offer.name}</p>
      </aside>
    )
  }

  return (
    <aside
      aria-label="Current seasonal offer"
      className={cn(
        "grid gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/8 p-4",
        className
      )}
    >
      <MonoTag tone="sun" className="justify-self-start">
        Fixed campaign window
      </MonoTag>
      <p className="text-base leading-6 font-extrabold text-foreground">
        {offer.name}
      </p>
      <p className="text-sm leading-6 font-bold text-foreground">
        {offer.deadlineLine}
      </p>
      <p className="text-xs leading-5 text-muted-foreground">
        {offer.termsLine}
      </p>
    </aside>
  )
}
```

Note: the `strip` variant drops `offer.termsLine`. That line ("The wrapper and deadline do not change the standard Growth Plan deliverables, prices or guarantee conditions") is a claims-safety line. It must not be lost — Task 6 renders it in the sheet's fine-print strip.

- [ ] **Step 2: Replace `seasonal-offer-banner.tsx` with a delegating alias**

```tsx
import { CampaignStrip } from "./pricing/campaign-strip"

/**
 * SeasonalOfferBanner — the standalone card-shaped seasonal offer.
 * Retained as a named alias so the merchant billing and landing call sites
 * keep a stable import; the markup now lives in CampaignStrip.
 */
export function SeasonalOfferBanner({ className }: { className?: string }) {
  return <CampaignStrip variant="card" className={className} />
}
```

- [ ] **Step 3: Verify the card variant is unchanged**

Run: `pnpm typecheck && node --test tests/unit/seasonal-offer.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/pricing/campaign-strip.tsx components/marketing/seasonal-offer-banner.tsx
git commit -m "feat(pricing): add CampaignStrip with a bonded strip variant"
```

---

### Task 4: `PricingSheet` and `FinePrintStrip`

**Files:**

- Create: `components/marketing/pricing/pricing-sheet.tsx`
- Create: `components/marketing/pricing/fine-print-strip.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `PricingSheet({ children, className, ...props })` (spreads onto the root `<div>`, so callers attach `data-growth-plan-pricing`); `PricingSheetBody({ children, className })`; `FinePrintStrip({ children, className })`.

- [ ] **Step 1: Write `pricing-sheet.tsx`**

```tsx
import { cn } from "@/lib/utils"

/**
 * PricingSheet — the offer sheet shell.
 *
 * A plain element, not a shadcn Card, deliberately: the unlayered
 * `[data-slot="card"]` rule in globals.css forces `--radius-lg` and would
 * silently defeat the 18px sheet radius. `--radius-sheet` is declared in
 * `:root`, not the `@theme` map, so there is no `rounded-sheet` utility —
 * the custom-property shorthand is the repo idiom (cf. `px-(--card-spacing)`).
 *
 * `overflow-hidden` is load-bearing: it clips the bonded campaign strip and
 * fine-print strip to the sheet's corners.
 */
export function PricingSheet({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-(--radius-sheet) border-2 border-ink bg-card text-card-foreground shadow-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/** The padded interior of a PricingSheet, between the bonded strips. */
export function PricingSheetBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-6 p-5 sm:p-7", className)}>{children}</div>
  )
}
```

- [ ] **Step 2: Write `fine-print-strip.tsx`**

```tsx
import { cn } from "@/lib/utils"

/**
 * FinePrintStrip — the bonded footer of a PricingSheet. Sits on the deeper
 * paper ground with an ink top border so the disclosures read as printed
 * terms rather than floating body copy. Uses `.mono-meta` (11.5px): the
 * system's micro scale has exactly two sanctioned sizes and 10px is the
 * floor, guarded by scripts/check-design-tokens.mjs.
 */
export function FinePrintStrip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mono-meta border-t-2 border-ink bg-secondary px-5 py-4 leading-5 text-muted-foreground sm:px-7",
        className
      )}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/pricing/pricing-sheet.tsx components/marketing/pricing/fine-print-strip.tsx
git commit -m "feat(pricing): add the PricingSheet shell and FinePrintStrip"
```

---

### Task 5: `TakeoverAnchor` and the barrel

**Files:**

- Create: `components/marketing/pricing/takeover-anchor.tsx`
- Create: `components/marketing/pricing/index.ts`
- Modify: `components/marketing/index.ts`

**Interfaces:**

- Consumes: `TAKEOVER`, `ROUTES` from facts; `Button`, `MonoTag`.
- Produces: `TakeoverAnchor({ className })`, rendering `data-takeover-enquiry` on its root.

- [ ] **Step 1: Write `takeover-anchor.tsx`**

```tsx
import Link from "next/link"

import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { ROUTES, TAKEOVER } from "@/lib/marketing/facts"
import { cn } from "@/lib/utils"

/**
 * TakeoverAnchor — the bespoke engagement, on ink.
 *
 * Deliberately stacked BELOW the pricing sheet, never beside it: a
 * side-by-side column would read as a third tier, which the offer explicitly
 * is not. The ink ground gives it presence without granting it parity.
 * `TAKEOVER.price` is enquiry-only — there is no self-serve checkout.
 */
export function TakeoverAnchor({ className }: { className?: string }) {
  return (
    <aside
      data-takeover-enquiry
      className={cn(
        "grid gap-4 rounded-(--radius-sheet) border-2 border-ink bg-ink p-5 text-paper shadow-md sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:p-7",
        className
      )}
    >
      <div className="grid gap-2">
        <MonoTag tone="sun" className="justify-self-start">
          Bespoke engagement · enquiry only
        </MonoTag>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="numeric-tabular text-2xl leading-none font-extrabold text-seal sm:text-3xl">
            {TAKEOVER.price}
          </span>
          <span className="text-base leading-snug font-extrabold text-paper">
            {TAKEOVER.name}
          </span>
        </p>
        <p className="max-w-2xl text-sm leading-6 text-paper/80">
          {TAKEOVER.qualifier} Not a Growth Plan tier — no self-serve checkout.
        </p>
      </div>
      <Button asChild variant="secondary" className="w-fit shrink-0">
        <Link href={ROUTES.demo}>{TAKEOVER.action}</Link>
      </Button>
    </aside>
  )
}
```

- [ ] **Step 2: Write the barrel `components/marketing/pricing/index.ts`**

```ts
export { CampaignStrip } from "./campaign-strip"
export { FinePrintStrip } from "./fine-print-strip"
export { PlanIncludesList } from "./plan-includes-list"
export { PriceLockup } from "./price-lockup"
export { PricingSheet, PricingSheetBody } from "./pricing-sheet"
export { TakeoverAnchor } from "./takeover-anchor"
```

- [ ] **Step 3: Re-export from `components/marketing/index.ts`**

Replace the file with:

```ts
export { GrowthPlanPricing } from "./growth-plan-pricing"
export { Marquee } from "./marquee"
export { SeasonalOfferBanner } from "./seasonal-offer-banner"
export * from "./pricing"
```

- [ ] **Step 4: Run the full contract test — now every file exists**

Run: `node --test tests/contracts/pricing-vocabulary.test.mjs`
Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/pricing/ components/marketing/index.ts
git commit -m "feat(pricing): add the ink TakeoverAnchor and the pricing barrel"
```

---

### Task 6: Recompose `GrowthPlanPricing`

**Files:**

- Modify: `components/marketing/growth-plan-pricing.tsx` (full rewrite)
- Modify: `tests/e2e/growth-plan-pricing.desktop.spec.ts:28-35`

**Interfaces:**

- Consumes: everything from Task 1–5.
- Produces: `GrowthPlanPricing({ className })` — unchanged signature. `TakeoverAnchor` is no longer rendered from inside it; Task 8 renders it from the page.

- [ ] **Step 1: Rewrite `growth-plan-pricing.tsx`**

```tsx
import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { MonoTag } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  DFY_LAUNCH,
  OFFER,
  PLAN_INCLUDES,
  PRODUCT,
} from "@/lib/marketing/facts"
import { getActiveSeasonalOffer } from "@/lib/marketing/seasonal-offer"
import {
  CampaignStrip,
  FinePrintStrip,
  PlanIncludesList,
  PriceLockup,
  PricingSheet,
  PricingSheetBody,
} from "./pricing"

/**
 * The pricing sheet — one Growth Plan presented as a printed offer, not a set
 * of SaaS plan cards.
 *
 * The recurring price is the sheet's dominant numeral; the annual schedule is
 * a secondary lockup beneath a perforation, not a co-equal column. That
 * asymmetry is the point: two equal columns read as a specification table and
 * leave the reader with nothing to anchor on.
 *
 * There is deliberately no billing toggle. The cadence is chosen later, at
 * billing activation — a control here would imply a decision that is not
 * actually being taken, and it would force the sheet to become a client
 * component. Both schedules stay rendered, always.
 *
 * The bespoke takeover is NOT rendered here; the page stacks TakeoverAnchor
 * below the sheet so it can never read as a third tier.
 */
export function GrowthPlanPricing({ className }: { className?: string }) {
  const offer = getActiveSeasonalOffer()

  return (
    <PricingSheet data-growth-plan-pricing className={className}>
      <CampaignStrip variant="strip" />
      <PricingSheetBody>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <MonoTag tone="accent" className="-rotate-1">
              {PRODUCT.planName}
            </MonoTag>
            <MonoTag>{PRODUCT.pilot}</MonoTag>
          </div>
          <h2 className="text-2xl leading-tight font-extrabold text-foreground sm:text-3xl">
            {OFFER.name}
          </h2>
        </div>

        <div className="grid gap-4">
          <div data-payment-option="28-day" className="grid gap-2">
            <PriceLockup
              size="hero"
              amount={PRODUCT.priceAmount}
              cadence={PRODUCT.priceCadence}
            />
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              £{PRODUCT.launchFeeAmount} launch fee today, then the{" "}
              {PRODUCT.pilotCardNote} before recurring billing starts.
            </p>
          </div>

          <hr className="w-rule my-0 border-line-strong" />

          <div
            data-payment-option="annual"
            className="grid gap-2 sm:flex sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6"
          >
            <div className="grid gap-2">
              <PriceLockup
                size="lead"
                amount={PRODUCT.annualPriceAmount}
                cadence={PRODUCT.annualPriceCadence}
              />
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
              </p>
            </div>
            <MonoTag tone="sun" className="w-fit shrink-0 rotate-1">
              {PRODUCT.annualSavingShort}
            </MonoTag>
          </div>
        </div>

        <ol
          aria-label="How buying the Growth Plan works"
          className="mono-meta grid gap-0 border-y-2 border-dashed border-border text-muted-foreground"
        >
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-border py-2 last:border-b-0">
            <span className="text-foreground">Today</span>
            <span className="normal-case">
              £{PRODUCT.launchFeeAmount} launch fee at checkout.{" "}
              {DFY_LAUNCH.covers}
            </span>
          </li>
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-dashed border-border py-2 last:border-b-0">
            <span className="text-foreground">Days 1–28</span>
            <span className="normal-case">
              Free platform pilot. Card required — recurring billing starts only
              after the pilot.
            </span>
          </li>
          <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
            <span className="text-foreground">After the pilot</span>
            <span className="normal-case">
              One of the two payment schedules above begins.
            </span>
          </li>
        </ol>

        <div className="grid gap-3">
          <p className="text-sm leading-6 font-bold text-foreground">
            Both choices include the same Growth Plan:
          </p>
          <PlanIncludesList items={PLAN_INCLUDES} columns={2} />
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button asChild size="lg">
              <MarketingSignupLink>Start your launch</MarketingSignupLink>
            </Button>
          </div>
        </div>
      </PricingSheetBody>
      <FinePrintStrip>
        {PRODUCT.billingDisclosure} {PRODUCT.processingFeeLine}{" "}
        {PRODUCT.cancelLine}
        {offer ? ` ${offer.termsLine}` : ""}
      </FinePrintStrip>
    </PricingSheet>
  )
}
```

Two things to check here rather than assume:

- `offer.termsLine` is carried into the fine print because the `strip` variant drops it, and it is a claims-safety line.
- The `<ol>` uses `.mono-meta` for the step label and `normal-case` on the detail so the sentence is not uppercased. `.mono-meta` sets `text-transform: uppercase` at the parent.

- [ ] **Step 2: Run the contract test to confirm no pin broke**

Run: `node --test tests/contracts/marketing-offer-source.test.mjs`
Expected: PASS. If it fails on a missing `PRODUCT.*` reference, add the reference back — the pin list is in Global Constraints.

- [ ] **Step 3: Update the desktop e2e spec**

In `tests/e2e/growth-plan-pricing.desktop.spec.ts`, replace lines 28–35:

```ts
// Side by side: same top edge, annual to the right.
const paygBox = await payAsYouGo.boundingBox()
const annualBox = await annual.boundingBox()
if (!paygBox || !annualBox) {
  throw new Error("payment option boxes must be measurable")
}
expect(Math.abs(annualBox.y - paygBox.y)).toBeLessThanOrEqual(4)
expect(annualBox.x).toBeGreaterThan(paygBox.x)
```

with:

```ts
// Asymmetric hierarchy: the recurring price leads, the annual schedule
// sits beneath it. Two equal columns read as a spec table, so the annual
// lockup is deliberately subordinate rather than side by side.
const paygBox = await payAsYouGo.boundingBox()
const annualBox = await annual.boundingBox()
if (!paygBox || !annualBox) {
  throw new Error("payment option boxes must be measurable")
}
expect(annualBox.y).toBeGreaterThanOrEqual(paygBox.y + paygBox.height - 1)
```

Also update the file's doc comment on line 8 from "sit side by side inside the single Growth Plan boundary" to "stack inside the single Growth Plan boundary, the recurring price leading", and the test title on line 18 from "Then the schedules sit side by side and the page passes axe" to "Then the schedules stack inside one boundary and the page passes axe".

- [ ] **Step 4: Run both pricing e2e specs**

Run: `pnpm test:e2e --grep "Growth Plan pricing sheet"`
Expected: PASS on all projects. If axe reports a contrast failure on the sun campaign strip, that is a real finding — `bg-seal`/`text-seal-foreground` must clear 4.5:1. Report it rather than suppressing it.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/growth-plan-pricing.tsx tests/e2e/growth-plan-pricing.desktop.spec.ts
git commit -m "feat(pricing): rebuild the Growth Plan sheet around an asymmetric hero"
```

---

### Task 7: Recompose `LandingPricing`

**Files:**

- Modify: `components/marketing/landing/landing-pricing.tsx`

**Interfaces:**

- Consumes: Task 1–5. Signature unchanged: `LandingPricing()`.

- [ ] **Step 1: Rewrite the two `Card` bodies to use the shared vocabulary**

Replace the price block (`landing-pricing.tsx:40-58`) with a `PriceLockup size="lead"` for the recurring price plus the annual secondary under the existing dashed rule, and replace the hand-rolled `<ul>` (lines 60-73) with `<PlanIncludesList items={PLAN_INCLUDES.slice(0, 4)} />`.

```tsx
            <div className="grid gap-1">
              <PriceLockup
                size="lead"
                amount={PRODUCT.priceAmount}
                cadence={PRODUCT.priceCadence}
              />
              <p className="text-sm leading-6 font-bold text-foreground">
                {PRODUCT.launchFee} launch fee today, then the{" "}
                {PRODUCT.pilotCardNote} before recurring billing starts.
              </p>
              <div className="mt-2 grid gap-1 border-t-2 border-dashed border-border pt-3">
                <p className="text-lg leading-6 font-extrabold text-foreground">
                  Or {PRODUCT.annualPrice}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {PRODUCT.annualBillingDisclosure} {PRODUCT.annualSaving}
                </p>
              </div>
            </div>
            <SeasonalOfferBanner />
            <PlanIncludesList items={PLAN_INCLUDES.slice(0, 4)} />
```

Add `PriceLockup` and `PlanIncludesList` to the import from `@/components/marketing`. Keep both CTAs — "See full pricing" is correct on the landing band. Keep the bespoke `Card` as-is; the landing band is a teaser and the ink `TakeoverAnchor` belongs to `/pricing`.

- [ ] **Step 2: Verify the landing composition contract still passes**

Run: `node --test tests/contracts/marketing-offer-source.test.mjs`
Expected: PASS — the composition order test (Hero → Marquee → ProofLine → ProductMoment → FitNote → LandingPricing → FinalCta) is unaffected.

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/landing/landing-pricing.tsx
git commit -m "feat(pricing): move the landing band onto the shared pricing vocabulary"
```

---

### Task 8: Re-compose `/pricing`

**Files:**

- Modify: `app/pricing/page.tsx:54-101`

**Interfaces:**

- Consumes: `GrowthPlanPricing`, `TakeoverAnchor`.

- [ ] **Step 1: Replace the page body**

Remove the DFY launch callout div (lines 65-70) and the standalone `<SeasonalOfferBanner className="mt-4" />` (line 71) — both are now inside the sheet. Add `TakeoverAnchor` beneath it.

```tsx
    <MarketingLayout>
      <Section>
        <PageTitle
          eyebrow="Pricing"
          title="One core plan. Two clear ways to pay."
          description="Pay for the physical launch today. Prove the platform during the free pilot before recurring billing starts."
        />
        <GrowthPlanPricing className="mt-6" />
        <TakeoverAnchor className="mt-5" />
      </Section>
```

Update the imports: drop `MonoTag` and `SeasonalOfferBanner` and `DFY_LAUNCH` if they become unused (the linter will tell you); add `TakeoverAnchor` to the `@/components/marketing` import.

Leave everything from `<Section size="compact">` (the value-math receipt) onward exactly as it is, including `GuaranteeStack`, `ScarcityBand`, the FAQ section and the `JsonLd` block.

- [ ] **Step 2: Verify the pinned page assertions**

Run: `node --test tests/contracts/marketing-offer-source.test.mjs`
Expected: PASS — `/pricing` must still `export const revalidate = 300`, must still render `<GrowthPlanPricing`, must still render `GuaranteeStack`, and must NOT itself contain `data-payment-option` or `data-growth-plan-pricing`.

- [ ] **Step 3: Verify unused imports are gone**

Run: `pnpm lint`
Expected: PASS, no `no-unused-vars`.

- [ ] **Step 4: Commit**

```bash
git add app/pricing/page.tsx
git commit -m "feat(pricing): absorb the launch callout and campaign banner into the sheet"
```

---

### Task 9: Merchant receipts adopt the inline lockup

**Files:**

- Modify: `components/merchant/account/billing-activation-card.tsx`
- Modify: `components/merchant/account/billing-panel-view.tsx`

**Interfaces:**

- Consumes: `PriceLockup` (Task 1).
- Produces: `PlanRow({ label, value })` with `value: ReactNode` (widened from `string`). `billing-panel-view.tsx` imports `PlanRow` from the activation card, so the widening must land in the same commit.

**This task's entire risk is the exact-text specs.** Every value below must stay one contiguous text node.

- [ ] **Step 1: Widen `PlanRow`**

In `billing-activation-card.tsx`, change the signature only:

```tsx
export function PlanRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
```

Leave the body untouched — `min-w-0` and `break-words` on the `<dd>` are load-bearing for the 320px overflow assertions.

- [ ] **Step 2: Route the two split-able prices through the inline lockup**

In the activation card's nine `PlanRow`s, replace only these two values:

```tsx
        <PlanRow
          label="Then"
          value={
            <PriceLockup
              size="inline"
              amount={PRODUCT.priceAmount}
              cadence={PRODUCT.priceCadence}
            />
          }
        />
        <PlanRow
          label="Or prepay"
          value={
            <PriceLockup
              size="inline"
              amount={PRODUCT.annualPriceAmount}
              cadence={PRODUCT.annualPriceCadence}
            />
          }
        />
```

This renders `£69.99 every 28 days` and `£699.90 a year` as single text nodes — identical output to the previous `PRODUCT.price` / `PRODUCT.annualPrice` strings, now composed from the same primitive the marketing sheet uses.

Also replace the two hardcoded literals flagged during exploration:

- `Annual saving` value `"£209.97"` → `{PRODUCT.annualSavingShort.replace("Save ", "")}` — **no**: that is a fragile transform. Leave `"£209.97"` as-is for now and note it; changing it risks the exact-text spec for no design benefit.
- `Recurring year` value `"£909.87 across 13 payments per 364 days"` → leave as-is, same reason.

- [ ] **Step 3: Add the campaign strip and restyle the activation card shell**

The `SeasonalOfferBanner` already renders inside this card at line 65 — leave it in `card` variant. Restyle is limited to spacing so it reads as a sibling of the new marketing sheet:

- `ReceiptCard` keeps `edge padding="sm"` and its responsive `sm:[--card-spacing:--spacing(6)]`.
- The `<dl>` keeps its classes exactly — the row rhythm is asserted by the visual baseline and the 320px overflow checks.

- [ ] **Step 4: Route `BillingReceipt` in the panel view through the inline lockup**

In `billing-panel-view.tsx`'s `BillingReceipt`, the `cycle`, `monthly` and `annual` branches compose strings like `` `${amountLabel} every 28 days` ``. `amountLabel` comes from `buildBillingPresentation` and is already a formatted currency string (`£699.90`), not a bare numeral, so `PriceLockup` is the wrong tool here — it prepends its own `£`.

Leave these branches exactly as they are. They already emit single contiguous text nodes, which is the property the specs care about.

- [ ] **Step 5: Run every merchant billing test**

Run:

```
node --test tests/unit/billing-presentation.test.mjs tests/unit/complimentary-billing-access.test.mjs tests/unit/billing-checkout-return.test.mjs
node --test tests/contracts/merchant-ux-audit-closure.test.mjs tests/contracts/merchant-launch-follow-through.test.mjs tests/contracts/launch-fee-pricing.test.mjs
pnpm test:e2e --grep "billing"
```

Expected: all PASS. The exact-text assertions (`£69.99 every 28 days`, `£699.90 a year`, `£299.99`, `£209.97`, `28 days free`) are the ones to watch.

- [ ] **Step 6: Commit**

```bash
git add components/merchant/account/billing-activation-card.tsx components/merchant/account/billing-panel-view.tsx
git commit -m "feat(billing): share the marketing price lockup with the merchant receipts"
```

---

### Task 10: Merchant checkout form and skeleton

**Files:**

- Modify: `components/merchant/account/billing-checkout-form.tsx`
- Modify: `components/merchant/loading-skeletons.tsx` (`AccountBillingPanelSkeleton`, ~line 473)

**Interfaces:** none produced.

**Restyle only.** No behaviour change. Do not touch: `value="day"` / `value="year"`, the four `PRODUCT` bindings in the default labels, `data-billing-checkout-form`, `aria-busy`, the `role="status"` pending line, the focus-on-error `Alert`, or `useActionState`.

- [ ] **Step 1: Confirm the untouchables before editing**

Run: `node --test tests/contracts/launch-fee-pricing.test.mjs`
Expected: PASS. Re-run after every edit in this task.

- [ ] **Step 2: Restyle the two submit buttons**

Keep `h-auto min-h-11 w-full whitespace-normal` — the comment at lines 59-61 explains that removing them creates a ~360px intrinsic floor that breaks 320px viewports. Restyle is limited to the wrapper grid gap and the pending line's type, so the accessible-name regexes and the ≥44px height assertions are untouched.

- [ ] **Step 3: Update `AccountBillingPanelSkeleton` to match the row rhythm**

Only if Task 9 changed the receipt row count or spacing. It did not — Task 9 deliberately left the `<dl>` classes alone. **Verify, then skip this step if the rhythm is unchanged.**

Run: `pnpm test:e2e --grep "billing"` and compare the loading state visually.

- [ ] **Step 4: Full merchant gate**

Run: `pnpm quality:fast`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/merchant/account/billing-checkout-form.tsx components/merchant/loading-skeletons.tsx
git commit -m "refactor(billing): align the checkout form with the pricing sheet rhythm"
```

---

### Task 11: Gates, visual review, baselines

**Files:**

- Modify: visual baseline PNGs (22 files across four snapshot directories)

- [ ] **Step 1: Run the full fast gate**

Run: `pnpm quality:fast`
Expected: PASS — lint, typecheck, contracts, unit.

- [ ] **Step 2: Run the token and claims gates**

Run:

```
pnpm tokens:check
node scripts/check-banned-claims.mjs
```

Expected: PASS. `tokens:check` will fail if any arbitrary text size dropped below 10px or a `var(--x)` is undefined.

- [ ] **Step 3: Build, then run the JSON-LD gate**

`check-jsonld.mjs` serves from `.next` and will silently validate a stale build otherwise.

Run:

```
pnpm build
node scripts/check-jsonld.mjs
```

Expected: PASS — home Product offers must be exactly `"69.99,699.90"`.

- [ ] **Step 4: Screenshot and REVIEW before touching any baseline**

Start the dev server (`pnpm dev --webpack` — Turbopack cannot infer the workspace root here) and capture:

- `/pricing` at 320, 390, and desktop
- `/` at 390 and desktop
- `/dev/app-harness/launch?tab=billing&state=billing`
- `/dev/app-harness/account?tab=billing&billing=active-year`

Review these against the design intent before proceeding. Specifically check the two risks recorded in the spec:

1. **Two ink surfaces** — `TakeoverAnchor` and `ScarcityBand` on one page. If it reads as too much ink, change `TakeoverAnchor`'s `bg-ink text-paper` to `bg-secondary text-foreground` (and the price from `text-seal` to `text-foreground`).
2. **Hero numeral vs page `<h1>`** — `PageTitle` is `text-3xl sm:text-4xl`; the hero is `text-5xl sm:text-6xl`. If the price overwhelms the title, drop the hero to `text-4xl sm:text-5xl` in `price-lockup.tsx`.

Note: preview screenshots have historically come out blank at `lg` widths — capture below 1024 and verify desktop via computed styles if needed.

- [ ] **Step 5: Re-record the darwin baselines**

Only after Step 4's review is satisfied.

Run: `pnpm test:visual --update-snapshots --grep "marketing-pricing|marketing-landing|harness-launch-billing|annual-billing-receipt"`

This regenerates the darwin-rendered PNGs only. **Do not attempt the `-linux` twins** — darwin cannot render them; they are blessed from CI actual PNGs after the branch is pushed.

- [ ] **Step 6: Run the a11y sweep**

Run: `pnpm test:a11y`
Expected: PASS. `/pricing` is in the sweep list.

- [ ] **Step 7: Commit the baselines separately**

```bash
git add tests/e2e/**/*-snapshots/
git commit -m "test(visual): re-record darwin pricing baselines for the redesign"
```

- [ ] **Step 8: Push and collect the linux twins from CI**

```bash
git push -u origin claude/pricing-section-redesign-469d71
```

CI will fail the visual tier on the six `-linux` baselines. Download the actual PNGs from the run artifacts and commit them as the twins. This is the only correct way to bless them.

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: the six new components (Tasks 1–5), `GrowthPlanPricing` (6), `LandingPricing` (7), `/pricing` re-composition (8), merchant billing (9–10), the single test edit (6, Step 3), the 22 baselines (11).

**Known deviations from the spec, resolved during planning:**

1. `IconRoundel` was specified for the includes tick. It has no `leaf` tone and its smallest size is 32px, which would add vertical bulk. The existing `CheckmarkCircle02Icon` is already a ringed-tick glyph, so no `DESIGN.md` rule was ever engaged. Spec amended; Task 2 keeps the existing treatment.
2. The spec said the merchant `BillingReceipt` branches would adopt `PriceLockup`. They compose from `amountLabel`, which is already a formatted currency string — `PriceLockup` prepends its own `£` and would double it. Task 9 Step 4 leaves them alone; they already satisfy the contiguous-text-node property.
3. The spec listed `AccountBillingPanelSkeleton` as needing an update. Task 9 deliberately leaves the receipt `<dl>` rhythm unchanged, so Task 10 Step 3 is conditional and expected to be skipped.
4. `CampaignStrip variant="strip"` drops `offer.termsLine`. That is a claims-safety line, so Task 6 carries it into the fine-print strip rather than losing it.

**Type consistency.** `PriceLockup({ amount, cadence, size })` is used identically in Tasks 6, 7 and 9. `PlanIncludesList({ items, columns })` identically in 6 and 7. `PlanRow({ label, value: ReactNode })` is widened in Task 9 Step 1, before its first `ReactNode` use in Step 2.

**Open verification, not assumption:** whether the sun campaign strip clears 4.5:1 contrast under axe (Task 6, Step 4) is genuinely unknown until the sweep runs. If it fails, that is a real finding to report, not to suppress.

# Landing Conversion Re-roleing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-role `/` from a 15-band offer-pack docs page into a 7-band conversion landing that sells one decision (start a free pilot), moving the research depth onto `/how-it-works`.

**Architecture:** Additive-then-subtractive migration. New landing components are built and committed unwired (Tasks 2–4), the hero and closing bands are rewritten in place (Tasks 5–6), `/how-it-works` absorbs the shed depth while `/` still renders it (Task 7), and only then does `/` strip down in one atomic commit that also re-encodes the contracts guarding it (Task 8). This ordering keeps every task green — the site never has a moment where content exists on neither page.

**Tech Stack:** Next.js App Router (server components), Tailwind v4, `node --test` for contracts/unit, Playwright for e2e/visual, existing Wet Ink design system.

**Spec:** `docs/superpowers/specs/2026-07-24-landing-conversion-reroleing-design.md`

## Global Constraints

- `lib/marketing/facts.ts` **offer** facts are unchanged — no price, guarantee, scarcity or feature copy edits. Only the new `LANDING` block is added.
- Prices must render through facts, never as literals. `tests/contracts/marketing-offer-source.test.mjs` fails any `£\d` in marketing source.
- No availability counters or countdown timers — `/spots? left|countdown|timer/i` is contract-banned in marketing source.
- No revenue or filled-tables promise in any new copy. Use the safe framing already set by `FinalCta`: _a reason to come back_, never _they will come back_.
- British English. Never render offer-framework jargon (value equation, stacks, claims boundary, engine, primary offer) on a public page.
- `scripts/check-banned-claims.mjs` scans `app/page.tsx`, `app/how-it-works`, `components/marketing` and `lib/marketing`. Avoid: `set up in minutes`, `about five minutes`, `same afternoon`, `spots left`, `counter-verified stamps`, `stops self-stamping`, `human review`.
- The SEO `<title>` and `description` on `/` stay exactly as they are. Only the `h1` changes.
- **CTA labels — do not normalise.** Header and the new hero use `Start free pilot`; pricing and close bands use `Start your free pilot`. `tests/e2e/analytics-funnel-privacy.spec.ts` selects `getByRole("link", { name: "Start free pilot" }).first()`.
- `RewardTicket`'s `headingLevel` prop accepts only `"h2" | "h3"`.
- Work on branch `feat/landing-conversion-reroleing` (already created; spec committed at `2bdb6603`).

---

## File Structure

**Create:**

- `components/marketing/landing/proof-line.tsx` — headerless four-fact row (replaces `proof-strip.tsx`)
- `components/marketing/landing/product-moment.tsx` — the page's dominant visual band
- `components/marketing/landing/fit-note.tsx` — short centred self-selection beat (replaces `venue-fit.tsx`)

**Modify:**

- `lib/marketing/facts.ts` — add the `LANDING` structural-copy block
- `components/marketing/landing/hero.tsx` — rewrite to the hero budget
- `components/marketing/landing/landing-pricing.tsx` — drop the second includes card
- `components/marketing/landing/final-cta.tsx` — drop the secondary CTA
- `components/marketing/landing/index.ts` — barrel: add 3, remove 3
- `app/page.tsx` — 15 bands → 7; drop HowTo + FAQPage schema
- `app/how-it-works/page.tsx` — absorb 4 bands; gain `faqPageSchema`
- `components/layout/marketing-layout.tsx` — footer `/#guarantees` → `/pricing#guarantees`
- `components/layout/marketing-header-nav.tsx` — nav `/#faq` → `/how-it-works#faq`
- `tests/contracts/marketing-offer-source.test.mjs` — re-encode section order; claims-boundary becomes a rule
- `tests/e2e/public-smoke.spec.ts` — `h1` assertion
- `scripts/check-jsonld.mjs` — move home HowTo/FAQPage assertions to `/how-it-works`

**Delete** (all five orphan once `/` stops rendering them — verified against the tree, not assumed):

- `components/marketing/landing/landing-nav.tsx`
- `components/marketing/landing/proof-strip.tsx` — superseded by `proof-line.tsx`
- `components/marketing/landing/venue-fit.tsx` — superseded by `fit-note.tsx`
- `components/marketing/landing/landing-guides.tsx` — rendered only by `app/page.tsx`
- `components/marketing/landing/launch-process.tsx` — rendered only by `app/page.tsx`; `/how-it-works` uses `LaunchSteps` directly

**Deliberately NOT deleted** — each keeps a real consumer after the re-role, so knip stays quiet: `GuaranteeStack` and `ScarcityBand` (`/pricing`), `FaqList` (`/pricing`), `LandingFaq` (`/how-it-works`, added in Task 7), `SnapRail` (used by `ProblemPains` and `OutcomeTransformation`), `LaunchSteps` (`/how-it-works`).

---

## Task 1: Landing structural copy in facts

**Files:**

- Modify: `lib/marketing/facts.ts` (append a new block after `TRANSFORMATION`, ~line 466)
- Test: `tests/contracts/marketing-offer-source.test.mjs`

**Interfaces:**

- Produces: `LANDING` — `{ hero: { eyebrow, headline, support, demoLink }, moment: { title, beats: readonly { caption, detail }[], closing }, fit: { title, lines: readonly string[], honest, link } }`, all `string` literals via `as const`. Tasks 2–6 consume it.

- [ ] **Step 1: Write the failing test**

Append to `tests/contracts/marketing-offer-source.test.mjs`:

```js
test("Given the conversion landing When facts.ts is inspected Then the structural copy is single-sourced and claim-safe", () => {
  const facts = readProjectFile("lib", "marketing", "facts.ts")

  assert.match(facts, /export const LANDING = \{/)
  assert.match(
    facts,
    /headline:\s*\n?\s*"Give your weekend crowd a reason to come back on a Tuesday"/,
    "the hero headline must use the safe 'a reason to come back' framing"
  )

  const landingBlock = facts.match(
    /export const LANDING = \{[\s\S]*?\n\} as const/
  )?.[0]
  assert.ok(landingBlock, "LANDING block missing")

  // The landing must never promise an outcome, only a reason to come back.
  assert.doesNotMatch(
    landingBlock,
    /will come back|guarantee|filled tables|more revenue/i,
    "landing copy must not promise a revenue or return-visit outcome"
  )
  // Three product-moment beats, one fit statement.
  assert.equal(
    landingBlock.match(/caption: "/g)?.length,
    3,
    "the product moment carries exactly three beats"
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/contracts/marketing-offer-source.test.mjs
```

Expected: FAIL — `LANDING block missing` (the `assert.match(facts, /export const LANDING = \{/)` assertion fails first).

- [ ] **Step 3: Add the LANDING block**

Insert into `lib/marketing/facts.ts` immediately after the `TRANSFORMATION` block closes (`} as const`, ~line 466) and before the `// --- The guarantee stack` comment:

```ts
// --- Landing composition copy (structural, not offer facts) -----------------

/**
 * Structural copy for the conversion landing. These are NOT offer facts — they
 * are the page's own composition: the hero's benefit headline, the three
 * product-moment beats and the fit statement. Kept here so `/` has a single
 * source and the marketing contract can assert on the voice.
 *
 * Voice rule: publican English, never offer-framework jargon, and never a
 * revenue or filled-tables promise. The headline uses the safe framing set by
 * the closing CTA — "a reason to come back", never an outcome claim.
 */
export const LANDING = {
  hero: {
    eyebrow: "Loyalty for food-led pubs",
    headline: "Give your weekend crowd a reason to come back on a Tuesday",
    support:
      "A no-app loyalty card they open from your counter QR — and we set the whole thing up for you.",
    demoLink: "or try the live card",
  },
  moment: {
    title: "This is the whole thing",
    beats: [
      {
        caption: "Scan the counter QR",
        detail: "The card opens in their browser. No app, no wallet pass.",
      },
      {
        caption: "Staff add a stamp",
        detail: "One scan at the till. Nothing to type, nothing to remember.",
      },
      {
        caption: "The mystery reward reveals",
        detail: "Drawn from a pool you set, so your margins stay yours.",
      },
    ],
    closing: "And every return visit shows up in your dashboard.",
  },
  fit: {
    title: "Built for one kind of pub",
    lines: [
      "Single-site and owner-led",
      "Serving food Tuesday to Thursday",
      "Busy at weekends, with regulars worth bringing back",
    ],
    honest:
      "If you're closed most of the week, or you want a promise of full tables, we'll tell you it's not a fit.",
    link: "See the full fit checklist",
  },
} as const
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/contracts/marketing-offer-source.test.mjs && pnpm typecheck
```

Expected: all contract tests PASS, `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/facts.ts tests/contracts/marketing-offer-source.test.mjs
git commit -m "feat(landing): add single-sourced LANDING structural copy"
```

---

## Task 2: ProofLine component

**Files:**

- Create: `components/marketing/landing/proof-line.tsx`
- Modify: `components/marketing/landing/index.ts`

**Interfaces:**

- Consumes: `OPERATOR.name`, `PRODUCT.term`, `SCARCITY.capLine` from Task 0 (pre-existing facts).
- Produces: `ProofLine()` — no props. Task 8 renders it.

- [ ] **Step 1: Create the component**

`components/marketing/landing/proof-line.tsx`:

```tsx
import { Section } from "@/components/layout"
import { OPERATOR, PRODUCT, SCARCITY } from "@/lib/marketing/facts"

/**
 * A bare fact row — deliberately headerless. Every band on the old landing
 * opened with an eyebrow + title + description; this one states four checkable
 * facts and gets out of the way. It is the page's first break in rhythm.
 */
export function ProofLine() {
  const facts = [
    `Built and run by ${OPERATOR.name}`,
    `A ${PRODUCT.term} — no app to download`,
    "Return visits shown in your dashboard",
    SCARCITY.capLine,
  ] as const

  return (
    <Section id="proof" size="compact">
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y-2 border-ink py-3">
        {facts.map((fact) => (
          <li
            key={fact}
            className="text-sm leading-6 font-bold text-foreground"
          >
            {fact}
          </li>
        ))}
      </ul>
    </Section>
  )
}
```

- [ ] **Step 2: Export it from the barrel**

In `components/marketing/landing/index.ts`, add below the existing `ProofStrip` line (both coexist until Task 9):

```ts
export { ProofLine } from "./proof-line"
```

- [ ] **Step 3: Verify it compiles and breaks no guard**

```bash
pnpm typecheck && pnpm lint components/marketing/landing/proof-line.tsx && node scripts/check-banned-claims.mjs
```

Expected: clean typecheck, no lint warnings, `✓` from the claims guard.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/landing/proof-line.tsx components/marketing/landing/index.ts
git commit -m "feat(landing): add headerless ProofLine fact row"
```

---

## Task 3: ProductMoment component

**Files:**

- Create: `components/marketing/landing/product-moment.tsx`
- Modify: `components/marketing/landing/index.ts`

**Interfaces:**

- Consumes: `LANDING.moment` (Task 1); `VenueQr({ matrix, label })` and `QrMatrix` from `./venue-qr` / `./qr-matrix`; `StampGrid({ current, total, rewardSlot, layout })` and `RewardTicket({ state, name, description })` from `@/components/loyalty`.
- Produces: `ProductMoment({ demoQr }: { demoQr: QrMatrix })`. Task 8 renders it.

**Design note:** This band must NOT repeat the hero card. Per `sample-loyalty-card.tsx`'s own comment — _"the same receipt in different states, not three lookalikes"_ — the hero shows the card whole and looping; this band disassembles that same object into the three components it is built from, at a size no other band gets.

- [ ] **Step 1: Create the component**

`components/marketing/landing/product-moment.tsx`:

```tsx
import type { ReactNode } from "react"

import { Section } from "@/components/layout"
import { RewardTicket, StampGrid } from "@/components/loyalty"
import { LANDING } from "@/lib/marketing/facts"

import type { QrMatrix } from "./qr-matrix"
import { VenueQr } from "./venue-qr"

/**
 * The page's one dominant composition. It does not repeat the hero card — it
 * shows the same receipt in a different state, disassembled into the three
 * objects it is built from (venue QR, stamp row, reward ticket) at a size no
 * other band gets. Replaces the emotional job of the old ProblemPains,
 * LaunchProcess, FeaturesListicle and OutcomeTransformation bands.
 */
export function ProductMoment({ demoQr }: { demoQr: QrMatrix }) {
  const [scan, stamp, reward] = LANDING.moment.beats

  return (
    <Section id="how" size="default">
      <h2 className="max-w-2xl text-3xl leading-tight font-extrabold text-balance text-foreground sm:text-4xl">
        {LANDING.moment.title}
      </h2>
      <div className="grid gap-8 pt-8 sm:pt-10 lg:grid-cols-3 lg:gap-10">
        <Beat caption={scan.caption} detail={scan.detail}>
          <div className="w-full max-w-[11rem]">
            <VenueQr matrix={demoQr} label="Example venue QR code" />
          </div>
        </Beat>
        <Beat caption={stamp.caption} detail={stamp.detail}>
          <StampGrid current={2} total={3} rewardSlot="locked" layout="row" />
        </Beat>
        <Beat caption={reward.caption} detail={reward.detail}>
          <RewardTicket
            state="ready"
            name="A free hot drink"
            description="Ready for staff to scan in the merchant app."
          />
        </Beat>
      </div>
      <p className="pt-8 text-lg leading-snug font-extrabold text-balance text-foreground sm:pt-10 sm:text-xl">
        {LANDING.moment.closing}
      </p>
    </Section>
  )
}

function Beat({
  caption,
  detail,
  children,
}: {
  caption: string
  detail: string
  children: ReactNode
}) {
  return (
    <div className="grid content-start gap-5">
      <div className="grid min-h-[10rem] place-items-center">{children}</div>
      <div className="grid gap-1">
        <h3 className="text-lg leading-snug font-extrabold text-foreground">
          {caption}
        </h3>
        <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export it from the barrel**

In `components/marketing/landing/index.ts`, add:

```ts
export { ProductMoment } from "./product-moment"
```

- [ ] **Step 3: Verify it compiles**

```bash
pnpm typecheck && pnpm lint components/marketing/landing/product-moment.tsx
```

Expected: clean. If `tsc` rejects the `RewardTicket` props, check `components/loyalty/reward-ticket.tsx` — `headingLevel` accepts only `"h2" | "h3"` and is not passed here, so the default `h3` applies.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/landing/product-moment.tsx components/marketing/landing/index.ts
git commit -m "feat(landing): add ProductMoment as the page's dominant band"
```

---

## Task 4: FitNote component

**Files:**

- Create: `components/marketing/landing/fit-note.tsx`
- Modify: `components/marketing/landing/index.ts`

**Interfaces:**

- Consumes: `LANDING.fit` (Task 1), `ROUTES.pubs`.
- Produces: `FitNote()` — no props, renders `id="fit"`. Task 8 renders it.

**Note:** It must keep `id="fit"` — `components/layout/marketing-layout.tsx` links the footer's "Check your pub's fit" to `/#fit`.

- [ ] **Step 1: Create the component**

`components/marketing/landing/fit-note.tsx`:

```tsx
import Link from "next/link"

import { Section } from "@/components/layout"
import { LANDING, ROUTES } from "@/lib/marketing/facts"

/**
 * One short self-selection beat. The old VenueFit rendered the full
 * qualify/disqualify tables here; those live on /loyalty-for-pubs, which
 * already renders MARKET.qualify and MARKET.disqualify in full. This band only
 * has to let the wrong pub recognise itself and leave.
 *
 * Keeps `id="fit"` — the marketing footer links to `/#fit`.
 */
export function FitNote() {
  return (
    <Section id="fit" size="dense">
      <div className="mx-auto grid max-w-2xl justify-items-center gap-5 text-center">
        <h2 className="text-2xl leading-tight font-extrabold text-balance text-foreground sm:text-3xl">
          {LANDING.fit.title}
        </h2>
        <ul className="grid gap-1.5">
          {LANDING.fit.lines.map((line) => (
            <li key={line} className="text-base leading-7 text-foreground">
              {line}
            </li>
          ))}
        </ul>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">
          {LANDING.fit.honest}
        </p>
        <Link
          href={ROUTES.pubs}
          className="focus-ring rounded-sm text-sm font-bold text-primary underline underline-offset-4"
        >
          {LANDING.fit.link}
        </Link>
      </div>
    </Section>
  )
}
```

- [ ] **Step 2: Export it from the barrel**

```ts
export { FitNote } from "./fit-note"
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint components/marketing/landing/fit-note.tsx && node scripts/check-banned-claims.mjs
```

Expected: clean, `✓` from the claims guard.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/landing/fit-note.tsx components/marketing/landing/index.ts
git commit -m "feat(landing): add FitNote self-selection beat"
```

---

## Task 5: Hero rewrite

**Files:**

- Modify: `components/marketing/landing/hero.tsx` (full rewrite)
- Modify: `tests/e2e/public-smoke.spec.ts:13-17`

**Interfaces:**

- Consumes: `LANDING.hero` (Task 1), `PRODUCT.cancelLine`, `ROUTES.demo`, `MarketingSignupLink`, `HeroSampleCard`.
- Produces: `LandingHero({ demoQr }: { demoQr: QrMatrix })` — signature unchanged, so `app/page.tsx` needs no edit yet.

- [ ] **Step 1: Update the smoke assertion to the new headline**

In `tests/e2e/public-smoke.spec.ts`, replace lines 13–17:

```ts
await expect(
  page.getByRole("heading", {
    level: 1,
    name: "Give your weekend crowd a reason to come back on a Tuesday",
  })
).toBeVisible()
```

Leave the `toHaveTitle(/First-Regular Pub Loyalty Launch/)` assertion above it **unchanged** — the `<title>` does not move.

- [ ] **Step 2: Rewrite the hero**

Replace the entire contents of `components/marketing/landing/hero.tsx`:

```tsx
import Link from "next/link"

import { MarketingSignupLink } from "@/components/analytics/marketing-signup-link"
import { Eyebrow } from "@/components/brand"
import { Section } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { LANDING, PRODUCT, ROUTES } from "@/lib/marketing/facts"

import { HeroSampleCard } from "./hero-sample-card"
import type { QrMatrix } from "./qr-matrix"

/**
 * The landing hero — one decision, one composition: brand signal, one
 * headline, one line, one CTA and one line of fine print, beside the card.
 *
 * The card is the dominant object (the column split is weighted toward it),
 * because the animated stamp journey IS the product. Everything the old
 * prospectus hero stacked here — plan line, guarantee, offer-name note,
 * operator tags, and the two research CTAs — now lives on the band or page
 * that owns it. The offer name itself moved to the pricing band's plan label.
 */
export function LandingHero({ demoQr }: { demoQr: QrMatrix }) {
  return (
    <Section
      size="default"
      className="grid items-center gap-8 pt-6 sm:pt-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-14"
    >
      <div className="grid gap-5">
        <Eyebrow>{LANDING.hero.eyebrow}</Eyebrow>
        <h1 className="max-w-xl text-4xl leading-[1.03] font-extrabold tracking-tight text-balance text-foreground sm:text-6xl">
          {LANDING.hero.headline}
        </h1>
        <p className="max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
          {LANDING.hero.support}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Button asChild size="lg">
            <MarketingSignupLink>Start free pilot</MarketingSignupLink>
          </Button>
          <Link
            className="focus-ring rounded-sm text-sm font-bold text-foreground underline underline-offset-4"
            href={ROUTES.demo}
          >
            {LANDING.hero.demoLink}
          </Link>
        </div>
        <p className="mono-id text-muted-foreground uppercase">
          {PRODUCT.cancelLine}
        </p>
      </div>
      <div className="mx-auto w-full max-w-[26rem] lg:mx-0 lg:max-w-none lg:justify-self-end">
        <HeroSampleCard qrMatrix={demoQr} />
      </div>
    </Section>
  )
}
```

- [ ] **Step 3: Verify types, lint and guards**

```bash
pnpm typecheck && pnpm lint components/marketing/landing/hero.tsx && node scripts/check-banned-claims.mjs && node --test tests/contracts/marketing-offer-source.test.mjs
```

Expected: all clean. The section-order contract still passes — `LandingHero` is still the first band on `/`.

- [ ] **Step 4: Verify the hero renders in the browser**

Start the dev server via the preview tooling (never `pnpm dev` in a Bash call), load `/`, and confirm: exactly one `h1` with the new headline, one primary button labelled `Start free pilot`, the demo text link, and the card visible in the first viewport. Check the console for errors.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/landing/hero.tsx tests/e2e/public-smoke.spec.ts
git commit -m "feat(landing): rewrite hero to one headline, one CTA, one visual"
```

---

## Task 6: Trim pricing and close bands

**Files:**

- Modify: `components/marketing/landing/landing-pricing.tsx`
- Modify: `components/marketing/landing/final-cta.tsx`

**Interfaces:**

- Consumes: `OFFER.name` (new on the pricing band), `PLAN_INCLUDES`, `PRODUCT`, `ROUTES`.
- Produces: `LandingPricing()` and `FinalCta()` — signatures unchanged.

- [ ] **Step 1: Trim the pricing band**

In `components/marketing/landing/landing-pricing.tsx`: add `OFFER` to the facts import, drop the second `<Card>` ("Every plan includes") entirely, fold four `PLAN_INCLUDES` items inline beneath the plan card, and add the offer name as the plan label. Replace the `<div className="mt-5 grid ...">` wrapper and everything inside it with:

```tsx
<div className="mt-5 grid max-w-xl gap-4 sm:mt-6">
  <Card className="border-primary">
    <CardContent className="grid content-start gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonoTag tone="accent">{PRODUCT.planName}</MonoTag>
        <MonoTag tone="sun">No setup fee</MonoTag>
      </div>
      <p className="text-sm leading-6 font-bold text-muted-foreground">
        {OFFER.name}
      </p>
      <div className="grid gap-1">
        <p className="flex items-baseline gap-2">
          <span className="text-4xl leading-none font-extrabold text-foreground">
            {PRODUCT.price}
          </span>
          <span className="text-sm font-bold text-muted-foreground">
            or {PRODUCT.priceAnnual} · {PRODUCT.annualSaving}
          </span>
        </p>
        <p className="text-sm leading-6 font-bold text-foreground">
          The done-for-you launch is included · after a {PRODUCT.pilotCardNote}.
        </p>
      </div>
      <ul className="grid gap-2.5">
        {PLAN_INCLUDES.slice(0, 4).map((item) => (
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
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="lg">
          <MarketingSignupLink>Start your free pilot</MarketingSignupLink>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href={ROUTES.pricing}>See full pricing</Link>
        </Button>
      </div>
      <p className="mono-id text-muted-foreground uppercase">
        {PRODUCT.cancelLine}
      </p>
    </CardContent>
  </Card>
</div>
```

Update the facts import line to include `OFFER`:

```tsx
import { OFFER, PLAN_INCLUDES, PRODUCT, ROUTES } from "@/lib/marketing/facts"
```

- [ ] **Step 2: Trim the closing band to one CTA**

In `components/marketing/landing/final-cta.tsx`, remove the secondary "See full pricing" button so the close carries one ask. Replace the CTA `<div>` with:

```tsx
<div className="flex flex-wrap items-center justify-center gap-3">
  <Button asChild size="lg">
    <MarketingSignupLink>Start your free pilot</MarketingSignupLink>
  </Button>
</div>
```

Then remove the now-unused `Link` and `ROUTES` imports if `tsc`/lint flags them — `ROUTES` is used only by that button, `Link` only by it too.

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint components/marketing/landing && node --test tests/contracts/marketing-offer-source.test.mjs
```

Expected: clean. The `£\d` literal guard still passes — every figure renders via `PRODUCT`.

- [ ] **Step 4: Commit**

```bash
git add components/marketing/landing/landing-pricing.tsx components/marketing/landing/final-cta.tsx
git commit -m "feat(landing): trim pricing to one card and close to one ask"
```

---

## Task 7: `/how-it-works` absorbs the shed depth

This task is purely **additive** — `/` still renders these bands too. That duplication is intentional and lasts exactly one commit, so no page is ever missing content.

**Files:**

- Modify: `app/how-it-works/page.tsx`
- Test: `tests/contracts/marketing-offer-source.test.mjs`

**Interfaces:**

- Consumes: `ProblemPains`, `FeaturesListicle`, `OutcomeTransformation`, `LandingFaq` from `@/components/marketing/landing`; `faqPageSchema` and `FAQ_ITEMS`.
- Produces: `/how-it-works` renders the FAQ and a `FAQPage` JSON-LD node. Task 8 relies on this existing.

- [ ] **Step 1: Write the failing test**

Append to `tests/contracts/marketing-offer-source.test.mjs`:

```js
test("Given the research depth moved off the landing When how-it-works is inspected Then it owns the problem, features, outcome and FAQ", () => {
  const howItWorks = readProjectFile("app", "how-it-works", "page.tsx")

  for (const section of [
    "ProblemPains",
    "FeaturesListicle",
    "OutcomeTransformation",
    "LandingFaq",
  ]) {
    assert.match(
      howItWorks,
      new RegExp(`<${section}\\b`),
      `${section} moved off the landing and must render on how-it-works`
    )
  }

  // The FAQPage node has to live somewhere — it cannot be lost in transit.
  assert.match(howItWorks, /faqPageSchema\(/)
  assert.match(howItWorks, /FAQ_ITEMS/)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/contracts/marketing-offer-source.test.mjs
```

Expected: FAIL — `ProblemPains moved off the landing and must render on how-it-works`.

- [ ] **Step 3: Add the four bands and the FAQ schema node**

In `app/how-it-works/page.tsx`:

Extend the landing-components import:

```tsx
import {
  FeaturesListicle,
  LandingFaq,
  LaunchSteps,
  OutcomeTransformation,
  ProblemPains,
} from "@/components/marketing/landing"
```

Extend the facts import to add `FAQ_ITEMS`:

```tsx
import {
  CLAIMS_BOUNDARY,
  DFY_LAUNCH,
  FAQ_ITEMS,
  GUARANTEE,
  MARKET,
  PRODUCT,
  ROUTES,
  SCARCITY,
  SETUP,
} from "@/lib/marketing/facts"
```

Extend the structured-data import to add `faqPageSchema`:

```tsx
import {
  breadcrumbSchema,
  faqPageSchema,
  howToSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"
```

Insert `<ProblemPains />` immediately after the opening `<Section>` block containing `<PageTitle .../>` and before the `<Section size="compact">` that renders `<LaunchSteps />`.

Insert `<FeaturesListicle />` and `<OutcomeTransformation />` immediately after that `<LaunchSteps />` section closes and before the `<ContrastBand>`.

Insert `<LandingFaq />` immediately after the `</ContrastBand>` and before the final `<Section>` ("Rather set it up yourself?").

In the `@graph` array, add the FAQ node after `howToSchema({...})`:

```tsx
            faqPageSchema(ROUTES.howItWorks, FAQ_ITEMS),
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test tests/contracts/marketing-offer-source.test.mjs && pnpm typecheck && node scripts/check-banned-claims.mjs
```

Expected: all PASS.

- [ ] **Step 5: Verify the page renders**

Load `/how-it-works` in the preview browser. Confirm the four new bands appear in order (problem → steps → features → outcome → catch → FAQ → self-serve), the FAQ accordions open, and the console is clean.

- [ ] **Step 6: Commit**

```bash
git add app/how-it-works/page.tsx tests/contracts/marketing-offer-source.test.mjs
git commit -m "feat(how-it-works): absorb problem, features, outcome and FAQ from the landing"
```

---

## Task 8: Strip `/` to 7 bands and re-encode its contracts

The atomic switch. The page shape and the contract guarding it change in one commit, because they are one decision.

**Files:**

- Modify: `app/page.tsx`
- Modify: `tests/contracts/marketing-offer-source.test.mjs`
- Modify: `scripts/check-jsonld.mjs:140-167`

**Interfaces:**

- Consumes: `ProofLine` (Task 2), `ProductMoment` (Task 3), `FitNote` (Task 4), rewritten `LandingHero` (Task 5), trimmed `LandingPricing`/`FinalCta` (Task 6), `/how-it-works`'s FAQ node (Task 7).

- [ ] **Step 1: Replace the section-order test with the new order plus a regression guard**

In `tests/contracts/marketing-offer-source.test.mjs`, replace the whole test named `"Given the hybrid SaaS blueprint When the landing composes sections Then they render in the conversion order"` with:

```js
test("Given the conversion re-role When the landing composes sections Then it renders seven bands and no docs-mode depth", () => {
  const landing = readProjectFile("app", "page.tsx")

  // The absorbed components are gone from the landing (their content migrated
  // into Problem/Features/Outcome/Pricing).
  for (const gone of ["OfferStack", "ValueEquation", "BonusStack"]) {
    assert.doesNotMatch(
      landing,
      new RegExp(`<${gone}\\b`),
      `${gone} was absorbed and must not render on the landing`
    )
  }

  // The conversion order: orient -> motion -> proof -> product -> fit ->
  // price -> close. Seven bands, one decision.
  const order = [
    "LandingHero",
    "Marquee",
    "ProofLine",
    "ProductMoment",
    "FitNote",
    "LandingPricing",
    "FinalCta",
  ]
  let cursor = -1
  for (const section of order) {
    const at = landing.indexOf(`<${section}`)
    assert.ok(at > -1, `landing must render <${section}`)
    assert.ok(
      at > cursor,
      `${section} must appear after the previous conversion band`
    )
    cursor = at
  }

  // The regression guard: the offer pack must not creep back onto the root.
  // Each of these owns a spoke page now (see the 2026-07-24 re-role spec).
  const docsMode = [
    "LandingNav",
    "ProblemPains",
    "LaunchProcess",
    "FeaturesListicle",
    "VenueFit",
    "OutcomeTransformation",
    "GuaranteeStack",
    "ScarcityBand",
    "LandingGuides",
    "LandingFaq",
  ]
  for (const section of docsMode) {
    assert.doesNotMatch(
      landing,
      new RegExp(`<${section}\\b`),
      `${section} is research depth — it belongs on its spoke page, not on /`
    )
  }

  // Hero budget: exactly one primary signup CTA in the first viewport.
  const hero = readProjectFile("components", "marketing", "landing", "hero.tsx")
  assert.equal(
    hero.match(/<MarketingSignupLink/g)?.length,
    1,
    "the hero carries exactly one signup CTA"
  )

  // The landing sheds the HowTo and FAQPage nodes with their visible mirrors.
  assert.doesNotMatch(landing, /howToSchema\(/)
  assert.doesNotMatch(landing, /faqPageSchema\(/)
})
```

- [ ] **Step 2: Replace the claims-boundary test with a rule**

Replace the whole test named `"Given the claims boundary When key surfaces are inspected Then the guarantee stack and boundary render from shared facts"` with:

```js
test("Given the claims boundary When any surface names a guarantee Then that same surface renders the boundary", () => {
  // The rule, not a fixed page list: naming a guarantee obliges a surface to
  // render its limits. `/` passes by claiming nothing; /pricing and
  // /how-it-works pass by rendering both. Any future surface is caught too.
  const offenders = []

  for (const file of marketingSourceFiles()) {
    const source = readFileSync(path.join(projectRoot, file), "utf8")
    const namesGuarantee = /\bGUARANTEE(_ROI)?\b/.test(source)
    const rendersBoundary = /\bCLAIMS_BOUNDARY\b/.test(source)

    // Composition-only files that pass a guarantee through without naming it
    // to the reader are exempt; this checks source references, which is the
    // conservative reading.
    if (namesGuarantee && !rendersBoundary) offenders.push(file)
  }

  // KNOWN PRE-EXISTING GAP, not introduced by the re-role: the three guide
  // pages print "<GUARANTEE.name>: <GUARANTEE.line>" in their closing CTA
  // without the boundary beside it. The new rule catches it; closing it is
  // tracked separately because it edits three indexed pages' copy, which is
  // outside this change's approved scope. Do not widen this list to silence a
  // NEW offender — fix the file instead.
  assert.deepEqual(
    offenders,
    [
      "components/marketing/guides/guide-page.tsx",
      "components/marketing/guides/guides-data.ts",
    ],
    "every surface naming a guarantee must also render CLAIMS_BOUNDARY"
  )

  // The boundary still renders where the guarantee is actually explained.
  const guaranteeStack = readProjectFile(
    "components",
    "marketing",
    "landing",
    "guarantee-stack.tsx"
  )
  assert.match(guaranteeStack, /CLAIMS_BOUNDARY/)
  assert.match(guaranteeStack, /GUARANTEE_ROI/)
  assert.match(readProjectFile("app", "pricing", "page.tsx"), /GuaranteeStack/)
  assert.match(
    readProjectFile("components", "marketing", "persona-page.tsx"),
    /CLAIMS_BOUNDARY/
  )
})
```

**Why the expected list has exactly two entries:** it was computed against the tree, not guessed. Today three files trip the rule — `guides/guide-page.tsx`, `guides/guides-data.ts`, and `landing/hero.tsx`. Task 5 removes the guarantee from the hero, leaving the two guide files. `final-cta.tsx` does _not_ trip it: it renders `OFFER.riskFraming`, which never names `GUARANTEE`.

If the assertion fails with a different list, do not edit the expected array to match. A new entry means a file you touched now names a guarantee without its limits — fix that file.

- [ ] **Step 3: Run the contract to verify it fails**

```bash
node --test tests/contracts/marketing-offer-source.test.mjs
```

Expected: FAIL — `landing must render <ProofLine` (the page still has the old 14 bands).

- [ ] **Step 4: Rewrite the landing page**

Replace the imports and the component body of `app/page.tsx`. The `metadata` block above stays **byte-identical** — the `<title>` and `description` do not move.

```tsx
import type { Metadata } from "next"

import { MarketingLayout } from "@/components/layout"
import { Marquee } from "@/components/marketing"
import {
  buildQrMatrix,
  FinalCta,
  FitNote,
  LandingHero,
  LandingPricing,
  ProductMoment,
  ProofLine,
} from "@/components/marketing/landing"
import { JsonLd } from "@/components/seo/json-ld"
import { PRODUCT, ROUTES } from "@/lib/marketing/facts"
import {
  absoluteUrl,
  growthPlanSchema,
  OG_IMAGE,
  webPageSchema,
} from "@/lib/seo/structured-data"
```

Note the removed imports: `DFY_LAUNCH`, `FAQ_ITEMS`, `faqPageSchema`, `howToSchema`, and the nine docs-mode components.

Replace the component body:

```tsx
export default function LandingPage() {
  const demoQr = buildQrMatrix(absoluteUrl(ROUTES.demo))

  return (
    <MarketingLayout>
      <LandingHero demoQr={demoQr} />
      <Marquee />
      <ProofLine />
      <ProductMoment demoQr={demoQr} />
      <FitNote />
      <LandingPricing />
      <FinalCta />
      <JsonLd
        id="ld-home"
        data={{
          "@context": "https://schema.org",
          "@graph": [
            webPageSchema({ path: ROUTES.home, title, description }),
            growthPlanSchema(),
          ],
        }}
      />
    </MarketingLayout>
  )
}
```

- [ ] **Step 5: Move the home HowTo/FAQPage JSON-LD assertions to how-it-works**

In `scripts/check-jsonld.mjs`, the home block (lines ~140–167) asserts the home graph carries a `FAQPage` and a five-step `HowTo`. Both moved. Replace the two `check(...)` calls for `faq` and `howTo` — and the `const faq` / `const howTo` lines above them — so the home block keeps only WebPage / Organization / Product / no-Person, then add a how-it-works block after it:

```js
const howItWorksNodes = await fetchNodes(baseUrl, "/how-it-works")
const howItWorksFaq = howItWorksNodes.find(
  (node) => node["@type"] === "FAQPage"
)
const howItWorksHowTo = howItWorksNodes.find(
  (node) => node["@type"] === "HowTo"
)

check(
  Boolean(howItWorksFaq) &&
    Array.isArray(howItWorksFaq.mainEntity) &&
    howItWorksFaq.mainEntity.length >= 5,
  "how-it-works: FAQPage with the shared FAQ facts missing"
)
check(
  Boolean(howItWorksHowTo) &&
    Array.isArray(howItWorksHowTo.step) &&
    howItWorksHowTo.step.length === 5,
  "how-it-works: five-step done-for-you HowTo missing"
)
```

Update the success message on the final `console.log` to say `home marketing graph (WebPage, Product 49/490)` and `how-it-works graph (five-step HowTo, FAQPage)`.

- [ ] **Step 6: Run the full non-browser suite**

```bash
pnpm typecheck && pnpm test && node scripts/check-banned-claims.mjs
```

Expected: `tsc` clean; all contract and unit tests PASS; claims guard `✓`.

- [ ] **Step 7: Verify both pages render and the JSON-LD guard passes**

Load `/` in the preview browser: seven bands, no TOC, no accordions, no `01`/`02` rows. Then run the live JSON-LD guard (it boots its own server):

```bash
pnpm jsonld:check
```

Expected: `✓ JSON-LD valid` with the updated message.

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx tests/contracts/marketing-offer-source.test.mjs scripts/check-jsonld.mjs
git commit -m "feat(landing): strip / to seven conversion bands

The landing sheds its offer-pack depth to /how-it-works, which already owned
the HowTo node and now owns the FAQPage node too. The section-order contract
is re-encoded to the new order and gains a negative assertion so the nine
docs-mode bands cannot creep back onto the root.

The claims-boundary contract becomes a rule — any surface naming a guarantee
must render CLAIMS_BOUNDARY — instead of hardcoding GuaranteeStack onto /.
/ now passes by claiming nothing."
```

---

## Task 9: Delete orphaned components and repoint links

**Files:**

- Delete: `components/marketing/landing/` — `landing-nav.tsx`, `proof-strip.tsx`, `venue-fit.tsx`, `landing-guides.tsx`, `launch-process.tsx`
- Modify: `components/marketing/landing/index.ts`
- Modify: `components/layout/marketing-layout.tsx:36`
- Modify: `components/layout/marketing-header-nav.tsx:14`

- [ ] **Step 1: Confirm nothing else imports them**

```bash
grep -rn "LandingNav\|ProofStrip\|VenueFit\|LandingGuides\|LaunchProcess" app components lib tests scripts
```

Expected: matches only in `components/marketing/landing/index.ts` and the five files themselves. If anything else matches, stop and report it — do not delete.

Note `LaunchProcess` and `LaunchSteps` are different components: only `LaunchProcess` (the wrapper) dies. `LaunchSteps` is rendered directly by `/how-it-works` and must survive.

- [ ] **Step 2: Delete the five files and their barrel exports**

```bash
git rm components/marketing/landing/landing-nav.tsx components/marketing/landing/proof-strip.tsx components/marketing/landing/venue-fit.tsx components/marketing/landing/landing-guides.tsx components/marketing/landing/launch-process.tsx
```

Then remove these five lines from `components/marketing/landing/index.ts`:

```ts
export { LandingNav } from "./landing-nav"
export { ProofStrip } from "./proof-strip"
export { VenueFit } from "./venue-fit"
export { LandingGuides } from "./landing-guides"
export { LaunchProcess } from "./launch-process"
```

- [ ] **Step 3: Repoint the footer guarantees link**

In `components/layout/marketing-layout.tsx`, in the `"For food-led pubs"` footer column, change the guarantees entry (the `/#guarantees` anchor no longer exists on `/`):

```tsx
      { href: `${ROUTES.pricing}#guarantees`, label: "Guarantees and conditions" },
```

Leave `{ href: \`${ROUTES.home}#fit\`, label: "Check your pub's fit" }`**unchanged** —`FitNote`keeps`id="fit"`.

- [ ] **Step 4: Repoint the header FAQ link**

In `components/layout/marketing-header-nav.tsx`, change the FAQ nav item (the `/#faq` anchor no longer exists on `/`):

```tsx
  { href: `${ROUTES.howItWorks}#faq`, label: "FAQ" },
```

- [ ] **Step 5: Verify no dead code and no broken links**

```bash
pnpm typecheck && pnpm lint && pnpm deadcode:check && pnpm test
```

Expected: `tsc` clean, lint clean, knip reports no unused files/exports from the landing directory, all tests PASS.

If knip flags anything beyond the five deleted files, do not delete it reflexively — check its consumer first. `SnapRail`/`SnapRailItem` (used by `ProblemPains` and `OutcomeTransformation`), `LandingFaq`, and `LaunchSteps` should all be reachable via `/how-it-works`; `FaqList`, `GuaranteeStack` and `ScarcityBand` via `/pricing`. A knip hit on any of those means a Task 7 import was missed — fix the import, don't delete the component.

- [ ] **Step 6: Commit**

```bash
git add -A components/marketing/landing components/layout
git commit -m "refactor(landing): delete orphaned docs-mode components, repoint anchors"
```

---

## Task 10: Baselines and full verification

**Files:**

- Modify: `tests/e2e/visual.spec.ts-snapshots/marketing-landing-*.png` (darwin only)
- Modify: `tests/e2e/visual.spec.ts-snapshots/marketing-how-it-works-*.png` (darwin only)

- [ ] **Step 1: Run the browser suites to see what actually breaks**

```bash
pnpm test:e2e
```

Expected failures, and only these: `marketing-landing` and `marketing-how-it-works` visual snapshot mismatches. Any _functional_ failure — smoke, a11y, analytics funnel — means a real defect. Fix it before regenerating any baseline; a regenerated baseline hides a bug permanently.

- [ ] **Step 2: Confirm the funnel test still passes**

```bash
node scripts/run-playwright.mjs --grep "signup continuity"
```

Expected: PASS. This proves the `Start free pilot` label contract held.

- [ ] **Step 3: Regenerate the darwin visual baselines**

```bash
node scripts/run-playwright.mjs --grep @visual --update-snapshots
```

- [ ] **Step 4: Review every regenerated PNG by eye before staging**

Open each changed `marketing-landing-*.png` and `marketing-how-it-works-*.png`. Confirm the landing shows seven bands with no TOC/accordions/`01`-rows, and that nothing is blank, clipped, or missing its QR (a cold-compile race can render a blank QR box — re-run if so).

- [ ] **Step 5: Run every non-browser gate**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm tokens:check && node scripts/check-banned-claims.mjs && pnpm jsonld:check && pnpm deadcode:check
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/visual.spec.ts-snapshots
git commit -m "test(visual): re-bless darwin landing and how-it-works baselines"
```

- [ ] **Step 7: Report the owner-owed follow-ups**

The `-linux` baseline twins **cannot be rendered on darwin**. Report to the user that CI will go red on the linux visual shards until the twins are blessed from CI actual PNGs, per the established runbook — this needs their action, and it is expected, not a defect.

---

## Verification: issue coverage

| #   | Issue                                | Task              |
| --- | ------------------------------------ | ----------------- |
| 1   | ~15 stacked sections                 | 8                 |
| 2   | Offer pack serialised as homepage    | 7, 8              |
| 3   | Wrong primary job for `/`            | 5, 8              |
| 4   | Trust/SEO depth owns the scroll      | 7                 |
| 5   | `LandingNav` TOC                     | 8, 9              |
| 6   | "Choose what you need"               | 9 (file deleted)  |
| 7   | Guides "Research the approach"       | 8                 |
| 8   | `LaunchProcess` as visible HowTo     | 8 (schema + band) |
| 9   | `FeaturesListicle` semantic listicle | 7, 8              |
| 10  | FAQ + HowTo + guides on one URL      | 7, 8              |
| 11  | Hero is a prospectus dump            | 5                 |
| 12  | No signup CTA in hero                | 5                 |
| 13  | Research CTAs primary                | 5                 |
| 14  | Fails hero budget                    | 5                 |
| 15  | Docs UI patterns                     | 2, 3, 4, 9        |
| 16  | Same rhythm repeated                 | 2, 3, 4           |
| 17  | No compositional variety             | 3                 |
| 18  | Signup deferred                      | 5                 |
| 19  | Competing mid-page jobs              | 8                 |
| 20  | Structural docs copy                 | 1                 |

# Landing page re-roleing: offer-pack docs page → conversion landing

**Date:** 2026-07-24
**Status:** Approved for planning (pending user review of this spec)
**Scope:** `app/page.tsx` and its landing components; the depth it sheds onto `app/how-it-works/page.tsx`; the marketing contracts and smoke assertions that pin both
**Out of scope:** `lib/marketing/facts.ts` offer facts (prices, guarantees, scarcity, features — content unchanged), the Wet Ink design system, `/pricing`, `/loyalty-for-*` spokes, `/guides/*`, a new `/guides` index page, auth or app surfaces

---

## 1. Problem

`/` is the finalised offer pack serialised into 15 stacked sections. It explains every objection, condition and inclusion so a visitor — or a crawler — can research the entire offer without leaving the page. That is excellent trust copy and the wrong primary job for the site root.

The audit ([`landing-page-docs-feel-audit`](../../../.cursor/projects/Users-amankumarshrestha-LapenInns-Project-Nabaperks/canvases/landing-page-docs-feel-audit.canvas.tsx)) names 20 defects across four groups:

1. **Information architecture** (1–4) — ~15 stacked bands, offer-pack ordering, wrong primary job, trust/SEO depth owning the scroll
2. **Explicit docs chrome** (5–7) — an "On this page" TOC, "Choose what you need", guides titled "Research the approach before you start"
3. **SEO-first section design** (8–10) — `LaunchProcess` mirrored as a visible HowTo, `FeaturesListicle` as a full semantic listicle, FAQ + HowTo + guides all on one URL
4. **Hero and first viewport** (11–14) — a prospectus dump with no signup CTA and two research CTAs
5. **UI vernacular** (15–17) — docs patterns everywhere, one repeated section rhythm, no compositional variety
6. **Conversion flow** (18–20) — signup deferred to mid-page, ~12 competing mid-page jobs, structural copy encoding the docs job

The Wet Ink look is intact. The information architecture and the first-viewport job are what break the landing feel.

### What the audit could not see

Two findings from reading the code change the risk calculus, and this spec depends on both:

- **The depth is already duplicated on its canonical page.** `/how-it-works` renders the same `LaunchSteps` _and_ its own `howToSchema`. `/pricing` renders `GuaranteeStack`, `ScarcityBand`, plan includes, the value maths _and_ its own `faqPageSchema`. `/loyalty-for-pubs` renders the qualify/disqualify rules and the claims boundary. Removing these bands from `/` is **de-duplication, not content loss** — the structured-data nodes survive on their canonical URLs.
- **The dominant product moment already exists.** `HeroSampleCard` composes `useStampJourneyLoop` with `RewardTicket`'s sealed→ready states — an animated scan → stamp → reward reveal. It is currently boxed into a `max-w-[21rem]` column beside a wall of prospectus text. This redesign gives it room; it does not invent it.

---

## 2. Goals and constraints

### Goals

- `/` sells **one decision**: start a free pilot
- 15 bands → **7**; ~12 mid-page jobs → 6
- Hero budget: brand signal + one headline + one line + one CTA + one visual
- Signup CTA **in the first viewport**, not mid-page
- No band repeats another band's composition
- Every shed band lands on a page that already owns its topic, with its structured-data node intact
- Contracts re-encode the new intent and **guard against regression**, rather than being deleted

### Constraints

- `lib/marketing/facts.ts` offer facts are unchanged — no price, guarantee, scarcity or feature copy edits
- Wet Ink system only; no new design tokens
- British English; customer voice only — never offer-framework jargon (value equation, stacks, claims boundary, engine, primary offer) on a public page
- No revenue or filled-tables promise in any new copy
- Prices render through facts, never as literals (`£\d` is contract-banned in marketing source)
- No availability counters or countdown timers (contract-banned)
- The SEO `<title>` and `description` on `/` stay exactly as they are

### Non-goals

- A `/guides` index page — that would re-create a research hub
- Rewriting offer copy, pricing, or the guarantee stack
- Changing the signup funnel or its analytics milestones
- Deleting the docs-mode components from the codebase (they move, they don't die)

---

## 3. The new `/` — 7 bands

| #   | Band           | Component                           | Composition                                            | Text jobs                                                        |
| --- | -------------- | ----------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| 1   | Hero           | `LandingHero` (rewritten)           | Asymmetric; the card is the dominant object, scaled up | eyebrow · h1 · 1 line · 1 CTA · 1 quiet link · 1 fine-print line |
| 2   | Marquee        | `Marquee` (unchanged)               | Motion strip                                           | 0                                                                |
| 3   | Proof line     | `ProofLine` (replaces `ProofStrip`) | Bare horizontal row, **no section header**             | 4 short facts                                                    |
| 4   | Product moment | `ProductMoment` (new)               | Visual-dominant; largest band on the page              | 3 captions + 1 closing line                                      |
| 5   | Fit beat       | `FitNote` (replaces `VenueFit`)     | Short centred statement                                | 3 lines + 1 honest line + 1 link                                 |
| 6   | Pricing        | `LandingPricing` (trimmed)          | One plan card                                          | price · 4 includes · CTA · cancel line                           |
| 7   | Close          | `FinalCta` (trimmed)                | Centred receipt                                        | headline · 1 line · 1 CTA                                        |

### Band 1 — Hero

**Removed:** `OFFER.name` as `h1`, `OFFER.audience` + `DFY_LAUNCH.intro` paragraph, the "Check your pub's fit" CTA, the "See how the launch works" CTA, the operator line, the three `MonoTag`s, `PLAN_LINE`, `GUARANTEE.name` + `GUARANTEE.line`, `OFFER.nameNote`.

**Kept and enlarged:** `HeroSampleCard` with its stamp-journey loop, released from `max-w-[21rem]`.

**Added:** one `Start free pilot` primary button via `MarketingSignupLink` (so the `merchant_signup_clicked` milestone still fires), and a quiet text link to the live card.

The offer name is not lost — it becomes the **plan label in band 6**, so the page and its `<title>` stay coherent without the hero carrying it.

Closes issues **11, 12, 13, 14, 18**.

### Band 3 — Proof line

`ProofStrip` today is a `SectionHeader` (eyebrow + title + description) over a four-column card grid of `MonoTag` + fact. It becomes a single bare row of four short facts — operator, no app, measurement, honest cap — with no section header at all. This is the first break in the repeated rhythm.

### Band 4 — Product moment

The page's one dominant composition, and the band that absorbs the emotional job of `ProblemPains`, `LaunchProcess`, `FeaturesListicle` and `OutcomeTransformation`.

**It does not repeat the hero card.** It shows the _same receipt in a different state_ — the design intent already written into `sample-loyalty-card.tsx`:

> one object reused across the landing page so the hero, the proof shape, and the reward reveal are the _same_ receipt in different states, not three lookalikes

So the hero shows the card whole and looping; the product moment disassembles that same object into its three beats using the components it is already built from — `VenueQr` (scan), `StampGrid` (stamp), `RewardTicket` in its sealed→ready reveal (reward) — at a size no other band on the page gets.

Three short captions annotate the beats; one closing line carries the merchant-side payoff. No `01`/`02` numbering, no dashed borders, no `MonoTag`s, no `IconRoundel` step chips.

### Band 5 — Fit beat

`VenueFit`'s two-column qualify/disqualify table becomes a short centred statement: who it's built for in three lines, one honest turn-away line, and a link to the full checklist on `/loyalty-for-pubs` (which already renders `MARKET.qualify` / `MARKET.disqualify` in full).

Keeps the `#fit` anchor id, so the existing footer link does not break.

### Band 6 — Pricing

Drops the second "Every plan includes" card; folds four `PLAN_INCLUDES` items inline under the plan card. Keeps the price, the `Start your free pilot` CTA, the "See full pricing" secondary link and `PRODUCT.cancelLine`. Gains `OFFER.name` as the plan label.

### Deleted from `/`

`LandingNav`, `ProblemPains`, `LaunchProcess`, `FeaturesListicle`, `OutcomeTransformation`, `GuaranteeStack`, `ScarcityBand`, `LandingGuides`, `LandingFaq`.

Closes issues **1, 2, 3, 4, 5, 6, 7, 19**.

---

## 4. Where the depth goes

### `/how-it-works` grows 4 bands → 8

It becomes the deliberate research destination — the page whose job _is_ to let someone read the whole offer.

| Band                                  | Source             |
| ------------------------------------- | ------------------ |
| PageTitle                             | existing           |
| `ProblemPains`                        | **moved from `/`** |
| `LaunchSteps` + `DFY_LAUNCH.yourPart` | existing           |
| `FeaturesListicle`                    | **moved from `/`** |
| `OutcomeTransformation`               | **moved from `/`** |
| Claims-boundary `ContrastBand`        | existing           |
| `LandingFaq` (full `FAQ_ITEMS`)       | **moved from `/`** |
| Self-serve + CTA                      | existing           |

### Structured data

| Node               | Today                       | After                              |
| ------------------ | --------------------------- | ---------------------------------- |
| `webPageSchema`    | `/` and `/how-it-works`     | unchanged                          |
| `growthPlanSchema` | `/`                         | unchanged                          |
| `howToSchema`      | `/` **and** `/how-it-works` | `/how-it-works` only               |
| `faqPageSchema`    | `/` **and** `/pricing`      | `/how-it-works` **and** `/pricing` |

Removing the HowTo and FAQPage nodes from `/` also removes the reason `LaunchProcess` and `FeaturesListicle` existed in visible form at all — those components were built to give the JSON-LD visible parity. With the nodes gone from `/`, the visible mirrors go with them.

Closes issues **8, 9, 10**.

### Guides

The three guide cards leave `/`. They remain reachable from the footer's Guides column and from `public/llms.txt`, which lists all three URLs directly. No `/guides` index page is created.

---

## 5. UI vernacular purge

Banned on `/` after this change:

- Mono `01` / `02` numbering
- `MonoTag` rows
- Dashed-border list items
- `ReceiptCard` as a content container
- `<details>` accordions
- Qualify / disqualify tables
- Guide cards
- In-page TOC / jump nav

Kept: the Wet Ink identity — ink borders, the accent, hard offset shadows, the type scale, `IconRoundel` where it earns its place.

### Rhythm

Today **every** band on `/` is `SectionHeader` (eyebrow + title + description) followed by a dense list. After this change only **2 of 7** bands use `SectionHeader`:

| Band           | Composition                            |
| -------------- | -------------------------------------- |
| Hero           | asymmetric two-column, visual-weighted |
| Marquee        | motion strip                           |
| Proof line     | bare row, no header                    |
| Product moment | visual-dominant, caption-annotated     |
| Fit beat       | short centred statement                |
| Pricing        | single card                            |
| Close          | centred receipt                        |

Closes issues **15, 16, 17**.

---

## 6. New copy

Offer facts are unchanged. The new structural copy below is added as a `LANDING` block in `lib/marketing/facts.ts`, matching the existing `PROBLEM` / `TRANSFORMATION` pattern so it stays single-sourced and contract-assertable.

**CTA labels — do not "tidy" these.** Two labels coexist today and both must survive: the header and the new hero use `Start free pilot`; the pricing and close bands use `Start your free pilot`. `tests/e2e/analytics-funnel-privacy.spec.ts` selects `getByRole("link", { name: "Start free pilot" }).first()`, so renaming either one breaks the funnel test.

### Hero

- **Eyebrow:** `Loyalty for food-led pubs`
- **h1:** `Give your weekend crowd a reason to come back on a Tuesday`
- **Support line:** `A no-app loyalty card they open from your counter QR — and we set the whole thing up for you.`
- **Primary CTA:** `Start free pilot`
- **Quiet link:** `or try the live card` → `ROUTES.demo`
- **Fine print:** `PRODUCT.cancelLine`

The h1 uses the safe framing already established by `FinalCta` — _a reason to come back_, never _they will come back_. It makes no revenue or filled-tables claim, so `/` needs no claims boundary (see §7).

### Product moment

- **Title:** `This is the whole thing`
- **Captions:** `Scan the counter QR` · `Staff add a stamp` · `The mystery reward reveals`
- **Closing line:** `And every return visit shows up in your dashboard.`

### Fit beat

- **Title:** `Built for one kind of pub`
- **Lines:** drawn from `MARKET.profileLine` and shortened `MARKET.qualify` entries
- **Honest line:** `If you're closed most of the week, or you want a promise of full tables, we'll tell you it's not a fit.`
- **Link:** `See the full fit checklist` → `ROUTES.pubs`

Closes issue **20**.

---

## 7. Contract and test changes

Contracts are **rewritten to encode the new intent**, never deleted.

### `tests/contracts/marketing-offer-source.test.mjs`

**Section-order test** (currently pins 14 components in offer-pack order):

- Re-encode as the new 7-band conversion order
- Add a **negative assertion**: the nine docs-mode components must not render on `/`. This is the guard that stops the offer pack creeping back onto the root.
- Add a hero-budget assertion: `/`'s hero renders exactly one primary signup CTA.

**Claims-boundary test** (currently hardcodes "`GuaranteeStack` must be on `/`"):

Rewrite as a rule rather than a fixed page list:

> Any marketing surface that renders `GUARANTEE` or `GUARANTEE_ROI` must also render `CLAIMS_BOUNDARY`.

`/` renders neither, so it passes honestly. `/pricing` and `/how-it-works` render both, so the boundary stays enforced where the claim is actually made. This is **stricter** than the current fixed list, because it also catches any _future_ surface that introduces a guarantee without its boundary.

**New assertion:** `/how-it-works` must render the FAQ and its `faqPageSchema`, so the node cannot be lost in transit.

### `tests/e2e/public-smoke.spec.ts`

The `h1` assertion at line 13 currently pins the literal `"The 30-Day First-Regular Launch"`. Update to the new benefit headline. The `toHaveTitle(/First-Regular Pub Loyalty Launch/)` assertion is **unchanged** — the `<title>` does not move.

### `tests/e2e/analytics-funnel-privacy.spec.ts`

Clicks `link` named `"Start free pilot"` and expects `merchant_signup_clicked`. The new hero CTA uses that exact label via `MarketingSignupLink`, so this test keeps passing — and now exercises a first-viewport CTA rather than the header's.

### Link repointing

| Link                               | Today          | After                                     |
| ---------------------------------- | -------------- | ----------------------------------------- |
| Footer "Check your pub's fit"      | `/#fit`        | unchanged — the fit beat keeps `id="fit"` |
| Footer "Guarantees and conditions" | `/#guarantees` | `/pricing#guarantees`                     |
| Header nav "FAQ"                   | `/#faq`        | `/how-it-works#faq`                       |

---

## 8. Visual baselines

`marketing-landing` and `marketing-how-it-works` baselines are invalidated across 5 browsers × 2 platforms = **20 PNGs**.

The darwin set regenerates locally. The `-linux` twins **cannot be rendered on darwin** and must be blessed from CI actual PNGs, per the established runbook — this needs an owner action after CI runs.

---

## 9. Issue coverage

| #   | Issue                                | Closed by                       |
| --- | ------------------------------------ | ------------------------------- |
| 1   | ~15 stacked sections                 | §3 — 7 bands                    |
| 2   | Offer pack serialised as homepage    | §3, §4                          |
| 3   | Wrong primary job for `/`            | §3 — one decision               |
| 4   | Trust/SEO depth owns the scroll      | §4 — moved to `/how-it-works`   |
| 5   | `LandingNav` TOC                     | §3 — deleted                    |
| 6   | "Choose what you need"               | §3 — deleted with `LandingNav`  |
| 7   | Guides "Research the approach"       | §4 — guides leave `/`           |
| 8   | `LaunchProcess` as visible HowTo     | §4 — HowTo node moves           |
| 9   | `FeaturesListicle` semantic listicle | §4 — moves to `/how-it-works`   |
| 10  | FAQ + HowTo + guides on one URL      | §4 — all three leave `/`        |
| 11  | Hero is a prospectus dump            | §3 band 1                       |
| 12  | No signup CTA in hero                | §3 band 1                       |
| 13  | Research CTAs primary                | §3 band 1                       |
| 14  | Fails hero budget                    | §3 band 1                       |
| 15  | Docs UI patterns                     | §5 — purge list                 |
| 16  | Same rhythm repeated                 | §5 — 2 of 7 use `SectionHeader` |
| 17  | No compositional variety             | §5 — 7 distinct compositions    |
| 18  | Signup deferred                      | §3 band 1                       |
| 19  | Competing mid-page jobs              | §3 — 6 jobs                     |
| 20  | Structural docs copy                 | §6 — rewritten                  |

---

## 10. Accepted risks

- **The `h1` no longer matches the `<title>` verbatim.** The `<title>` is deliberately unchanged so the ranking signal is stable, but `h1` ≠ `title` is a change on a site whose SEO was tuned deliberately. Normal and generally fine; recorded here because it was a conscious call.
- **`/how-it-works` inherits the docs feel.** That is the intent — it is a research page — but the docs-mode UI patterns survive there rather than being deleted from the codebase. If `/how-it-works` later reads as bloated, that is a separate piece of work.
- **`/` loses long-tail answer-engine surface.** `/` stops carrying HowTo, FAQPage and the full feature listicle. Those nodes survive on `/how-it-works` and `/pricing`, but they now sit on lower-authority URLs than the root. This is the deliberate trade the re-role is buying.

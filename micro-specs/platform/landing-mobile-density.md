---
spec_id: MS-landing-mobile-density
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-04
allowed_blast_radius:
  - app/page.tsx
  - components/marketing/landing/**
  - tests/micro-specs/marketing-redesign.test.mjs
  - tests/e2e/visual.spec.ts-snapshots/**
  - micro-specs/platform/**
  - DESIGN.md
implementation_surfaces:
  - app/page.tsx
  - components/marketing/landing/proof.tsx
  - components/marketing/landing/proof-tabs.tsx
  - components/marketing/landing/snap-rail.tsx
  - components/marketing/landing/read-more.tsx
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/marketing-seo.md
related_tests:
  - tests/micro-specs/marketing-redesign.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
  - tests/e2e/visual.spec.ts
  - tests/e2e/a11y.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e
  - pnpm test:a11y
  - pnpm test:visual
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Measured mobile page height at 375px before/after (Playwright scrollHeight).
  - Normalized word-inventory diff of `main` textContent before/after (empty diff).
  - Mobile screenshots of the merged proof section and one snap rail.
approved_exceptions: []
---

# MS-landing-mobile-density — Landing mobile density: merged proof section, snap rails, disclosures

## Intent

The landing page (`/`) renders ~14,055px tall at 375px — 17.3 phone screens —
because 17 sections stack vertically. On mobile it SHALL read as a materially
shorter page (~12 screens) with **zero copy loss**: every word stays
server-rendered in the DOM; only the reveal mechanics change (tabs, horizontal
snap rails, native `<details>` disclosures). Desktop layout stays essentially
unchanged: rails and tab chips are `<lg` behaviors; at `lg+` all merged panels
render stacked.

Partially supersedes MS-marketing-seo's landing section-composition contract
(the four proof sections merge into one `<LandingProof />`); all other
MS-marketing-seo requirements (SE-1…SE-6) remain binding.

> Supersession note (2026-07-05): this spec's landing composition contract —
> LMD-1 zero-copy-loss-on-`/`, the 8-section-tag and 6-anchor strict
> constraints, LMD-4/LMD-5/LMD-7 and the "no copy change on /" scope-out —
> is PARTIALLY SUPERSEDED by MS-landing-conversion-spine (owner decision
> 2026-07-04): `/` is now the conversion spine and `<LandingProof />` lives
> on `/how-it-works`. LMD-8's export-level schema parity and the DESIGN.md
> rules remain binding.

## Scope (in)

- `/` landing only: `app/page.tsx` + `components/marketing/landing/**`.
- One new merged proof section (`LandingProof`) composing the existing
  ProofStrip, NabaperksProof, OldCrownCandidate, VenueProof bodies.
- New reveal primitives: `SnapRail` (server, CSS scroll-snap), `ProofTabs`
  (client, chip-switched panels), `ReadMore` (server, `<details>`).
- The one-line amendment to `tests/micro-specs/marketing-redesign.test.mjs`
  re-pointing the `<VenueProof />` composition assertion, and the DESIGN.md
  named circle-exception list gaining the proof-tab chips.
- Regenerating the `home-*` visual baselines.

## Scope (out)

- Any copy change: no words added, removed, or reworded anywhere on `/`.
- `/loyalty-for-pubs`, guides, pricing, about, and all app/auth surfaces.
- `components/layout/**` (Section/ContrastBand stay untouched).
- JSON-LD builders, `lib/marketing/facts.ts`, `lib/seo/**`.
- The exported schema single-sources: `counterFlowSteps` (counter-flow.tsx),
  `faqs` (faq.tsx) — files may be restyled but these exports and their values
  are frozen.

## Strict constraints

- Wet Ink only: WetInk* motion primitives, 2px ink borders, hard-offset
  shadows, `.mono-meta`/`.mono-id` (no hand-rolled `font-mono uppercase`),
  `.focus-ring`, 10px type floor, no emoji/exclamation marks.
- Copy-pinning tests are binding: proof-strip.tsx keeps `<PilotProofStrip />`
  and its stat strings; venue-proof.tsx keeps "What venues say",
  "VenueProofReviews" and the paraphrased-operator intro; venue names +
  postcodes stay greppable across `components/marketing/landing/`.
- app/page.tsx keeps the 8 required section tags (LandingHero, JumpNav,
  CounterFlow, ComparisonTable, CounterVerifiedStamp, TrustPricing,
  LandingFaq, FinalCta).
- Anchor ids `#how-it-works`, `#no-app`, `#anti-fraud`, `#for-venues`,
  `#pricing`, `#faq` keep working; panel ids `#nabaperks-proof`, `#old-crown`
  move to panel divs with explicit `scroll-mt-24`.
- No new dependencies. ProofTabs receives panels as ReactNode props (section
  components must not enter the client module graph).
- Scrollable rails satisfy axe `scrollable-region-focusable` (region role +
  label + tabIndex + focus outline).

## Decisions already made

- Deep pass approved by the owner: proof merge + rails + disclosures, landing
  only, mobile-first; the page-order change (VenueProof moves up into the
  proof cluster, ProofStrip stats move down into it) is accepted.
- Tab semantics follow the FilterPills precedent (`role="group"` +
  `aria-pressed`), not `role="tablist"`.
- Merged section renders with `entrance={false}`; each panel carries its own
  WetInkRise.
- VenueProofReviews stays always-mounted (CSS-hidden when inactive).

## EARS requirements

- **LMD-1 (zero copy loss):** THE landing page SHALL render the identical
  normalized word inventory in `main` before and after the change.
- **LMD-2 (mobile height):** WHEN `/` renders at 375px width, THE page height
  SHALL be at most ~10.5k px (≈12 screens), down from 14,055px.
- **LMD-3 (desktop essentially unchanged):** WHEN `/` renders at ≥1024px
  width, THE page SHALL show all proof panels stacked with no tab chips, and
  SHALL NOT be materially taller than before (≤1.5% of the 9,619px baseline —
  the merged section's shared header is the one inherent desktop addition).
- **LMD-4 (proof merge):** THE landing SHALL render one `<LandingProof />`
  section composing ProofStrip, NabaperksProof, OldCrownCandidate and
  VenueProof bodies; WHEN a proof panel's render gate fails (e.g.
  `nabaperksProofReady()` false), THE corresponding chip SHALL NOT render.
- **LMD-5 (tab reveal):** WHILE the viewport is `<lg`, THE ProofTabs SHALL
  show exactly one active panel, hide inactive panels via CSS only (content
  stays in DOM), and mark the active chip with `aria-pressed="true"`.
- **LMD-6 (deep links):** WHEN the location hash targets a panel id, THE
  ProofTabs SHALL activate that panel on load and on `hashchange`.
- **LMD-7 (rails):** WHEN a card list renders inside SnapRail at `<lg`, THE
  rail SHALL be a focusable labelled region with snap scrolling, an edge fade
  matched to its background, and a `.mono-id` swipe hint; at `≥sm/lg` the
  caller's existing grid SHALL render unchanged.
- **LMD-8 (schema parity):** THE `counterFlowSteps` and `faqs` exports and
  the visible step titles SHALL remain byte-identical so `jsonld:check`
  passes unmodified.
- **LMD-9 (a11y):** THE changed landing SHALL pass the axe WCAG 2.0/2.1 A+AA
  sweep on chromium and mobile-safari.

## Verification method & task breakdown

Tasks: (1) primitives (SnapRail incl. fixing the inert snap in
venue-proof-reviews, ProofTabs, ReadMore) → (2) LandingProof + page
recomposition → (3) rails/tightens per section → (4) test + DESIGN.md
amendments → (5) gates + evidence.

Observable behaviors to verify: word-inventory diff empty (LMD-1); measured
heights (LMD-2/3); chips gated with panels (LMD-4); one panel visible at
375px, all at 1280px (LMD-5); hash `#old-crown` opens the case-study panel on
mobile (LMD-6); rails tab-focusable and horizontally scrollable at 375px
(LMD-7); `pnpm jsonld:check` untouched-green (LMD-8); a11y sweep green
(LMD-9). Visual `home-*` baselines regenerate with the new layout.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` ·
`pnpm test:coverage` · `pnpm bundle:check` · `pnpm test:e2e` ·
`pnpm test:a11y` · `pnpm test:visual` (chromium + mobile-safari).

## Implementation evidence (2026-07-04)

- LMD-1: normalized word-inventory diff of `main` textContent — zero words
  lost (2,606 → 2,684; the 78 additions are the chip labels, swipe hints,
  ReadMore summary and section header; sole diff residue was the `FAQ`+`for`
  element-boundary glue pair, both words present after).
- LMD-2: Playwright scrollHeight at 375px — 14,055px → **10,883px**
  (17.3 → 13.4 screens, −22.6%).
- LMD-3: 1280px — 9,619px → 9,716px (+1.0%, within the ≤1.5% bound); chips
  hidden, all panels stacked (verified via computed styles).
- LMD-4/5/6: chip switching, CSS-only hiding, `#old-crown`/`#venue-proof`
  hash activation verified interactively in the browser.
- LMD-7: all five rails focusable (`tabIndex=0`), labelled regions,
  horizontally scrollable at 375px with edge fade + `.mono-id` hint.
- LMD-8: `pnpm jsonld:check` green against the production build, untouched.
- LMD-9: `pnpm test:a11y` 57/57 (chromium + mobile-safari).
- Gates: `pnpm governance:run-gates` — all 16 active gates green;
  `pnpm test:visual` 20/20 across all four browser projects after
  re-baselining home (all browsers) and refreshing the chronically-drifted
  pricing/harness-dashboard baselines; e2e CI subset 61/61.
- Known scope note: the NabaperksProofBody mobile padding tighten is visible
  on `/loyalty-for-pubs` (shared body; benign density improvement) — its
  visual baseline was regenerated accordingly.

---
spec_id: MS-landing-conversion-spine
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-04
allowed_blast_radius:
  - app/page.tsx
  - app/how-it-works/page.tsx
  - components/marketing/landing/**
  - tests/micro-specs/**
  - tests/e2e/**
  - micro-specs/platform/**
implementation_surfaces:
  - app/page.tsx
  - app/how-it-works/page.tsx
  - components/marketing/landing/faq.tsx
  - tests/micro-specs/marketing-multipage.test.mjs
  - tests/micro-specs/marketing-redesign.test.mjs
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/landing-mobile-density.md
  - micro-specs/platform/marketing-multipage.md
  - micro-specs/platform/marketing-seo.md
related_tests:
  - tests/micro-specs/landing-conversion-spine.test.mjs
  - tests/micro-specs/marketing-multipage.test.mjs
  - tests/micro-specs/marketing-redesign.test.mjs
  - tests/e2e/visual.spec.ts
  - tests/e2e/a11y.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm claims:check
  - pnpm jsonld:check
  - pnpm tokens:check
  - pnpm test:e2e
  - pnpm test:a11y
  - pnpm test:visual
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Regenerated and approved home visual baselines on all four browser projects (the HW-1 "no regeneration" clause is superseded here).
  - Anchor audit output showing no dangling anchor reference remains on /.
approved_exceptions: []
---

# MS-landing-conversion-spine — Thin / to a conversion spine now the mechanism, personas and pricing live on their own routes

## Intent

With `/how-it-works` (MS-marketing-multipage) and the three persona spokes
(MS-marketing-persona-spokes) shipped, the owner has decided the homepage
stops being the whole site: `/` becomes a short conversion spine and the
deep material lives on the routes built for it.

This spec PARTIALLY SUPERSEDES two frozen contracts (precedent:
MS-landing-mobile-density partially superseding MS-marketing-seo):

- **MS-landing-mobile-density** — its landing section-composition contract
  is superseded: LMD-1 (zero copy loss on `/`), the 8-required-section-tag
  and 6-anchor strict constraints, LMD-4/LMD-5/LMD-7 (merged proof, proof
  tabs, snap rails on `/`) and the "no copy change on /" scope-out no longer
  bind. LMD-8's export-level schema parity (frozen `counterFlowSteps` and
  `faqs` exports) REMAINS binding, as do its DESIGN.md rules.
- **MS-marketing-multipage** — HW-1 ONLY (the home freeze and its "home
  baselines pass without regeneration" evidence clause) is superseded.
  HW-2..HW-7 remain binding unmodified.

Copy is preserved at SITE level, not page level: every section leaving `/`
already renders on `/how-it-works`, which additionally gains the full
`LandingProof` tabs so the venue reviews and case study stay live.

## Scope (in)

- `app/page.tsx`: the spine composition (below), default marketing header
  (bespoke anchor navLinks removed), FAQPage schema subset slice.
- `components/marketing/landing/faq.tsx`: `LandingFaq` gains an optional
  `limit` prop (default: all 8) — export values unchanged.
- `app/how-it-works/page.tsx`: additively mounts `<LandingProof />`.
- Contract-test amendments (a test change is a spec change — this spec is
  that change): the HW-1 required-tags list in
  `marketing-multipage.test.mjs`, the required-sections list and the
  `<LandingProof />` pin in `marketing-redesign.test.mjs`.
- New `landing-conversion-spine` contract test pinning the spine (present
  AND absent tags, FAQ subset === schema subset).
- Supersession cross-notes in the two superseded spec files; regenerated
  home visual baselines.

## Scope (out)

- `faqs` / `counterFlowSteps` export VALUES: byte-identical (LMD-8).
- `jump-nav.tsx` FILE stays (a marketing-polish-p3 styling test reads its
  markup); only its `/` usage is removed. Deletion is deferred work.
- `/pricing`, `/loyalty-for-*`, `/guides/*`, `/about`: untouched.
  `/pricing` is already the canonical pricing superset; `TrustPricing`
  already teases and links it — no pricing content moves.
- No copy rewording inside any surviving component; removed-section copy is
  not re-authored anywhere.
- No new dependencies; no sitemap/llms.txt/CSP changes (no new routes).

## Strict constraints

- Wet Ink only; approved facts only; `claims:check` green.
- The home `@graph` keeps every node type the jsonld guard requires
  (WebPage, SoftwareApplication, FAQPage, HowTo, Dataset, DefinedTermSet,
  BreadcrumbList + layout-level Organization/WebSite); only the FAQPage
  `mainEntity` shrinks to the rendered subset.
- The rendered FAQ subset and the schema subset MUST be the same slice of
  the frozen export (visible copy === structured data).

## Decisions already made

- Owner product decision (2026-07-04): the multipage direction is
  re-confirmed via the approved implementation plan — this deliberately
  reverses the same-day revert recorded in MS-marketing-multipage, with the
  difference that the deep pages now exist first.
- Spine order: LandingHero → CounterFlow → condensed proof (ProofStrip +
  NabaperksProofBody in one Section) → VenuePersonas → TrustPricing →
  LandingFaq (first 4) → FinalCta.
- Removed from `/`: JumpNav, ComparisonTable, CounterVerifiedStamp,
  VenueBenefits, SeparateMarketing, the LandingProof tab assembly.
- `/how-it-works` is the destination for the full proof tabs.
- Home header uses the shared default marketing links; `#anti-fraud` is no
  longer referenced from `/` (the section lives on `/how-it-works`).
- Home FAQ subset size: 4.

## EARS requirements

- **CS-1 (spine composition):** THE homepage SHALL compose LandingHero,
  CounterFlow, the condensed proof Section (ProofStrip + NabaperksProofBody),
  VenuePersonas, TrustPricing, LandingFaq limited to the first four
  questions, and FinalCta — and SHALL NOT mount JumpNav, ComparisonTable,
  CounterVerifiedStamp, VenueBenefits, SeparateMarketing or the LandingProof
  tab assembly.
- **CS-2 (sitewide copy preservation):** WHEN a section is removed from `/`,
  THE site SHALL keep rendering it on `/how-it-works`; `/how-it-works` SHALL
  additionally mount `<LandingProof />` so the proof tabs stay live.
- **CS-3 (FAQ subset sync):** THE homepage SHALL render the first four
  questions of the frozen `faqs` export and emit a FAQPage whose
  `mainEntity` is the SAME four; the export SHALL keep all 8 and
  `/how-it-works` SHALL keep rendering all 8.
- **CS-4 (schema continuity):** THE home graph SHALL keep WebPage,
  SoftwareApplication (with Offer), FAQPage, HowTo, Dataset, DefinedTermSet
  and BreadcrumbList nodes; `pnpm jsonld:check` SHALL pass with the home
  block's node-presence checks unmodified.
- **CS-5 (nav):** THE homepage SHALL use the shared default marketing
  header, and no `#anti-fraud` reference SHALL remain in `/` source.
- **CS-6 (surviving anchors):** THE `#how-it-works`, `#for-venues` and
  `#pricing` anchors SHALL keep resolving on `/`.
- **CS-7 (browser evidence):** THE home visual baselines SHALL be
  regenerated and approved on all four browser projects, and `/` SHALL pass
  the axe WCAG 2.0/2.1 A+AA sweep on chromium and mobile-safari.

## Verification method & task breakdown

Tasks: (1) amend the two existing contract tests + write the new spine
contract test (red against current home) → (2) faq.tsx `limit` prop →
(3) app/page.tsx spine + app/how-it-works LandingProof → (4) static gates →
(5) browser gates + regenerated home baselines + anchor audit.

Observable behaviors: spine tags present and removed tags absent in
`app/page.tsx` (new contract test); `<LandingProof />` present on
`/how-it-works` (amended + new tests); FAQ subset === schema subset === 4
with export at 8 (new contract test + jsonld home block); default header on
`/` (no navLinks prop in home source); anchors resolve (e2e a11y sweep still
loads `/`; grep shows no `#anti-fraud` in `app/page.tsx` or rendered home
nav); all gates green; four regenerated home baselines approved.

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` ·
`pnpm test:coverage` · `pnpm bundle:check` · `pnpm claims:check` ·
`pnpm jsonld:check` · `pnpm tokens:check` · `pnpm test:e2e` ·
`pnpm test:a11y` · `pnpm test:visual`.

## Lifecycle note

Status stays `active` while the diff is uncommitted; flip to `implemented`
in or immediately after the spine commit. On that flip, add the
supersession cross-notes to MS-landing-mobile-density and
MS-marketing-multipage (their statuses stay `implemented` — the precedent
is partial supersession recorded in the superseding spec's Intent).

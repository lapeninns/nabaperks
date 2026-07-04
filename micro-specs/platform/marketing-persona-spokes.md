---
spec_id: MS-marketing-persona-spokes
status: active
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-04
allowed_blast_radius:
  - app/loyalty-for-cafes/**
  - app/loyalty-for-takeaways/**
  - app/loyalty-for-bars/**
  - components/marketing/landing/**
  - components/layout/marketing-layout.tsx
  - lib/marketing/facts.ts
  - lib/security/csp.ts
  - public/llms.txt
  - scripts/check-banned-claims.mjs
  - scripts/check-jsonld.mjs
  - tests/micro-specs/**
  - tests/e2e/**
  - micro-specs/platform/**
implementation_surfaces:
  - app/loyalty-for-cafes/page.tsx
  - app/loyalty-for-takeaways/page.tsx
  - app/loyalty-for-bars/page.tsx
  - components/marketing/landing/persona-data.ts
  - components/layout/marketing-layout.tsx
  - lib/marketing/facts.ts
  - lib/security/csp.ts
  - scripts/check-banned-claims.mjs
  - scripts/check-jsonld.mjs
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/marketing-seo.md
  - micro-specs/platform/marketing-multipage.md
  - reports/seo-playbook-audit-nabaperks.md
related_tests:
  - tests/micro-specs/marketing-persona-spokes.test.mjs
  - tests/e2e/visual.spec.ts
  - tests/e2e/a11y.spec.ts
  - tests/e2e/public-route-metadata.spec.ts
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
  - Approved visual baselines for the three spoke routes on all four browser
    projects.
  - Click-through evidence that every VenuePersonas card link resolves 200
    (SE-5 preserved).
approved_exceptions: []
---

# MS-marketing-persona-spokes — Build the cafe/takeaway/bar persona spokes the homepage already markets

## Intent

Both SEO audits name the unbuilt persona spokes as the top lever (P0): the
homepage's VenuePersonas section markets four verticals but only pubs links
anywhere; `/loyalty-for-cafes`, `/loyalty-for-takeaways` and
`/loyalty-for-bars` are referenced in `persona-data.ts` yet do not exist.
This spec builds the three spokes by mirroring the pub hub
(`app/loyalty-for-pubs/page.tsx`), registers them in every route registry,
and lights up the persona card links. It satisfies (and thereby retires) the
"persona spokes stay unbuilt" scope-out in MS-marketing-seo and
MS-marketing-multipage; SE-5 (no orphan marketing links) remains binding and
is what flips these cards from dead text to live links — routes and links
land in the same change so no marketing link 404s at any commit.

## Scope (in)

- Three new server-rendered, statically prerenderable pages:
  `app/loyalty-for-cafes/page.tsx`, `app/loyalty-for-takeaways/page.tsx`,
  `app/loyalty-for-bars/page.tsx`, composed from EXISTING landing components
  (`CounterFlow`, `NabaperksProof`, `ComparisonTable`, `RegularsCalculator`,
  `FinalCta`) plus per-persona hero and fit sections.
- `lib/marketing/facts.ts`: `ROUTES.cafeHub/takeawayHub/barHub` +
  three `PUBLIC_SITE_ROUTES` rows (priority 0.9, monthly).
- `components/marketing/landing/persona-data.ts`: spoke hrefs move to
  `ROUTES.*` references; `live: true` on cafes/takeaways/bars
  (`SHOW_PERSONA_SPOKES` stays untouched as a vestigial fallback).
- Route registries: `public/llms.txt`, CSP `STATIC_MARKETING_EXACT_PATHS`,
  banned-claims `SCAN` roots, per-spoke `check-jsonld` blocks, and the
  visual/a11y-sweep/route-metadata e2e rosters.
- `components/layout/marketing-layout.tsx`: three footer merchant links.
- New `marketing-persona-spokes` contract test; 12 new visual baselines.

## Scope (out)

- `app/page.tsx`, `app/how-it-works/page.tsx`, `app/loyalty-for-pubs/**`,
  `app/pricing/**`, `app/guides/**`: byte-identical (persona-data and the
  shared footer are the only landing-adjacent files that change).
- No new guides; the spokes cross-link `/how-it-works` instead of a guides
  rail. No `PubCounterFlow` clones — the generic `CounterFlow` is reused.
- No new dependencies, no new schema helpers, no copy changes to any
  existing component; `counterFlowSteps` / `faqs` export values stay frozen.

## Strict constraints

- Wet Ink only (`Section`/`ContrastBand`, `.mono-meta`/`.mono-id`,
  `.focus-ring`, no emoji, no exclamation marks per DESIGN.md).
- Approved facts only; `claims:check` green WITH the three spoke roots added
  to `SCAN`. Vertical vocabulary is honesty-constrained: bars may use
  `VERTICALS.pubLed` terms (bars, wine bars); cafes and takeaways may use
  only `VERTICALS.broad` nouns plus their `persona-data` hook lines. Banned
  outright: "chippy"/"chippies", "bubble tea", and any first-person
  operator-experience claim for a non-pub vertical (the operator estate is
  nine pubs) — vertical-agnostic proof cites the Counter-Loyalty Index.
- Each spoke is listed in the static-marketing CSP path set and carries
  canonical/OG/twitter metadata consistent with the pub hub (en_GB,
  OG_IMAGE, summary_large_image).
- HowTo nodes MUST pass a route-distinct `id` to `howToSchema` (the shared
  default `#how-it-works` id is reserved for the home graph).

## Decisions already made

- Owner direction (2026-07-04): multipage route map approved — spokes at
  `/loyalty-for-cafes`, `/loyalty-for-takeaways`, `/loyalty-for-bars`,
  mirroring the pub hub, per the SEO playbook audit P0 prescription.
- Sitemap priority 0.9 / monthly, matching the pub hub.
- Persona cards go live via per-persona `live: true`, not the
  `SHOW_PERSONA_SPOKES` flag flip.
- Proof on spokes is the Counter-Loyalty Index (vertical-agnostic); no
  operator estate claims outside pubs.

## EARS requirements

- **PS-1 (routes + composition):** THE site SHALL serve `/loyalty-for-cafes`,
  `/loyalty-for-takeaways` and `/loyalty-for-bars`, each composing: a
  persona hero (h1 naming the vertical, hook-derived supporting copy, a
  benefits card built from `PRODUCT.*` facts, `Start free pilot` →
  `/signup`, `View pricing` → `/pricing`), a persona fit section,
  CounterFlow, NabaperksProof, ComparisonTable, RegularsCalculator, a
  cross-link to `/how-it-works`, and FinalCta.
- **PS-2 (honest copy):** THE spoke copy SHALL use only approved facts and
  the vertical vocabulary permitted above; `pnpm claims:check` SHALL pass
  with `app/loyalty-for-cafes`, `app/loyalty-for-takeaways` and
  `app/loyalty-for-bars` present in the `SCAN` list.
- **PS-3 (schema):** each spoke SHALL emit WebPage + BreadcrumbList + HowTo
  (byte-synced to `counterFlowSteps`, route-distinct `@id`) + Dataset and no
  Person node; `pnpm jsonld:check` SHALL pass with one block per spoke and
  the home/how-it-works/pub-hub blocks unmodified.
- **PS-4 (registries):** THE sitemap (via `PUBLIC_SITE_ROUTES`),
  `public/llms.txt`, the static-marketing CSP path list, the banned-claims
  `SCAN` list, and the visual/a11y/route-metadata e2e rosters SHALL include
  all three routes; the marketing footer SHALL link all three on every
  marketing page.
- **PS-5 (persona links live):** THE landing VenuePersonas cards for cafes,
  takeaways and bars SHALL link to their spokes via `ROUTES.*` with
  `live: true`; no marketing link SHALL 404 (SE-5 preserved).
- **PS-6 (a11y):** each spoke SHALL pass the axe WCAG 2.0/2.1 A+AA sweep on
  chromium and mobile-safari.
- **PS-7 (frozen single-sources):** THE `counterFlowSteps` and `faqs` export
  values SHALL remain byte-identical, and `app/page.tsx`,
  `app/how-it-works/page.tsx` and `app/loyalty-for-pubs/page.tsx` SHALL be
  byte-identical to their pre-spec state.

## Verification method & task breakdown

Tasks: (1) contract test (red) → (2) facts/persona-data/registry wiring →
(3) three pages → (4) static gates → (5) browser gates + 12 baselines +
SE-5 click-through.

Observable behaviors: each spoke 200s composing the PS-1 sections (contract
test + build render); claims:check green with spoke roots scanned (PS-2);
jsonld:check green incl. three new blocks (PS-3); every registry lists all
three routes and the footer links them (PS-4, contract test +
route-metadata e2e); VenuePersonas renders three new live links and every
marketing link resolves (PS-5); axe green (PS-6); frozen exports and
untouched pages byte-identical vs HEAD (PS-7, contract test + git diff).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` ·
`pnpm test:coverage` · `pnpm bundle:check` · `pnpm claims:check` ·
`pnpm jsonld:check` · `pnpm tokens:check` · `pnpm test:e2e` ·
`pnpm test:a11y` · `pnpm test:visual`.

## Lifecycle note

Status stays `active` while the diff is uncommitted; flip to `implemented`
in or immediately after the spokes commit.

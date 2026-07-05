---
spec_id: MS-marketing-multipage
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-07-04
allowed_blast_radius:
  - app/how-it-works/**
  - app/sitemap.ts
  - components/marketing/landing/**
  - components/layout/marketing-layout.tsx
  - components/layout/marketing-header-nav.tsx
  - lib/marketing/facts.ts
  - lib/seo/structured-data.ts
  - lib/security/csp.ts
  - public/llms.txt
  - scripts/check-jsonld.mjs
  - scripts/check-banned-claims.mjs
  - tests/micro-specs/**
  - tests/e2e/**
  - micro-specs/platform/**
implementation_surfaces:
  - app/how-it-works/page.tsx
  - components/marketing/landing/qr-matrix.ts
  - components/layout/marketing-layout.tsx
  - lib/marketing/facts.ts
  - lib/security/csp.ts
  - scripts/check-jsonld.mjs
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/platform/marketing-seo.md
  - micro-specs/platform/landing-mobile-density.md
related_tests:
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
  - Approved visual baselines for /how-it-works on all four browser projects.
  - Confirmation the homepage render is unchanged (existing home baselines
    still pass without regeneration).
approved_exceptions: []
---

# MS-marketing-multipage — Add /how-it-works as a standalone mechanism page (additive; the landing stays whole)

## Intent

The owner wants the marketing site to become multi-page WITHOUT thinning the
landing page: `/` remains the full conversion hub exactly as shipped by
MS-landing-mobile-density, and a standalone `/how-it-works` page is ADDED for
visitors (and search/answer engines) who want the mechanism on its own URL —
the four-beat flow, the five counter-verification checks, the
paper/apps/wallet comparison, the venue setup preview, the
loyalty-vs-marketing separation, and the full FAQ.

An earlier redistributive variant of this spec (moving those sections OFF the
homepage) was built, fully verified, and then reverted on owner feedback the
same day: the split must be additive, not redistributive. The homepage is out
of scope except for the shared marketing footer/header registry.

## Scope (in)

- New `app/how-it-works/page.tsx` composing the EXISTING landing section
  components (re-mounted, not rewritten) plus its own page header and
  metadata.
- `components/marketing/landing/qr-matrix.ts` — shared server-side QR matrix
  builder (the venue-benefits card needs a QR on the new page too).
- Shared marketing nav: the default marketing header gains `How it works`
  (the homepage keeps its own bespoke anchor navLinks), and the footer
  merchant nav gains the link on every marketing page.
- Route registries: `ROUTES` + `PUBLIC_SITE_ROUTES` (sitemap) in
  `lib/marketing/facts.ts`; `public/llms.txt`; CSP
  STATIC_MARKETING_EXACT_PATHS; `scripts/check-banned-claims.mjs` SCAN;
  visual/a11y-sweep/public-route-metadata e2e rosters.
- `scripts/check-jsonld.mjs` gains a `/how-it-works` block; the home block is
  untouched.
- `howToSchema` gains an optional route-distinct `id` override (default
  unchanged for existing callers).
- New `marketing-multipage` contract test; new how-it-works visual baselines.

## Scope (out)

- `app/page.tsx`, `faq.tsx`, JumpNav, and every existing home section:
  byte-identical to the MS-landing-mobile-density state. All
  MS-landing-mobile-density and MS-marketing-seo constraints remain binding
  unmodified.
- Persona spokes stay unbuilt (SE-5 no-404 rule binding).
- No copy changes to any existing component; `counterFlowSteps` / `faqs`
  export values stay frozen. No new dependencies.

## Strict constraints

- Wet Ink only (`Section`/`ContrastBand`, `.mono-meta`/`.mono-id`,
  `.focus-ring`, no emoji, no exclamation marks per DESIGN.md).
- Approved facts only; `claims:check` green — the new page's header copy must
  not introduce banned or unverifiable claims.
- `/how-it-works` is fully server-rendered, statically prerenderable (listed
  in the static-marketing CSP path set), with canonical/OG/twitter metadata
  consistent with the other marketing routes.
- Section duplication across `/` and `/how-it-works` is deliberate: both
  mount the same single-source components, so copy cannot drift.

## Decisions already made

- Owner direction (2026-07-04): "revert back to yesterday single landing
  page, and make it multi page" — the landing page stays whole; multi-page
  is additive.
- The mechanism page lives at `/how-it-works`, sitemap priority 0.9.
- `/how-it-works` emits its own HowTo + FAQPage JSON-LD with route-distinct
  `@id`s (`/how-it-works#howto`, `/how-it-works#faq`); home's `@graph` is
  untouched and keeps its default ids.
- The homepage header keeps its bespoke anchor navLinks (it is a one-page
  funnel); the page is reachable from every marketing page's footer, from
  the default header on non-home marketing pages, and from the sitemap.

## EARS requirements

- **HW-1 (home untouched):** THE homepage SHALL keep its
  MS-landing-mobile-density composition — section tags, anchors, FAQ set and
  page graph unchanged; the existing home visual baselines SHALL pass
  without regeneration.
  *(Superseded 2026-07-05 by MS-landing-conversion-spine — the homepage is
  now the conversion spine and its baselines were regenerated under that
  spec. HW-2…HW-7 remain binding unmodified.)*
- **HW-2 (mechanism page):** THE site SHALL serve `/how-it-works` composing:
  a page header (h1 + `Start free pilot` CTA), CounterFlow, ComparisonTable,
  CounterVerifiedStamp, VenueBenefits, SeparateMarketing, LandingFaq (all
  8), FinalCta.
- **HW-3 (schema):** `/how-it-works` SHALL emit WebPage + BreadcrumbList +
  HowTo byte-synced to `counterFlowSteps` + FAQPage byte-synced to `faqs`,
  each with a route-distinct `@id`; `pnpm jsonld:check` SHALL pass with the
  home block unmodified.
- **HW-4 (registries):** THE sitemap, `public/llms.txt`, the
  static-marketing CSP path list, the banned-claims SCAN list, and the
  visual/a11y/route-metadata e2e rosters SHALL include `/how-it-works`; the
  marketing footer SHALL link it on every marketing page and the default
  marketing header SHALL link it on non-home marketing pages; no marketing
  link SHALL 404.
- **HW-5 (frozen single-sources):** THE `counterFlowSteps` and `faqs` export
  values SHALL remain byte-identical.
- **HW-6 (a11y):** `/how-it-works` SHALL pass the axe WCAG 2.0/2.1 A+AA
  sweep on chromium and mobile-safari.
- **HW-7 (conversion asks):** THE mechanism page SHALL present a
  `Start free pilot` CTA resolving to `/signup` in its header and its close.

## Verification method & task breakdown

Tasks: (1) page + qr-matrix helper → (2) nav + registries + guard block →
(3) contract test → (4) static gates → (5) browser gates + baselines.

Observable behaviors: home source unchanged vs HEAD (HW-1, git diff +
existing baselines green); `/how-it-works` 200 with the HW-2 sections
(contract test + build render); jsonld:check green including the new block
(HW-3); every registry lists the route (HW-4, contract test); FAQ count 8 in
`faq.tsx` (HW-5); axe green (HW-6); CTA hrefs (HW-7).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` ·
`pnpm test:coverage` · `pnpm bundle:check` · `pnpm claims:check` ·
`pnpm jsonld:check` · `pnpm tokens:check` · `pnpm test:e2e` ·
`pnpm test:a11y` · `pnpm test:visual`.

## Implementation evidence (2026-07-04, additive)

- HW-1: `app/page.tsx`, `faq.tsx`, landing barrel, marketing-redesign
  contract and the four home visual baselines are byte-identical to HEAD
  (`git status` shows them unchanged); `pnpm test:visual` 24/24 with home
  matching the ORIGINAL baselines on all four projects — no regeneration.
- HW-2/3/4/5/7: the four `marketing-multipage` contract tests are green —
  `pnpm test` 264/264 (+ 232 unit). `pnpm jsonld:check` green with the home
  block unmodified and the new `/how-it-works` block validating HowTo step
  parity (Scan/Save/Stamp/Reward), route-distinct `@id`
  (`/how-it-works#howto`) and an 8-question FAQPage.
- HW-6: axe WCAG 2 A/AA sweep on `/how-it-works` — 4/4 projects (chromium,
  mobile-safari, desktop-firefox, desktop-safari).
- Static: `pnpm typecheck` · lint 0 errors · `governance:check` (blast
  radius over 18 changed files) · `claims:check` (66 files incl. the new
  route) · `tokens:check` · `pnpm build` · `test:coverage` · `bundle:check`
  (root first-load 884,262 bytes).
- Known local caveat (unchanged surfaces): full local e2e/a11y suites carry
  ~35/8 failures on `/start`+`/login`-class session routes 500ing on
  `EnvConfigError` — this machine's `.env.local` lacks the five
  customer-auth secrets after the 2026-07-04 environment split. Unrelated to
  this spec; CI carries secrets.
- History: a redistributive variant (lean home spine) was fully built and
  verified earlier the same day, then reverted on owner feedback; the
  homepage is restored byte-identical and the split is additive.

## Lifecycle note

Status stays `active` while the diff is uncommitted (`governance:check`
grants blast radius from active specs only); flip to `implemented` in or
immediately after the landing commit.

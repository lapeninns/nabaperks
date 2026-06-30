---
spec_id: MS-marketing-seo
status: implemented
risk_class: ui-only
owner: claude-code agent (amanshresthaa)
last_reviewed: 2026-06-30
allowed_blast_radius:
  - app/page.tsx
  - app/pricing/**
  - app/about/**
  - app/loyalty-for-pubs/**
  - app/privacy/**
  - app/terms/**
  - app/start/**
  - app/sitemap.ts
  - app/robots.ts
  - components/marketing/**
  - components/layout/**
  - micro-specs/platform/**
implementation_surfaces:
  - app/page.tsx
  - app/pricing/page.tsx
  - app/about/page.tsx
  - app/loyalty-for-pubs/page.tsx
  - app/privacy/page.tsx
  - app/terms/page.tsx
  - app/sitemap.ts
  - app/robots.ts
related_docs:
  - DESIGN.md
  - micro-specs/GLOBAL_CONTEXT.md
related_tests:
  - tests/micro-specs/marketing-redesign.test.mjs
  - tests/micro-specs/marketing-auth-legal.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm claims:check
  - pnpm jsonld:check
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates and related tests.
approved_exceptions: []
---

# MS-marketing-seo — Landing, pricing, about, legal, guides, JSON-LD, sitemap/robots

## Intent

The public marketing surface — landing, pricing, about, the legal pages, and the
loyalty-for-pubs guide cluster — is SEO/GEO-ready and copy-honest. Pages emit
valid JSON-LD, the site exposes a sitemap and robots policy, and no page makes an
unverifiable or banned marketing claim. Marketing sections route through shared
density primitives so layout is tuned in one place.

## Scope (in)

- `/` (landing), `/pricing`, `/about`, `/loyalty-for-pubs` (hub), `/privacy`,
  `/terms`, `/start`; `app/sitemap.ts`, `app/robots.ts`; the marketing
  components and `Section`/`ContrastBand` density primitives.
- The JSON-LD and banned-claims contracts (`jsonld:check`, `claims:check`).

## Scope (out)

- The unbuilt persona spokes (`/loyalty-for-cafes`, `/-takeaways`, `/-bars`) —
  out of scope until authored; the hub must not 404-link to them.
- App/auth/customer surfaces. No data/RLS change; copy + structure only.

## Decisions already made

- The landing leads with the browser-not-wallet wedge and the named
  "Counter-Verified Stamp", with operator-voice proof and a real Nabaperks
  loyalty-stats band; CTAs read "Start free pilot".
- Marketing density is tuned via `Section`/`ContrastBand` in `components/layout`,
  not per-file.
- `claims:check` forbids unverifiable/banned marketing claims; `jsonld:check`
  validates the structured data. Both run in CI.

## EARS requirements

- **SE-1 (structured data):** THE marketing pages SHALL emit valid JSON-LD that
  passes `jsonld:check`.
- **SE-2 (honest claims):** THE marketing copy SHALL contain no banned or
  unverifiable claim; `claims:check` SHALL pass.
- **SE-3 (sitemap/robots):** THE site SHALL serve a `sitemap.xml` listing the
  live public routes and a `robots.txt` policy.
- **SE-4 (legal):** THE site SHALL serve linked `/privacy` and `/terms` pages.
- **SE-5 (no orphan links):** THE hub SHALL NOT link to persona spokes that do
  not yet exist (no 404s from marketing nav).
- **SE-6 (shared density):** WHEN a marketing layout band recurs, THE system
  SHALL render it through `Section`/`ContrastBand` rather than bespoke per-page
  markup.

## Verification method

`pnpm jsonld:check` (SE-1) and `pnpm claims:check` (SE-2) are CI gates.
`tests/micro-specs/marketing-redesign.test.mjs` and `marketing-auth-legal.test.
mjs` cover the landing structure + legal/auth surfaces (SE-4). A DB-free e2e can
assert `sitemap.xml`/`robots.txt` resolve (SE-3) and that the hub has no broken
spoke links (SE-5).

## Gates

`pnpm lint` · `pnpm typecheck` · `pnpm build` · `pnpm test` · `pnpm claims:check`
· `pnpm jsonld:check`.

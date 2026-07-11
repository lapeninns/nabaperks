---
spec_id: MS-merchant-venue-search-csp
status: closed
risk_class: ui-only
owner: amankumarshrestha
last_reviewed: 2026-07-11
allowed_blast_radius:
  - micro-specs/merchant/**
  - lib/security/csp.ts
  - tests/unit/csp-theme-hash.test.mjs
  - tests/e2e/merchant-venue-search-csp.desktop.spec.ts
implementation_surfaces:
  - lib/security/csp.ts
  - tests/unit/csp-theme-hash.test.mjs
  - tests/e2e/merchant-venue-search-csp.desktop.spec.ts
related_tests:
  - tests/unit/csp-theme-hash.test.mjs
  - tests/e2e/merchant-venue-search-csp.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --grep "@MS-merchant-venue-search-csp"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
  - pnpm test -- tests/unit/csp-theme-hash.test.mjs
  - manual:browser-venue-search-csp
required_playwright_projects:
  - chromium
evidence_required:
  - Focused unit output proving the dynamic CSP names only the trusted Google Maps script origin while retaining nonce and strict-dynamic protections.
  - Chromium output proving the onboarding venue-search loader reaches a mocked Google Places response without a CSP violation.
  - Manual browser output proving venue setup retains its manual-address recovery when the external provider is unavailable.
approved_exceptions:
  - "evidence-waiver: the five complete-audit implementation waves share one reviewed working tree and will ship atomically (expires: 2026-07-18)"
---

# MS-merchant-venue-search-csp — Allow trusted Google Places script for venue search

## Why It Exists

The configured Google Places loader never reached the network because the app's
own dynamic `script-src-elem` policy omitted its exact script origin.
Merchants therefore saw the manual-address fallback even when search was
configured. The policy now admits only that trusted origin while keeping every
nonce, hash, and `strict-dynamic` protection and the existing recovery path.

## Invariants

- Dynamic `script-src` and `script-src-elem` explicitly name only
  `https://maps.googleapis.com` for the Places loader.
- Dynamic pages retain their nonce, pinned next-themes hashes,
  `strict-dynamic`, and prohibition on `unsafe-inline`.
- The static marketing CSP is unchanged.
- Provider data calls remain covered by the existing HTTPS connect policy.
- A configured mocked provider reaches the ready venue-search state without a
  CSP violation.
- Provider failure never blocks setup; manual address fields and recovery copy
  remain available.
- No API key value is asserted, logged, copied into evidence, or added to source.

## Code Pointers

- `lib/security/csp.ts`
- `components/merchant/launch/venue-place-autocomplete.tsx`
- `tests/unit/csp-theme-hash.test.mjs`
- `tests/e2e/merchant-venue-search-csp.desktop.spec.ts`
- `micro-specs/evidence/MS-merchant-venue-search-csp.json`

## Dead Ends

- Allowing wildcard Google domains was rejected because the loader uses one
  exact script origin.
- Removing or weakening nonce and `strict-dynamic` protections was rejected;
  the provider addition is additive and narrowly scoped.
- Treating the fallback as sufficient was rejected because the configured
  integration was being disabled by first-party policy rather than provider
  downtime.
- Removing manual entry after restoring search was rejected because external
  provider availability cannot become a setup dependency.
